// Minimal OpenAI-compatible client that runs in the browser (Ollama, LM Studio, vLLM, cloud APIs…).

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export class LlmError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

const trimBase = (u: string) => u.trim().replace(/\/+$/, '');

function headers(cfg: LlmConfig): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey.trim()) h.Authorization = `Bearer ${cfg.apiKey.trim()}`;
  return h;
}

function withTimeout(ms: number, outer?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  const onAbort = () => ctl.abort();
  outer?.addEventListener('abort', onAbort);
  return {
    signal: ctl.signal,
    done: () => {
      clearTimeout(t);
      outer?.removeEventListener('abort', onAbort);
    },
  };
}

/** qwen3 thinks out loud by default; "/no_think" turns that off and makes replies much faster. */
function maybeNoThink(model: string, messages: ChatMessage[]): ChatMessage[] {
  if (!/qwen3/i.test(model)) return messages;
  const out = messages.slice();
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (m.role !== 'user') continue;
    out[i] =
      typeof m.content === 'string'
        ? { ...m, content: `${m.content}\n/no_think` }
        : { ...m, content: [...m.content, { type: 'text', text: '/no_think' }] };
    break;
  }
  return out;
}

export async function chat(
  cfg: LlmConfig,
  messages: ChatMessage[],
  opts: { json?: boolean; timeoutMs?: number; signal?: AbortSignal; temperature?: number } = {},
): Promise<string> {
  const url = `${trimBase(cfg.baseUrl)}/chat/completions`;
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: maybeNoThink(cfg.model, messages),
    temperature: opts.temperature ?? 0.7,
    stream: false,
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const attempt = async (b: Record<string, unknown>) => {
    const { signal, done } = withTimeout(opts.timeoutMs ?? 60000, opts.signal);
    try {
      const res = await fetch(url, { method: 'POST', headers: headers(cfg), body: JSON.stringify(b), signal });
      if (!res.ok) throw new LlmError(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new LlmError('empty response');
      return text;
    } finally {
      done();
    }
  };

  try {
    return await attempt(body);
  } catch (e) {
    // Some servers reject response_format — retry once without it.
    if (opts.json && e instanceof LlmError && e.status && e.status >= 400 && e.status < 500) {
      const { response_format: _rf, ...rest } = body;
      return attempt(rest);
    }
    throw e;
  }
}

/** Is an OpenAI-compatible server reachable? Lists models (works with Ollama /v1/models). */
export async function ping(cfg: Omit<LlmConfig, 'model'>, timeoutMs = 2500): Promise<{ ok: boolean; models: string[]; error?: string }> {
  if (!cfg.baseUrl.trim()) return { ok: false, models: [], error: 'no base_url' };
  const { signal, done } = withTimeout(timeoutMs);
  try {
    const res = await fetch(`${trimBase(cfg.baseUrl)}/models`, { headers: headers({ ...cfg, model: '' }), signal });
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
    const data = await res.json().catch(() => ({}));
    const models: string[] = Array.isArray(data?.data) ? data.data.map((m: { id?: string }) => m.id ?? '').filter(Boolean) : [];
    return { ok: true, models };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, models: [], error: msg.includes('abort') ? 'timeout' : msg };
  } finally {
    done();
  }
}
