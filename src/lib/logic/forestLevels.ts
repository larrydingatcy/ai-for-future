import type { ForestLevel, ForestProgress, QuestionType } from '../types';

/** One observable thing the child did in the Curious Forest. */
export type ForestEvent =
  | { kind: 'question'; qtype: QuestionType; followUpIndex: number } // 0 = new topic, 1.. = follow-ups in a row
  | { kind: 'challenge'; hasReason: boolean } // said "really?" about an answer
  | { kind: 'compare'; chose: boolean; hasReason: boolean }; // picked one of two views

export function emptyForest(): ForestProgress {
  return {
    id: 'forest',
    completedLevels: [],
    typeCounts: { what: 0, why: 0, how: 0, whatif: 0, really: 0 },
    totalQuestions: 0,
    challenges: 0,
    comparisons: 0,
  };
}

export function satisfies(level: ForestLevel, ev: ForestEvent): boolean {
  const r = level.rule;
  switch (r.type) {
    case 'first_question':
      return ev.kind === 'question';
    case 'ask_type':
      // A spoken "真的吗？" is a 'really' question; tapping the Really button is a challenge event.
      return ev.kind === 'question' && ev.qtype === r.qtype;
    case 'follow_up_streak':
      return ev.kind === 'question' && ev.followUpIndex >= r.count;
    case 'challenge_with_reason':
      return ev.kind === 'challenge' && ev.hasReason;
    case 'compare_choose':
      return ev.kind === 'compare' && ev.chose && ev.hasReason;
  }
}

/** Index of the level the child is working on (= levels.length when all are done). */
export function currentLevelIndex(levels: ForestLevel[], p: ForestProgress): number {
  let i = 0;
  while (i < levels.length && p.completedLevels.includes(levels[i].id)) i++;
  return i;
}

export function isUnlocked(levels: ForestLevel[], p: ForestProgress, id: string): boolean {
  const idx = levels.findIndex((l) => l.id === id);
  return idx >= 0 && idx <= currentLevelIndex(levels, p);
}

/**
 * Apply an event. Levels unlock strictly in order: only the current level can be passed,
 * and at most one level per event so each success gets its own celebration.
 */
export function applyForestEvent(
  levels: ForestLevel[],
  p: ForestProgress,
  ev: ForestEvent,
): { progress: ForestProgress; passed: ForestLevel | null } {
  const next: ForestProgress = {
    ...p,
    typeCounts: { ...p.typeCounts },
    completedLevels: [...p.completedLevels],
  };
  if (ev.kind === 'question') {
    next.totalQuestions += 1;
    next.typeCounts[ev.qtype] = (next.typeCounts[ev.qtype] ?? 0) + 1;
  } else if (ev.kind === 'challenge') {
    next.challenges += 1;
  } else {
    next.comparisons += 1;
  }
  const idx = currentLevelIndex(levels, p);
  const level = levels[idx];
  if (level && satisfies(level, ev)) {
    next.completedLevels.push(level.id);
    return { progress: next, passed: level };
  }
  return { progress: next, passed: null };
}
