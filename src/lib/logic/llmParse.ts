import type { Bi, Evaluation, Lang } from '../types';
import { clamp } from '../util';

/** qwen3 and other reasoning models wrap their scratchpad in <think>…</think>. */
export function stripThink(s: string): string {
  let out = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // Unterminated think block (output cut off) — drop everything from <think>.
  const open = out.search(/<think>/i);
  if (open >= 0) out = out.slice(0, open);
  return out.trim();
}

/** Find the first balanced {...} object in free text (string-aware), parse it, or return null. */
export function extractJson<T = Record<string, unknown>>(raw: string): T | null {
  const s = stripThink(raw);
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = fenced ? [fenced[1], s] : [s];
  for (const c of candidates) {
    const start = c.indexOf('{');
    if (start < 0) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < c.length; i++) {
      const ch = c[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const body = c.slice(start, i + 1);
          const parsed = tryParse<T>(body) ?? tryParse<T>(body.replace(/,\s*([}\]])/g, '$1'));
          if (parsed) return parsed;
          break;
        }
      }
    }
  }
  return null;
}

function tryParse<T>(s: string): T | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? (v as T) : null;
  } catch {
    return null;
  }
}

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s)）\]】"'<>]+/gi;
const DOMAIN_RE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|cn|io|edu|gov|info|co|uk|ai)(?:\/[^\s]*)?/gi;

/** Remove links (markdown and bare), markdown decorations, and stray whitespace. */
export function stripLinks(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(URL_RE, '')
    .replace(DOMAIN_RE, '')
    .replace(/[*_`#>]+/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([，。！？,.!?])/g, '$1')
    .trim();
}

/** Keep at most n sentences (Chinese or English punctuation). */
export function limitSentences(s: string, n = 3): string {
  const parts = s.match(/[^。！？!?.]+(?:[。！？!?]+|\.+|$)/g);
  if (!parts) return s.trim();
  const sentences = parts.map((p) => p.trim()).filter(Boolean);
  return sentences.slice(0, n).join(/[\u4e00-\u9fff]/.test(s) ? '' : ' ').trim();
}

/** Everything 小星 says passes through here. */
export function kidSafeText(s: unknown, maxSentences = 3): string {
  if (typeof s !== 'string') return '';
  return limitSentences(stripLinks(stripThink(s)), maxSentences);
}

/** Accept a plain string or {zh, en}; normalise to Bi. A plain string fills the requested language. */
export function toBi(v: unknown, lang: Lang, maxSentences = 3): Bi {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return { zh: kidSafeText(o.zh, maxSentences), en: kidSafeText(o.en, maxSentences) };
  }
  const t = kidSafeText(v, maxSentences);
  if (lang === 'en') return { zh: '', en: t };
  if (lang === 'zh') return { zh: t, en: '' };
  return /[\u4e00-\u9fff]/.test(t) ? { zh: t, en: '' } : { zh: '', en: t };
}

export function toStars(v: unknown, min = 1, max = 3, fallback = min): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.round(n), min, max);
}

export function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return /^(true|yes|1|是)$/i.test(v.trim());
  if (typeof v === 'number') return v !== 0;
  return false;
}

/** Parse the unified evaluation contract {stars, praise, one_question_or_suggestion, safety_flag}. */
export function parseEvaluation(raw: string, lang: Lang, fallback: Evaluation, minStars = 1): Evaluation {
  const j = extractJson(raw);
  if (!j) return fallback;
  const praise = toBi(j.praise, lang);
  const q = toBi(j.one_question_or_suggestion ?? j.suggestion ?? j.question, lang);
  return {
    stars: toStars(j.stars, minStars, 3, fallback.stars),
    praise: praise.zh || praise.en ? praise : fallback.praise,
    one_question_or_suggestion: q.zh || q.en ? q : fallback.one_question_or_suggestion,
    safety_flag: toBool(j.safety_flag),
  };
}
