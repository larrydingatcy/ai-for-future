import { describe, expect, it } from 'vitest';
import levels from '@content/forest-levels.json';
import missions from '@content/missions.json';
import { applyForestEvent, currentLevelIndex, emptyForest, isUnlocked, type ForestEvent } from '../logic/forestLevels';
import { isMissionUnlocked, pickMission, targetDifficulty } from '../logic/missionPicker';
import type { ForestLevel, Mission, MissionProgress, PendingBigStar, QuestionType } from '../types';

const LV = levels as ForestLevel[];
const MS = missions as Mission[];

function run(events: ForestEvent[]) {
  let p = emptyForest();
  const passed: string[] = [];
  for (const e of events) {
    const r = applyForestEvent(LV, p, e);
    p = r.progress;
    if (r.passed) passed.push(r.passed.id);
  }
  return { p, passed };
}

const q = (qtype: QuestionType, followUpIndex = 0): ForestEvent => ({
  kind: 'question',
  qtype,
  followUpIndex,
});

describe('forest levels ①–⑥ unlock linearly', () => {
  it('content has 6 levels in the spec order', () => {
    expect(LV.map((l) => l.rule.type)).toEqual([
      'first_question',
      'ask_type',
      'follow_up_streak',
      'ask_type',
      'challenge_with_reason',
      'compare_choose',
    ]);
  });

  it('full happy path', () => {
    const { p, passed } = run([
      q('what'), // ① first question
      q('why'), // ② why
      q('what', 1),
      q('how', 2),
      q('what', 3), // ③ three follow-ups in a row
      q('whatif'), // ④
      { kind: 'challenge', hasReason: true }, // ⑤
      { kind: 'compare', chose: true, hasReason: true }, // ⑥
    ]);
    expect(passed).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
    expect(currentLevelIndex(LV, p)).toBe(6);
    expect(p.totalQuestions).toBe(6);
    expect(p.typeCounts.why).toBe(1);
  });

  it('only one level per event, and order is enforced', () => {
    // A first question that is a "why" only passes ①.
    const a = run([q('why')]);
    expect(a.passed).toEqual(['L1']);
    // "what if" before ②/③ does not skip ahead.
    const b = run([q('what'), q('whatif'), { kind: 'challenge', hasReason: true }]);
    expect(b.passed).toEqual(['L1']);
    expect(isUnlocked(LV, b.p, 'L2')).toBe(true);
    expect(isUnlocked(LV, b.p, 'L3')).toBe(false);
  });

  it('challenge without reason / compare without reason do not pass', () => {
    const base = [q('what'), q('why'), q('what', 1), q('what', 2), q('what', 3), q('whatif')];
    const a = run([...base, { kind: 'challenge', hasReason: false }]);
    expect(a.passed).not.toContain('L5');
    const b = run([...base, { kind: 'challenge', hasReason: true }, { kind: 'compare', chose: true, hasReason: false }]);
    expect(b.passed).not.toContain('L6');
  });

  it('follow-up streak needs 3 in a row (index resets on new topic)', () => {
    const a = run([q('what'), q('why'), q('what', 1), q('what', 2), q('what', 0), q('what', 1)]);
    expect(a.passed).toEqual(['L1', 'L2']);
  });
});

describe('missions', () => {
  const big = (missionId: string, stars: number, status: PendingBigStar['status'] = 'confirmed', ts = 1): PendingBigStar => ({
    id: `b-${missionId}`,
    missionId,
    stars,
    praise: { zh: '', en: '' },
    suggestion: { zh: '', en: '' },
    ts,
    resolvedTs: ts,
    status,
    celebrated: true,
  });

  it('6 presets with the full schema', () => {
    expect(MS).toHaveLength(6);
    for (const m of MS) {
      for (const k of ['id', 'title_zh', 'title_en', 'brief_zh', 'brief_en', 'difficulty', 'unlock_requires', 'understand_check', 'info_hints', 'plan_rubric', 'result_rubric', 'reflection_prompts', 'est_minutes'])
        expect(m).toHaveProperty(k);
      for (const r of m.unlock_requires) expect(MS.some((x) => x.id === r)).toBe(true);
    }
  });

  it('unlock requires parent-confirmed completion', () => {
    const trash = MS.find((m) => m.id === 'trash-labels')!;
    expect(isMissionUnlocked(trash, new Set())).toBe(false);
    expect(isMissionUnlocked(trash, new Set(['plant-water']))).toBe(true);
  });

  it('starts with the first easy mission, prefers in-progress', () => {
    expect(pickMission(MS, [], [])?.id).toBe('plant-water');
    const prog = { missionId: 'breakfast-menu', status: 'active', updatedTs: 5 } as MissionProgress;
    expect(pickMission(MS, [big('plant-water', 2)], [prog])?.id).toBe('breakfast-menu');
  });

  it('adaptive difficulty: strong results go up, weak stay low', () => {
    expect(targetDifficulty(MS, [big('plant-water', 3)])).toBe(2);
    expect(pickMission(MS, [big('plant-water', 3)], [])?.difficulty).toBe(2);
    expect(targetDifficulty(MS, [big('plant-water', 1)])).toBe(1);
    expect(pickMission(MS, [big('plant-water', 1)], [])?.id).toBe('trash-labels');
  });

  it('pending/awaiting missions are not re-picked and do not unlock', () => {
    const awaiting = { missionId: 'plant-water', status: 'awaiting', updatedTs: 1 } as MissionProgress;
    expect(pickMission(MS, [big('plant-water', 2, 'pending')], [awaiting])).toBeNull();
  });
});
