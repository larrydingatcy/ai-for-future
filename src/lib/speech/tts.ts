// Text-to-speech on top of the browser's speechSynthesis. Swappable: anything that implements
// speak(parts) / cancel() can replace it (e.g. a cloud TTS) without touching the UI.

export type SpeakPart = { text: string; lang: 'zh' | 'en' };

export interface TtsOptions {
  voiceZh?: string; // voiceURI
  voiceEn?: string;
  rate?: number;
}

type Listener = (speaking: boolean) => void;

const PREFERRED: Record<'zh' | 'en', RegExp> = {
  zh: /Tingting|Ting-Ting|Xiaoxiao|Yaoyao|Meijia|Huihui|Google 普通话|Mandarin/i,
  en: /Samantha|Ava|Allison|Google US English|Jenny|Aria|Karen/i,
};

class Tts {
  private listeners = new Set<Listener>();
  private token = 0;
  private _speaking = false;

  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  get speaking() {
    return this._speaking;
  }

  onChange(l: Listener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  private set(v: boolean) {
    if (this._speaking === v) return;
    this._speaking = v;
    this.listeners.forEach((l) => l(v));
  }

  voices(): SpeechSynthesisVoice[] {
    return this.supported ? window.speechSynthesis.getVoices() : [];
  }

  voicesFor(lang: 'zh' | 'en') {
    return this.voices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang));
  }

  pickVoice(lang: 'zh' | 'en', uri?: string): SpeechSynthesisVoice | undefined {
    const list = this.voicesFor(lang);
    if (uri) {
      const v = list.find((x) => x.voiceURI === uri);
      if (v) return v;
    }
    const region = lang === 'zh' ? /zh-(cn|hans)/i : /en-us/i;
    return (
      list.find((v) => region.test(v.lang) && PREFERRED[lang].test(v.name)) ??
      list.find((v) => region.test(v.lang)) ??
      list.find((v) => PREFERRED[lang].test(v.name)) ??
      list[0]
    );
  }

  /** iOS only allows speech after a user gesture; call this from the start splash tap. */
  unlock() {
    if (!this.supported) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }

  cancel() {
    this.token++;
    if (this.supported) window.speechSynthesis.cancel();
    this.set(false);
  }

  /** Speak parts in order. Resolves when finished or interrupted by a newer speak/cancel. */
  async speak(parts: SpeakPart[], opts: TtsOptions = {}): Promise<void> {
    if (!this.supported || parts.length === 0) return;
    this.cancel();
    const my = ++this.token;
    this.set(true);
    try {
      for (const p of parts) {
        if (my !== this.token) return;
        await this.one(p, opts, my);
      }
    } finally {
      if (my === this.token) this.set(false);
    }
  }

  private one(p: SpeakPart, opts: TtsOptions, my: number): Promise<void> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(p.text);
      u.lang = p.lang === 'zh' ? 'zh-CN' : 'en-US';
      const v = this.pickVoice(p.lang, p.lang === 'zh' ? opts.voiceZh : opts.voiceEn);
      if (v) u.voice = v;
      u.rate = opts.rate ?? 0.9;
      u.pitch = 1.15;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        resolve();
      };
      // Safari occasionally never fires onend; don't let the UI hang.
      const est = (p.lang === 'zh' ? 320 : 90) * p.text.length + 2500;
      const guard = setTimeout(done, est / (u.rate || 1));
      u.onend = done;
      u.onerror = done;
      if (my !== this.token) return done();
      window.speechSynthesis.speak(u);
    });
  }
}

export const tts = new Tts();
