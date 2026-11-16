import type { LedgerEntry, LedgerKind, PendingBigStar, Redemption } from '../types';
import { clamp, uid } from '../util';

/** Spendable stars: everything credited minus everything spent. */
export function balance(entries: LedgerEntry[]): number {
  return entries.reduce((s, e) => s + e.amount, 0);
}

/** Lifetime stars earned. Spending never lowers it, so level titles never go backwards. */
export function totalEarned(entries: LedgerEntry[]): number {
  return entries.reduce((s, e) => (e.amount > 0 ? s + e.amount : s), 0);
}

export function makeEntry(kind: LedgerKind, amount: number, reason: string, refId?: string, ts = Date.now()): LedgerEntry {
  if (!Number.isFinite(amount) || amount === 0) throw new Error('ledger amount must be a non-zero number');
  return { id: uid('L'), ts, kind, amount: Math.round(amount), reason, refId };
}

// ---------- Mission big stars (parent-gated) ----------

export function proposeBigStar(
  p: Omit<PendingBigStar, 'id' | 'status' | 'celebrated' | 'ts' | 'stars'> & { stars: number },
  ts = Date.now(),
): PendingBigStar {
  return { ...p, id: uid('B'), stars: clamp(Math.round(p.stars), 1, 3), ts, status: 'pending', celebrated: false };
}

export interface ReviewResult<T> {
  record: T;
  entry?: LedgerEntry;
}

/** Parent confirms (optionally changing the count, 1-3). Credits the ledger exactly once. */
export function confirmBigStar(b: PendingBigStar, finalStars?: number, ts = Date.now()): ReviewResult<PendingBigStar> {
  if (b.status !== 'pending') throw new Error(`big star ${b.id} already ${b.status}`);
  const stars = clamp(Math.round(finalStars ?? b.stars), 1, 3);
  const record: PendingBigStar = { ...b, status: 'confirmed', finalStars: stars, resolvedTs: ts, celebrated: false };
  return { record, entry: makeEntry('big', stars, `mission:${b.missionId}`, b.id, ts) };
}

export function rejectBigStar(b: PendingBigStar, ts = Date.now()): ReviewResult<PendingBigStar> {
  if (b.status !== 'pending') throw new Error(`big star ${b.id} already ${b.status}`);
  return { record: { ...b, status: 'rejected', resolvedTs: ts } };
}

/** Stars waiting for a parent — shown to the child as "on the way". */
export function pendingBigTotal(list: PendingBigStar[]): number {
  return list.filter((b) => b.status === 'pending').reduce((s, b) => s + b.stars, 0);
}

// ---------- Reward redemptions (parent-gated) ----------

/** Stars already promised to pending redemptions; the child cannot double-spend them. */
export function reserved(redemptions: Redemption[]): number {
  return redemptions.filter((r) => r.status === 'pending').reduce((s, r) => s + r.cost, 0);
}

export function available(entries: LedgerEntry[], redemptions: Redemption[]): number {
  return balance(entries) - reserved(redemptions);
}

export function canRequest(cost: number, entries: LedgerEntry[], redemptions: Redemption[]): boolean {
  return cost > 0 && available(entries, redemptions) >= cost;
}

export function requestRedemption(
  reward: { id: string; name: string; cost: number },
  entries: LedgerEntry[],
  redemptions: Redemption[],
  ts = Date.now(),
): Redemption {
  if (!canRequest(reward.cost, entries, redemptions)) throw new Error('not enough stars');
  return { id: uid('R'), rewardId: reward.id, rewardName: reward.name, cost: reward.cost, ts, status: 'pending' };
}

/** Parent confirms: stars are deducted now (never earlier), only if the balance still covers it. */
export function confirmRedemption(r: Redemption, entries: LedgerEntry[], ts = Date.now()): ReviewResult<Redemption> {
  if (r.status !== 'pending') throw new Error(`redemption ${r.id} already ${r.status}`);
  if (balance(entries) < r.cost) throw new Error('not enough stars');
  return {
    record: { ...r, status: 'confirmed', resolvedTs: ts },
    entry: makeEntry('redeem', -r.cost, `reward:${r.rewardName}`, r.id, ts),
  };
}

export function rejectRedemption(r: Redemption, note?: string, ts = Date.now()): ReviewResult<Redemption> {
  if (r.status !== 'pending') throw new Error(`redemption ${r.id} already ${r.status}`);
  return { record: { ...r, status: 'rejected', resolvedTs: ts, note } };
}
