// Sound effects synthesised with WebAudio — no audio files to download or cache.

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

/** Must run inside a user gesture on iOS. */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return;
  if (!ctx) ctx = new C();
  if (ctx.state === 'suspended') void ctx.resume();
  // A silent buffer fully unlocks output on older iOS.
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18, slideTo?: number) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  tap() {
    tone(660, 0, 0.08, 'triangle', 0.12, 880);
  },
  pop() {
    tone(420, 0, 0.12, 'sine', 0.2, 900);
  },
  listenStart() {
    tone(523, 0, 0.1, 'sine', 0.15);
    tone(784, 0.08, 0.12, 'sine', 0.15);
  },
  listenStop() {
    tone(784, 0, 0.1, 'sine', 0.13);
    tone(523, 0.08, 0.12, 'sine', 0.13);
  },
  star(count = 1) {
    const notes = [1047, 1319, 1568, 2093];
    for (let i = 0; i < Math.min(6, count + 1); i++) tone(notes[i % notes.length], i * 0.09, 0.25, 'triangle', 0.16);
    tone(2637, Math.min(6, count + 1) * 0.09, 0.4, 'sine', 0.08);
  },
  fanfare() {
    const seq: [number, number, number][] = [
      [523, 0, 0.16],
      [659, 0.15, 0.16],
      [784, 0.3, 0.16],
      [1047, 0.45, 0.5],
      [784, 0.45, 0.5],
      [659, 0.45, 0.5],
    ];
    for (const [f, s, d] of seq) tone(f, s, d, 'square', 0.07);
    for (let i = 0; i < 8; i++) tone(1500 + Math.random() * 1500, 0.6 + i * 0.07, 0.15, 'triangle', 0.05);
  },
  unlock() {
    tone(392, 0, 0.12, 'triangle', 0.15);
    tone(587, 0.1, 0.12, 'triangle', 0.15);
    tone(784, 0.2, 0.3, 'triangle', 0.15);
  },
  soft() {
    tone(330, 0, 0.18, 'sine', 0.12, 262);
  },
  camera() {
    if (!ctx || muted) return;
    const len = 0.08;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = 0.15;
    src.buffer = buf;
    src.connect(g).connect(ctx.destination);
    src.start();
  },
};
