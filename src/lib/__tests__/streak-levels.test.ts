import { describe, expect, it } from 'vitest';
import { dailyLogin } from '../logic/streak';
import { levelFor, leveledUp, levelProgress, LEVEL_TITLES } from '../logic/levels';
import type { Profile } from '../types';
import { dayDiff } from '../util';

const fresh: Profile = { id: 'profile', streak: 0, bestStreak: 0, createdTs: 0 };

function days(start: string, n: number): string[] {
  const d = new Date(`${start}T12:00:00`);
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getTime() + i * 86400000);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  });
}

describe('daily login & streak', () => {
  it('first login of the day +1, second is a no-op', () => {
    const a = dailyLogin(fresh, '2026-11-16');
    expect(a.firstToday).toBe(true);
    expect(a.entries.map((e) => e.amount)).toEqual([1]);
    const b = dailyLogin(a.profile, '2026-11-16');
    expect(b.firstToday).toBe(false);
    expect(b.entries).toEqual([]);
  });

  it('7 consecutive days → +5 on day 7 (and day 14), total 7*1+5', () => {
    let p = fresh;
    let total = 0;
    const bonusDays: number[] = [];
    days('2026-02-25', 14).forEach((d, i) => {
      const r = dailyLogin(p, d);
      p = r.profile;
      total += r.entries.reduce((s, e) => s + e.amount, 0);
      if (r.streakBonus) bonusDays.push(i + 1);
    });
    expect(bonusDays).toEqual([7, 14]);
    expect(total).toBe(14 + 10);
    expect(p.streak).toBe(14);
  });

  it('a missed day resets the streak', () => {
    let p = fresh;
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03']) p = dailyLogin(p, d).profile;
    expect(p.streak).toBe(3);
    p = dailyLogin(p, '2026-11-05').profile;
    expect(p.streak).toBe(1);
    expect(p.bestStreak).toBe(3);
  });

  it('clock going backwards does not award', () => {
    const p = dailyLogin(fresh, '2026-11-10').profile;
    expect(dailyLogin(p, '2026-11-09').entries).toEqual([]);
  });

  it('dayDiff across month/year boundaries', () => {
    expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1);
    expect(dayDiff('2028-02-28', '2028-03-01')).toBe(2);
  });
});

describe('level titles', () => {
  it('ordered titles from 小探索者 to 未来创想家', () => {
    expect(LEVEL_TITLES.map((l) => l.title.zh)).toEqual(['小探索者', '小提问家', '小侦探', '小发明家', '未来创想家']);
  });
  it('thresholds', () => {
    expect(levelFor(0).title.zh).toBe('小探索者');
    expect(levelFor(14).title.zh).toBe('小探索者');
    expect(levelFor(15).title.zh).toBe('小提问家');
    expect(levelFor(40).title.zh).toBe('小侦探');
    expect(levelFor(80).title.zh).toBe('小发明家');
    expect(levelFor(1000).title.zh).toBe('未来创想家');
  });
  it('level up detection and progress', () => {
    expect(leveledUp(14, 15)?.title.zh).toBe('小提问家');
    expect(leveledUp(15, 20)).toBeNull();
    expect(levelProgress(140).ratio).toBe(1);
    expect(levelProgress(20).ratio).toBeCloseTo(5 / 25);
  });
});
