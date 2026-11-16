import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from '../data/memoryRepo';
import { createDexieRepo } from '../data/dexieRepo';
import type { Repo } from '../data/repo';
import { GameService } from '../services/game';

const repos: [string, () => Repo][] = [
  ['memory', () => createMemoryRepo()],
  ['dexie', () => createDexieRepo(`test-${Math.random()}`)],
];

describe.each(repos)('GameService on %s repo', (_name, make) => {
  const praise = { zh: '好', en: 'good' };

  async function finishMission(g: GameService, id: string, stars = 2) {
    await g.startMission(id);
    await g.award('step', 1, `${id}:understand`);
    return g.submitMission(id, { stars, praise, suggestion: praise });
  }

  it('step stars are instant; big stars wait for the parent; confirm credits + unlocks', async () => {
    const g = new GameService(make());
    const b = await finishMission(g, 'plant-water', 3);
    let w = await g.wallet();
    expect(w.balance).toBe(1);
    expect(w.pendingBig).toBe(3);
    expect((await g.progress('plant-water'))?.status).toBe('awaiting');
    expect((await g.completedMissionIds()).has('plant-water')).toBe(false);
    await expect(g.submitMission('plant-water', { stars: 1, praise, suggestion: praise })).rejects.toThrow();

    await g.confirmBigStar(b.id, 2); // parent lowers to 2
    w = await g.wallet();
    expect(w.balance).toBe(3);
    expect(w.pendingBig).toBe(0);
    expect((await g.progress('plant-water'))?.status).toBe('done');
    expect((await g.completedMissionIds()).has('plant-water')).toBe(true);
    expect((await g.uncelebrated()).map((x) => x.id)).toEqual([b.id]);
    await g.markCelebrated(b.id);
    expect(await g.uncelebrated()).toEqual([]);
    await expect(g.confirmBigStar(b.id)).rejects.toThrow(); // no double credit
    expect((await g.wallet()).balance).toBe(3);
  });

  it('reject sends the child back to step 4 with no stars, resubmit works', async () => {
    const g = new GameService(make());
    const b = await finishMission(g, 'plant-water');
    await g.rejectBigStar(b.id);
    const p = await g.progress('plant-water');
    expect(p?.status).toBe('active');
    expect(p?.step).toBe(4);
    expect((await g.wallet()).balance).toBe(1);
    const b2 = await g.submitMission('plant-water', { stars: 1, praise, suggestion: praise });
    expect(b2.status).toBe('pending');
  });

  it('redemption: request → confirm deducts; reject keeps; history kept', async () => {
    const g = new GameService(make());
    await g.award('step', 5, 'test');
    const reward = await g.saveReward({ name: '公园', cost: 4, active: true });
    const r = await g.requestRedemption(reward.id);
    let w = await g.wallet();
    expect(w.balance).toBe(5);
    expect(w.available).toBe(1);
    await expect(g.requestRedemption(reward.id)).rejects.toThrow();
    await g.confirmRedemption(r.id);
    w = await g.wallet();
    expect(w.balance).toBe(1);
    expect(w.totalEarned).toBe(5);
    const small = await g.saveReward({ name: '贴纸', cost: 1, active: true });
    const r2 = await g.requestRedemption(small.id);
    await g.rejectRedemption(r2.id, 'later');
    expect((await g.wallet()).balance).toBe(1);
    const hist = await g.repo.redemptions.all();
    expect(hist.map((h) => h.status).sort()).toEqual(['confirmed', 'rejected']);
  });

  it('daily login is awarded once per day and persisted', async () => {
    const g = new GameService(make());
    expect((await g.dailyLogin('2026-11-16')).firstToday).toBe(true);
    expect((await g.dailyLogin('2026-11-16')).firstToday).toBe(false);
    expect((await g.dailyLogin('2026-11-17')).profile.streak).toBe(2);
    expect((await g.wallet()).balance).toBe(2);
  });

  it('forest level passes award stars exactly at unlock', async () => {
    const g = new GameService(make());
    const r = await g.forestEvent({ kind: 'question', qtype: 'what', followUpIndex: 0 });
    expect(r.passed?.id).toBe('L1');
    expect(r.entry?.amount).toBe(1);
    const r2 = await g.forestEvent({ kind: 'question', qtype: 'what', followUpIndex: 0 });
    expect(r2.passed).toBeNull();
    expect((await g.forest()).totalQuestions).toBe(2);
  });

  it('custom missions need approval; presets can be disabled', async () => {
    const g = new GameService(make());
    const base = (await g.missions())[0];
    await g.saveCustomMission({ ...base, id: 'new-1', source: 'ai', status: 'pending', enabled: false, createdTs: 1 });
    expect((await g.missions()).some((m) => m.id === 'new-1')).toBe(false);
    await g.reviewCustomMission('new-1', true);
    expect((await g.missions()).some((m) => m.id === 'new-1')).toBe(true);
    await g.saveCustomMission({ ...base, source: 'preset-edit', status: 'approved', enabled: false, createdTs: 2 });
    expect((await g.missions()).some((m) => m.id === base.id)).toBe(false);
    expect((await g.missions({ includeDisabled: true })).some((m) => m.id === base.id)).toBe(true);
  });

  it('usage & time limit', async () => {
    const g = new GameService(make());
    await g.addUsage(29 * 60, '2026-11-16');
    expect(await g.remainingSeconds('2026-11-16')).toBe(60);
    await g.extendToday(10, '2026-11-16');
    expect(await g.remainingSeconds('2026-11-16')).toBe(660);
  });

  it('export → import round-trips everything', async () => {
    const g = new GameService(make());
    await g.award('step', 2, 'x');
    await g.saveSettings({ lang: 'both' });
    const backup = await g.repo.exportAll();
    const g2 = new GameService(make());
    await g2.repo.importAll(JSON.parse(JSON.stringify(backup)));
    expect((await g2.wallet()).balance).toBe(2);
    expect((await g2.settings()).lang).toBe('both');
    await expect(g2.repo.importAll({} as never)).rejects.toThrow();
  });

  it('transactions roll back on error', async () => {
    const g = new GameService(make());
    await expect(
      g.repo.transaction(async () => {
        await g.repo.ledger.put({ id: 'x', ts: 1, amount: 5, kind: 'step', reason: 'x' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect((await g.wallet()).balance).toBe(0);
  });
});
