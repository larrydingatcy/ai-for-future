import missionsJson from '@content/missions.json';
import forestLevelsJson from '@content/forest-levels.json';
import type { Repo } from '../data/repo';
import * as L from '../logic/ledger';
import { dailyLogin as computeLogin, type LoginResult } from '../logic/streak';
import { applyForestEvent, emptyForest, type ForestEvent } from '../logic/forestLevels';
import { completedIds } from '../logic/missionPicker';
import { DEFAULT_SETTINGS } from '../settings';
import type {
  CustomMission,
  DailyUsage,
  ForestLevel,
  ForestProgress,
  InfoCard,
  LedgerEntry,
  LedgerKind,
  LogMessage,
  Mission,
  MissionProgress,
  PendingBigStar,
  Profile,
  Redemption,
  Reward,
  Settings,
} from '../types';
import { dayKey, uid } from '../util';

export const PRESET_MISSIONS = missionsJson as Mission[];
export const FOREST_LEVELS = forestLevelsJson as ForestLevel[];

export interface Wallet {
  balance: number; // credited − spent
  available: number; // balance − reserved by pending redemptions
  totalEarned: number; // lifetime, drives the level title
  pendingBig: number; // mission stars waiting for a parent
  reserved: number;
}

/**
 * All game state changes go through here. UI never writes to the repo directly,
 * which keeps the star rules in one tested place.
 */
export class GameService {
  constructor(
    public repo: Repo,
    private presets: Mission[] = PRESET_MISSIONS,
    public forestLevels: ForestLevel[] = FOREST_LEVELS,
  ) {}

  // ---------- settings / profile ----------

  async settings(): Promise<Settings> {
    const s = await this.repo.settings.get('settings');
    return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await this.settings()), ...patch, id: 'settings' as const };
    await this.repo.settings.put(next);
    return next;
  }

  async profile(): Promise<Profile> {
    return (await this.repo.profile.get('profile')) ?? { id: 'profile', streak: 0, bestStreak: 0, createdTs: Date.now() };
  }

  /** Call once when the child starts playing. Awards the daily +1 and the 7-day +5. */
  async dailyLogin(today = dayKey()): Promise<LoginResult> {
    return this.repo.transaction(async () => {
      const res = computeLogin(await this.profile(), today);
      if (res.firstToday) {
        await this.repo.profile.put(res.profile);
        await this.repo.ledger.bulkPut(res.entries);
      }
      return res;
    });
  }

  // ---------- stars ----------

  async award(kind: LedgerKind, amount: number, reason: string, refId?: string): Promise<LedgerEntry> {
    if (amount <= 0) throw new Error('award must be positive');
    const e = L.makeEntry(kind, amount, reason, refId);
    await this.repo.ledger.put(e);
    return e;
  }

  async wallet(): Promise<Wallet> {
    const [entries, reds, bigs] = await Promise.all([
      this.repo.ledger.all(),
      this.repo.redemptions.all(),
      this.repo.bigStars.all(),
    ]);
    return {
      balance: L.balance(entries),
      available: L.available(entries, reds),
      totalEarned: L.totalEarned(entries),
      pendingBig: L.pendingBigTotal(bigs),
      reserved: L.reserved(reds),
    };
  }

  // ---------- missions ----------

  /** Presets merged with parent edits, plus approved parent/AI missions; disabled ones hidden. */
  async missions(opts: { includeDisabled?: boolean } = {}): Promise<Mission[]> {
    const custom = await this.repo.missions.all();
    const byId = new Map(custom.map((c) => [c.id, c]));
    const out: Mission[] = [];
    for (const p of this.presets) {
      const edit = byId.get(p.id);
      if (edit && edit.status === 'approved') {
        if (edit.enabled || opts.includeDisabled) out.push(stripCustom(edit));
      } else {
        out.push(p);
      }
    }
    for (const c of custom.sort((a, b) => a.createdTs - b.createdTs)) {
      if (this.presets.some((p) => p.id === c.id)) continue;
      if (c.status === 'approved' && (c.enabled || opts.includeDisabled)) out.push(stripCustom(c));
    }
    return out;
  }

  async saveCustomMission(m: CustomMission): Promise<void> {
    await this.repo.missions.put(m);
  }

  async reviewCustomMission(id: string, approve: boolean): Promise<void> {
    const m = await this.repo.missions.get(id);
    if (!m) throw new Error('mission not found');
    await this.repo.missions.put({ ...m, status: approve ? 'approved' : 'rejected', enabled: approve });
  }

  async progress(missionId: string): Promise<MissionProgress | undefined> {
    return this.repo.progress.get(missionId);
  }

  async startMission(missionId: string): Promise<MissionProgress> {
    const existing = await this.repo.progress.get(missionId);
    if (existing) return existing;
    const now = Date.now();
    const p: MissionProgress = {
      missionId,
      status: 'active',
      step: 1,
      startedTs: now,
      updatedTs: now,
      retellAttempts: 0,
      understood: false,
      cardIds: [],
      planImproved: false,
      planDone: false,
      reflections: [],
      reflectionDone: false,
      attempts: 0,
    };
    await this.repo.progress.put(p);
    return p;
  }

  async saveProgress(p: MissionProgress): Promise<MissionProgress> {
    const next = { ...p, updatedTs: Date.now() };
    await this.repo.progress.put(next);
    return next;
  }

  async addCard(card: Omit<InfoCard, 'id' | 'ts'>): Promise<InfoCard> {
    const c: InfoCard = { ...card, id: uid('C'), ts: Date.now() };
    await this.repo.cards.put(c);
    return c;
  }

  /** Step 4 done: 小星 proposes big stars; they wait for a parent. */
  async submitMission(
    missionId: string,
    proposal: { stars: number; praise: PendingBigStar['praise']; suggestion: PendingBigStar['suggestion']; resultImage?: string },
  ): Promise<PendingBigStar> {
    return this.repo.transaction(async () => {
      const p = await this.repo.progress.get(missionId);
      if (!p) throw new Error('mission not started');
      const existing = (await this.repo.bigStars.where('missionId', missionId)).find((b) => b.status !== 'rejected');
      if (existing) throw new Error('mission already submitted');
      const b = L.proposeBigStar({ missionId, ...proposal });
      await this.repo.bigStars.put(b);
      await this.repo.progress.put({
        ...p,
        status: 'awaiting',
        completedTs: Date.now(),
        bigStarId: b.id,
        attempts: p.attempts + 1,
        updatedTs: Date.now(),
      });
      return b;
    });
  }

  async confirmBigStar(id: string, finalStars?: number): Promise<PendingBigStar> {
    return this.repo.transaction(async () => {
      const b = await this.repo.bigStars.get(id);
      if (!b) throw new Error('not found');
      const { record, entry } = L.confirmBigStar(b, finalStars);
      await this.repo.bigStars.put(record);
      if (entry) await this.repo.ledger.put(entry);
      const p = await this.repo.progress.get(b.missionId);
      if (p) await this.repo.progress.put({ ...p, status: 'done', updatedTs: Date.now() });
      return record;
    });
  }

  /** Parent says "not yet": no stars, the child can redo the final step. */
  async rejectBigStar(id: string): Promise<PendingBigStar> {
    return this.repo.transaction(async () => {
      const b = await this.repo.bigStars.get(id);
      if (!b) throw new Error('not found');
      const { record } = L.rejectBigStar(b);
      await this.repo.bigStars.put(record);
      const p = await this.repo.progress.get(b.missionId);
      if (p)
        await this.repo.progress.put({
          ...p,
          status: 'active',
          step: 4,
          resultImage: undefined,
          reflections: [],
          reflectionDone: false,
          bigStarId: undefined,
          updatedTs: Date.now(),
        });
      return record;
    });
  }

  async completedMissionIds(): Promise<Set<string>> {
    return completedIds(await this.repo.bigStars.all());
  }

  /** Confirmed missions whose celebration the child hasn't seen yet. */
  async uncelebrated(): Promise<PendingBigStar[]> {
    return (await this.repo.bigStars.where('status', 'confirmed')).filter((b) => !b.celebrated);
  }

  async markCelebrated(id: string): Promise<void> {
    const b = await this.repo.bigStars.get(id);
    if (b) await this.repo.bigStars.put({ ...b, celebrated: true });
  }

  // ---------- rewards ----------

  async rewards(includeInactive = false): Promise<Reward[]> {
    const all = (await this.repo.rewards.all()).sort((a, b) => a.cost - b.cost || a.createdTs - b.createdTs);
    return includeInactive ? all : all.filter((r) => r.active);
  }

  async saveReward(r: Omit<Reward, 'id' | 'createdTs'> & { id?: string; createdTs?: number }): Promise<Reward> {
    if (!r.name.trim()) throw new Error('name required');
    if (!(r.cost > 0)) throw new Error('cost must be positive');
    const rec: Reward = { ...r, id: r.id ?? uid('W'), createdTs: r.createdTs ?? Date.now(), cost: Math.round(r.cost) };
    await this.repo.rewards.put(rec);
    return rec;
  }

  async deleteReward(id: string): Promise<void> {
    await this.repo.rewards.delete(id);
  }

  async requestRedemption(rewardId: string): Promise<Redemption> {
    return this.repo.transaction(async () => {
      const reward = await this.repo.rewards.get(rewardId);
      if (!reward || !reward.active) throw new Error('reward not available');
      const r = L.requestRedemption(reward, await this.repo.ledger.all(), await this.repo.redemptions.all());
      await this.repo.redemptions.put(r);
      return r;
    });
  }

  async confirmRedemption(id: string): Promise<Redemption> {
    return this.repo.transaction(async () => {
      const r = await this.repo.redemptions.get(id);
      if (!r) throw new Error('not found');
      const { record, entry } = L.confirmRedemption(r, await this.repo.ledger.all());
      await this.repo.redemptions.put(record);
      if (entry) await this.repo.ledger.put(entry);
      return record;
    });
  }

  async rejectRedemption(id: string, note?: string): Promise<Redemption> {
    const r = await this.repo.redemptions.get(id);
    if (!r) throw new Error('not found');
    const { record } = L.rejectRedemption(r, note);
    await this.repo.redemptions.put(record);
    return record;
  }

  // ---------- curious forest ----------

  async forest(): Promise<ForestProgress> {
    return (await this.repo.forest.get('forest')) ?? emptyForest();
  }

  /** Record a forest behaviour; if it passes the current level, award that level's stars. */
  async forestEvent(ev: ForestEvent): Promise<{ progress: ForestProgress; passed: ForestLevel | null; entry?: LedgerEntry }> {
    return this.repo.transaction(async () => {
      const { progress, passed } = applyForestEvent(this.forestLevels, await this.forest(), ev);
      await this.repo.forest.put(progress);
      let entry: LedgerEntry | undefined;
      if (passed && passed.reward_stars > 0) {
        entry = L.makeEntry('forest', passed.reward_stars, `level:${passed.id}`, passed.id);
        await this.repo.ledger.put(entry);
      }
      return { progress, passed, entry };
    });
  }

  // ---------- logs & usage ----------

  async log(m: Omit<LogMessage, 'id' | 'ts' | 'day'>): Promise<LogMessage> {
    const ts = Date.now();
    const rec: LogMessage = { ...m, id: uid('M'), ts, day: dayKey(ts) };
    await this.repo.logs.put(rec);
    return rec;
  }

  async usage(day = dayKey()): Promise<DailyUsage> {
    return (await this.repo.usage.get(day)) ?? { day, activeSeconds: 0, extraMinutes: 0 };
  }

  async addUsage(seconds: number, day = dayKey()): Promise<DailyUsage> {
    const u = await this.usage(day);
    const next = { ...u, activeSeconds: u.activeSeconds + Math.max(0, seconds) };
    await this.repo.usage.put(next);
    return next;
  }

  async extendToday(minutes: number, day = dayKey()): Promise<DailyUsage> {
    const u = await this.usage(day);
    const next = { ...u, extraMinutes: u.extraMinutes + minutes };
    await this.repo.usage.put(next);
    return next;
  }

  /** Seconds left today (can be negative). */
  async remainingSeconds(day = dayKey()): Promise<number> {
    const [s, u] = await Promise.all([this.settings(), this.usage(day)]);
    return (s.dailyLimitMin + u.extraMinutes) * 60 - u.activeSeconds;
  }
}

function stripCustom(c: CustomMission): Mission {
  const { source: _s, status: _st, enabled: _e, createdTs: _c, ...m } = c;
  return m;
}
