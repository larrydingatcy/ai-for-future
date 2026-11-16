// Speech-to-text. Default: Web Speech API (webkitSpeechRecognition works in iPad Safari).
// Optional: record with MediaRecorder and send to a whisper.cpp server or an OpenAI-compatible
// /audio/transcriptions endpoint.
import type { Settings } from '../types';

export interface ListenSession {
  /** Stop listening and get the final transcript ('' if nothing heard). */
  stop(): Promise<string>;
  cancel(): void;
}

export class SttError extends Error {
  constructor(
    public code: 'unsupported' | 'denied' | 'network' | 'failed',
    message?: string,
  ) {
    super(message ?? code);
  }
}

type AnyRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recCtor(): (new () => AnyRec) | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => AnyRec; webkitSpeechRecognition?: new () => AnyRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const canRecord = () =>
  typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export function sttAvailable(s: Pick<Settings, 'sttKind' | 'sttUrl'>): boolean {
  if (s.sttKind !== 'webspeech' && s.sttUrl.trim() && canRecord()) return true;
  return !!recCtor();
}

export function startListening(s: Settings, lang: 'zh' | 'en', onInterim?: (t: string) => void): Promise<ListenSession> {
  if (s.sttKind !== 'webspeech' && s.sttUrl.trim() && canRecord()) return startRecorder(s, lang);
  return startWebSpeech(lang, onInterim);
}

function startWebSpeech(lang: 'zh' | 'en', onInterim?: (t: string) => void): Promise<ListenSession> {
  const Ctor = recCtor();
  if (!Ctor) return Promise.reject(new SttError('unsupported'));
  const rec = new Ctor();
  rec.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  const finals: string[] = [];
  let interim = '';
  let ended = false;
  let error: SttError | null = null;
  const endWaiters: (() => void)[] = [];

  rec.onresult = (e) => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const t = r[0]?.transcript ?? '';
      if (r.isFinal) finals[i] = t;
      else interim += t;
    }
    onInterim?.(finals.filter(Boolean).join('') + interim);
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') error = new SttError('denied');
    else if (e.error === 'network') error = new SttError('network');
    else if (e.error !== 'no-speech' && e.error !== 'aborted') error = new SttError('failed', e.error);
  };
  rec.onend = () => {
    ended = true;
    endWaiters.splice(0).forEach((f) => f());
  };

  return new Promise((resolve, reject) => {
    try {
      rec.start();
    } catch (e) {
      reject(new SttError('failed', String(e)));
      return;
    }
    // Surface an immediate permission error instead of a silent session.
    setTimeout(() => {
      if (error?.code === 'denied') return reject(error);
      resolve({
        stop: () =>
          new Promise<string>((res, rej) => {
            const finish = () => {
              if (error && error.code !== 'failed') return rej(error);
              res((finals.filter(Boolean).join('') + interim).trim());
            };
            if (ended) return finish();
            endWaiters.push(finish);
            try {
              rec.stop();
            } catch {
              /* already stopped */
            }
            setTimeout(finish, 2500); // Safari sometimes forgets onend
          }),
        cancel: () => {
          try {
            rec.abort();
          } catch {
            /* ignore */
          }
        },
      });
    }, 120);
  });
}

async function startRecorder(s: Settings, lang: 'zh' | 'en'): Promise<ListenSession> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new SttError('denied');
  }
  const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m));
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mr.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () =>
      new Promise<string>((resolve, reject) => {
        mr.onstop = async () => {
          release();
          const type = mr.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type });
          const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
          const fd = new FormData();
          fd.append('file', blob, `speech.${ext}`);
          if (s.sttKind === 'openai') {
            fd.append('model', s.sttModel || 'whisper-1');
            fd.append('language', lang);
          } else {
            fd.append('response_format', 'json');
            fd.append('language', lang);
            fd.append('temperature', '0');
          }
          try {
            const headers: Record<string, string> = {};
            if (s.sttKind === 'openai' && s.apiKey.trim()) headers.Authorization = `Bearer ${s.apiKey.trim()}`;
            const res = await fetch(s.sttUrl.trim(), { method: 'POST', body: fd, headers });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const j = await res.json();
            resolve(String(j.text ?? '').trim());
          } catch (e) {
            reject(new SttError('network', String(e)));
          }
        };
        mr.stop();
      }),
    cancel: () => {
      mr.onstop = null;
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
      release();
    },
  };
}
