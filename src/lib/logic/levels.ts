import type { Bi } from '../types';

export interface LevelTitle {
  index: number;
  min: number; // lifetime stars needed
  icon: string;
  title: Bi;
}

export const LEVEL_TITLES: LevelTitle[] = [
  { index: 0, min: 0, icon: '🐣', title: { zh: '小探索者', en: 'Little Explorer' } },
  { index: 1, min: 15, icon: '❓', title: { zh: '小提问家', en: 'Little Questioner' } },
  { index: 2, min: 40, icon: '🔍', title: { zh: '小侦探', en: 'Little Detective' } },
  { index: 3, min: 80, icon: '💡', title: { zh: '小发明家', en: 'Little Inventor' } },
  { index: 4, min: 140, icon: '🚀', title: { zh: '未来创想家', en: 'Future Creator' } },
];

export function levelFor(totalEarned: number): LevelTitle {
  let cur = LEVEL_TITLES[0];
  for (const l of LEVEL_TITLES) if (totalEarned >= l.min) cur = l;
  return cur;
}

/** Progress to the next title, 0..1 (1 at the top title). */
export function levelProgress(totalEarned: number): { cur: LevelTitle; next?: LevelTitle; ratio: number } {
  const cur = levelFor(totalEarned);
  const next = LEVEL_TITLES[cur.index + 1];
  if (!next) return { cur, ratio: 1 };
  return { cur, next, ratio: (totalEarned - cur.min) / (next.min - cur.min) };
}

/** True when going from `before` to `after` crosses into a new title. */
export function leveledUp(before: number, after: number): LevelTitle | null {
  const a = levelFor(before);
  const b = levelFor(after);
  return b.index > a.index ? b : null;
}
