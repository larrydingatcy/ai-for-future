import type { Mission, MissionProgress, PendingBigStar } from '../types';

/** A mission is completed once a parent confirmed its big stars. */
export function completedIds(bigStars: PendingBigStar[]): Set<string> {
  return new Set(bigStars.filter((b) => b.status === 'confirmed').map((b) => b.missionId));
}

export function isMissionUnlocked(m: Mission, done: Set<string>): boolean {
  return m.unlock_requires.every((id) => done.has(id));
}

/**
 * Adaptive target difficulty: start at 1; after strong results (avg ≥ 2.5 big stars over the
 * last two missions) go up one, after weak ones (avg ≤ 1.5) go down one.
 */
export function targetDifficulty(missions: Mission[], bigStars: PendingBigStar[]): number {
  const confirmed = bigStars
    .filter((b) => b.status === 'confirmed')
    .sort((a, b) => (a.resolvedTs ?? a.ts) - (b.resolvedTs ?? b.ts));
  if (confirmed.length === 0) return 1;
  const diffOf = (id: string) => missions.find((m) => m.id === id)?.difficulty ?? 1;
  const recent = confirmed.slice(-2);
  const avg = recent.reduce((s, b) => s + (b.finalStars ?? b.stars), 0) / recent.length;
  const lastDiff = diffOf(recent[recent.length - 1].missionId);
  const t = avg >= 2.5 ? lastDiff + 1 : avg <= 1.5 ? lastDiff - 1 : lastDiff;
  return Math.max(1, Math.min(3, t));
}

/**
 * Which mission 小星 recommends next: an in-progress one first, otherwise the unlocked,
 * not-yet-completed mission closest to the target difficulty (ties: list order).
 */
export function pickMission(
  missions: Mission[],
  bigStars: PendingBigStar[],
  progress: MissionProgress[],
): Mission | null {
  const done = completedIds(bigStars);
  const active = progress
    .filter((p) => p.status === 'active')
    .sort((a, b) => b.updatedTs - a.updatedTs)
    .map((p) => missions.find((m) => m.id === p.missionId))
    .find((m): m is Mission => !!m && !done.has(m.id));
  if (active) return active;
  const awaiting = new Set(progress.filter((p) => p.status === 'awaiting').map((p) => p.missionId));
  const candidates = missions.filter((m) => !done.has(m.id) && !awaiting.has(m.id) && isMissionUnlocked(m, done));
  if (candidates.length === 0) return null;
  const target = targetDifficulty(missions, bigStars);
  let best = candidates[0];
  for (const c of candidates) {
    if (Math.abs(c.difficulty - target) < Math.abs(best.difficulty - target)) best = c;
  }
  return best;
}
