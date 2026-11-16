import type { LedgerEntry, Profile } from '../types';
import { dayDiff } from '../util';
import { makeEntry } from './ledger';

export const DAILY_BONUS = 1;
export const STREAK_DAYS = 7;
export const STREAK_BONUS = 5;

export interface LoginResult {
  profile: Profile;
  entries: LedgerEntry[]; // 0, 1 or 2 ledger rows to append
  firstToday: boolean;
  streakBonus: boolean;
}

/**
 * Daily check-in. First open of a day: +1. Consecutive days build a streak;
 * every 7th consecutive day (7, 14, 21…) adds +5. Missing a day resets the streak to 1.
 */
export function dailyLogin(profile: Profile, today: string, ts = Date.now()): LoginResult {
  if (profile.lastLoginDay === today) return { profile, entries: [], firstToday: false, streakBonus: false };
  let streak = 1;
  if (profile.lastLoginDay) {
    const gap = dayDiff(profile.lastLoginDay, today);
    if (gap < 0) {
      // Clock went backwards (device time changed). Don't award again, keep the streak.
      return { profile, entries: [], firstToday: false, streakBonus: false };
    }
    streak = gap === 1 ? profile.streak + 1 : 1;
  }
  const entries = [makeEntry('daily', DAILY_BONUS, `daily:${today}`, today, ts)];
  const streakBonus = streak % STREAK_DAYS === 0;
  if (streakBonus) entries.push(makeEntry('streak', STREAK_BONUS, `streak:${streak}`, today, ts));
  return {
    profile: { ...profile, lastLoginDay: today, streak, bestStreak: Math.max(profile.bestStreak, streak) },
    entries,
    firstToday: true,
    streakBonus,
  };
}
