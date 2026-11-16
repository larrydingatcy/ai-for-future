import { describe, expect, it } from 'vitest';
import * as L from '../logic/ledger';
import type { LedgerEntry } from '../types';

const earn = (n: number): LedgerEntry => L.makeEntry('step', n, 'x');

describe('ledger', () => {
  it('balance and lifetime total', () => {
    const e = [earn(3), earn(2), L.makeEntry('redeem', -4, 'r')];
    expect(L.balance(e)).toBe(1);
    expect(L.totalEarned(e)).toBe(5);
  });

  it('rejects zero / NaN entries', () => {
    expect(() => L.makeEntry('step', 0, 'x')).toThrow();
    expect(() => L.makeEntry('step', NaN, 'x')).toThrow();
  });

  it('big stars: pending → confirm credits once, clamped 1..3', () => {
    const b = L.proposeBigStar({ missionId: 'm', stars: 7, praise: { zh: '', en: '' }, suggestion: { zh: '', en: '' } });
    expect(b.status).toBe('pending');
    expect(b.stars).toBe(3);
    const { record, entry } = L.confirmBigStar(b, 2);
    expect(record.status).toBe('confirmed');
    expect(record.finalStars).toBe(2);
    expect(entry?.amount).toBe(2);
    expect(entry?.kind).toBe('big');
    expect(() => L.confirmBigStar(record)).toThrow();
    expect(() => L.rejectBigStar(record)).toThrow();
  });

  it('big stars: reject gives nothing', () => {
    const b = L.proposeBigStar({ missionId: 'm', stars: 2, praise: { zh: '', en: '' }, suggestion: { zh: '', en: '' } });
    const r = L.rejectBigStar(b);
    expect(r.record.status).toBe('rejected');
    expect(r.entry).toBeUndefined();
    expect(L.pendingBigTotal([b, r.record])).toBe(2);
  });

  it('redemption: request needs available stars, reserves them, deducts only on confirm', () => {
    const entries = [earn(5)];
    const reward = { id: 'w', name: 'ice cream', cost: 3 };
    const r1 = L.requestRedemption(reward, entries, []);
    expect(r1.status).toBe('pending');
    expect(L.balance(entries)).toBe(5); // nothing deducted yet
    expect(L.available(entries, [r1])).toBe(2);
    expect(() => L.requestRedemption(reward, entries, [r1])).toThrow(); // can't double-spend
    const { record, entry } = L.confirmRedemption(r1, entries);
    expect(record.status).toBe('confirmed');
    expect(entry?.amount).toBe(-3);
    const after = [...entries, entry!];
    expect(L.balance(after)).toBe(2);
    expect(L.totalEarned(after)).toBe(5);
    expect(() => L.confirmRedemption(record, after)).toThrow();
  });

  it('redemption: confirm fails if balance dropped, reject keeps balance', () => {
    const r = L.requestRedemption({ id: 'w', name: 'x', cost: 3 }, [earn(3)], []);
    expect(() => L.confirmRedemption(r, [earn(2)])).toThrow();
    const rej = L.rejectRedemption(r, 'later');
    expect(rej.record.status).toBe('rejected');
    expect(rej.entry).toBeUndefined();
    expect(L.available([earn(3)], [rej.record])).toBe(3);
  });
});
