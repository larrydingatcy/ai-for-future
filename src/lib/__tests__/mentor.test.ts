import { afterEach, describe, expect, it, vi } from 'vitest';
import missions from '@content/missions.json';
import { answerQuestion, checkUnderstanding, evaluatePlan, respondChallenge, scoreQuestion, type MentorCtx } from '../ai/mentor';
import { DEFAULT_SETTINGS } from '../settings';
import type { Mission } from '../types';

const M = (missions as Mission[])[0];
const demo: MentorCtx = { settings: { ...DEFAULT_SETTINGS, lang: 'both' }, mode: 'demo' };

function mockFetch(content: string) {
  return vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
}

afterEach(() => vi.unstubAllGlobals());

describe('mentor (demo mode)', () => {
  it('scores questions instantly with a type badge and an ask-back', async () => {
    const r = await scoreQuestion(demo, '如果没有太阳会怎么样？', []);
    expect(r.mode).toBe('demo');
    expect(r.qtype).toBe('whatif');
    expect(r.stars).toBeGreaterThanOrEqual(1);
    expect(r.askBack.zh).toMatch(/你/);
  });

  it('adds "find a grown-up" on safety topics', async () => {
    const r = await answerQuestion(demo, '我可以玩打火机吗？', '', [], false);
    expect(r.safety).toBe(true);
    expect(r.answer.zh).toMatch(/大人/);
    expect(r.answer.en).toMatch(/grown-up/);
  });

  it('honestly says it is a computer program', async () => {
    const r = await answerQuestion(demo, '你是真人吗？', '', [], false);
    expect(r.answer.zh).toMatch(/程序/);
  });

  it('gives two views when dialectic', async () => {
    const r = await answerQuestion(demo, '为什么会下雨', '云哭了', [], true);
    expect(r.views).toHaveLength(2);
    expect(r.views![0].zh).toMatch(/^有人认为/);
  });

  it('challenge only rewards a real reason', async () => {
    expect((await respondChallenge(demo, 'q', 'a', '真的吗')).hasReason).toBe(false);
    expect((await respondChallenge(demo, 'q', 'a', '真的吗？因为我看到书上不一样')).hasReason).toBe(true);
  });

  it('understanding check accepts a decent retelling, rephrases otherwise', async () => {
    expect((await checkUnderstanding(demo, M, '给植物做一个浇水提醒', 1)).understood).toBe(true);
    const bad = await checkUnderstanding(demo, M, '嗯', 1);
    expect(bad.understood).toBe(false);
    expect(bad.rephrase.zh.length).toBeGreaterThan(5);
  });
});

describe('mentor (LLM mode)', () => {
  const llm = (): MentorCtx & { fell: unknown[] } => {
    const fell: unknown[] = [];
    return { settings: { ...DEFAULT_SETTINGS, lang: 'zh' }, mode: 'llm', onFallback: (e) => fell.push(e), fell };
  };

  it('parses qwen3 output with <think> and strips links', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch('<think>hmm</think>{"answer":"去 https://x.com 看看。天是蓝的。第三句。第四句。","try_it":"看天空","view_a":"","view_b":"","safety_flag":false}'),
    );
    const ctx = llm();
    const r = await answerQuestion(ctx, '天为什么是蓝的', '', [], false);
    expect(r.mode).toBe('llm');
    expect(r.answer.zh).not.toMatch(/http|x\.com/);
    expect(r.answer.zh).not.toMatch(/第四句/);
  });

  it('sends the image to the vision model and clamps stars', async () => {
    const f = mockFetch('{"stars": 5, "praise": "你画了一个水壶！", "one_question_or_suggestion": "放在哪里呢？", "safety_flag": false}');
    vi.stubGlobal('fetch', f);
    const r = await evaluatePlan(llm(), M, { image: 'data:image/jpeg;base64,xx' });
    expect(r.stars).toBe(3);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.model).toBe('qwen2.5vl');
    expect(JSON.stringify(body.messages)).toContain('image_url');
    // /no_think is only added for qwen3 text calls, not the vision model
    expect(JSON.stringify(body.messages)).not.toContain('/no_think');
  });

  it('falls back to demo when the server fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    const ctx = llm();
    const r = await scoreQuestion(ctx, '为什么', []);
    expect(r.mode).toBe('demo');
    expect(ctx.fell).toHaveLength(1);
  });
});
