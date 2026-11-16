import type { Bi, Lang } from './types';

export const bi = (zh: string, en: string): Bi => ({ zh, en });

/** Text to display for the current language setting. */
export function pick(b: Bi, lang: Lang): string {
  const zh = b.zh?.trim() ?? '';
  const en = b.en?.trim() ?? '';
  if (lang === 'zh') return zh || en;
  if (lang === 'en') return en || zh;
  if (zh && en && zh !== en) return `${zh}\n${en}`;
  return zh || en;
}

/** Segments to speak, each with its own voice language. */
export function speakParts(b: Bi, lang: Lang): { text: string; lang: 'zh' | 'en' }[] {
  const zh = b.zh?.trim() ?? '';
  const en = b.en?.trim() ?? '';
  if (lang === 'zh') return zh ? [{ text: zh, lang: 'zh' }] : en ? [{ text: en, lang: 'en' }] : [];
  if (lang === 'en') return en ? [{ text: en, lang: 'en' }] : zh ? [{ text: zh, lang: 'zh' }] : [];
  const out: { text: string; lang: 'zh' | 'en' }[] = [];
  if (zh) out.push({ text: zh, lang: 'zh' });
  if (en && en !== zh) out.push({ text: en, lang: 'en' });
  return out;
}

export const missionTitle = (m: { title_zh: string; title_en: string }): Bi => bi(m.title_zh, m.title_en);
export const missionBrief = (m: { brief_zh: string; brief_en: string }): Bi => bi(m.brief_zh, m.brief_en);

/** Join several Bi values with a separator. */
export function joinBi(parts: Bi[], sep = ' '): Bi {
  return {
    zh: parts.map((p) => p.zh).filter(Boolean).join(sep === ' ' ? '' : sep),
    en: parts.map((p) => p.en).filter(Boolean).join(sep),
  };
}
