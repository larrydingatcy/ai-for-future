// Small helpers that must work on insecure origins too (http on a LAN has no crypto.randomUUID).

export function uid(prefix = ''): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}

/** Local calendar day, YYYY-MM-DD. */
export function dayKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

/** Whole days from day a to day b (both YYYY-MM-DD). */
export function dayDiff(a: string, b: string): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const ua = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const ub = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((ub - ua) / 86400000);
}

/** Non-cryptographic hash (FNV-1a) — enough to avoid storing the parent PIN in plain text. */
export function hashPin(pin: string): string {
  let h = 0x811c9dc5;
  const s = `aiff:${pin}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const BASE_PATH: string = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
