import { describe, expect, it } from 'vitest';
import { extractJson, kidSafeText, limitSentences, parseEvaluation, stripLinks, stripThink, toBi } from '../logic/llmParse';
import { classifyQuestion, hasReason, heuristicQuestionStars } from '../logic/questionClassifier';
import { isSafetyTopic } from '../logic/safety';
import type { Evaluation } from '../types';

const FB: Evaluation = { stars: 1, praise: { zh: '好', en: 'good' }, one_question_or_suggestion: { zh: '?', en: '?' }, safety_flag: false };

describe('llm output parsing', () => {
  it('strips qwen3 think blocks', () => {
    expect(stripThink('<think>hmm {"a":1}</think>\nHi')).toBe('Hi');
    expect(stripThink('Hi <think>cut off')).toBe('Hi');
  });
  it('extracts JSON from noisy text, fences and trailing commas', () => {
    expect(extractJson('Sure! ```json\n{"stars": 2, "praise": "棒"}\n```')).toEqual({ stars: 2, praise: '棒' });
    expect(extractJson('<think>{"x":0}</think> result: {"a": {"b": "}"}, }')).toEqual({ a: { b: '}' } });
    expect(extractJson('no json here')).toBeNull();
  });
  it('parses evaluation and clamps stars', () => {
    const e = parseEvaluation('{"stars": 9, "praise": "你画了水壶！", "one_question_or_suggestion": "放哪里呢？", "safety_flag": "false"}', 'zh', FB);
    expect(e.stars).toBe(3);
    expect(e.praise.zh).toBe('你画了水壶！');
    expect(e.safety_flag).toBe(false);
    expect(parseEvaluation('{"stars": -2}', 'zh', FB).stars).toBe(1);
    expect(parseEvaluation('garbage', 'zh', FB)).toEqual(FB);
    expect(parseEvaluation('{"stars":"2","praise":{"zh":"好","en":"Nice"},"safety_flag":true}', 'both', FB)).toMatchObject({
      stars: 2,
      praise: { zh: '好', en: 'Nice' },
      safety_flag: true,
    });
  });
  it('removes links of every kind', () => {
    const s = stripLinks('看这里 https://example.com/a?b=1 和 [百科](http://x.cn) 还有 www.foo.org 以及 abc.com');
    expect(s).not.toMatch(/http|www|\.com|\.cn|\.org/);
    expect(s).toContain('百科');
  });
  it('limits to 3 sentences', () => {
    expect(limitSentences('一。二！三？四。')).toBe('一。二！三？');
    expect(limitSentences('One. Two! Three? Four.')).toBe('One. Two! Three?');
    expect(kidSafeText('<think>x</think>A. B. C. D.')).toBe('A. B. C.');
  });
  it('toBi normalises strings and objects', () => {
    expect(toBi('hello', 'en')).toEqual({ zh: '', en: 'hello' });
    expect(toBi('你好', 'both')).toEqual({ zh: '你好', en: '' });
    expect(toBi({ zh: '你好', en: 'hi' }, 'zh')).toEqual({ zh: '你好', en: 'hi' });
  });
});

describe('question classifier (zh/en)', () => {
  it.each([
    ['天空是什么颜色？', 'what'],
    ['为什么天是蓝色的', 'why'],
    ['怎么做彩虹', 'how'],
    ['如果没有太阳会怎么样', 'whatif'],
    ['真的吗？我不信', 'really'],
    ['What is a cloud?', 'what'],
    ['Why do cats purr?', 'why'],
    ['How do birds fly?', 'how'],
    ['What if it never rained?', 'whatif'],
    ['Really? Are you sure?', 'really'],
    ['怎么会下雨', 'why'],
  ])('%s → %s', (text, t) => {
    expect(classifyQuestion(text)).toBe(t);
  });
  it('stars 1..3 favour deeper questions', () => {
    expect(heuristicQuestionStars('是什么', 'what')).toBe(1);
    expect(heuristicQuestionStars('如果', 'whatif')).toBe(2);
    expect(heuristicQuestionStars('真的吗？', 'really')).toBe(3);
  });
  it('detects reasons', () => {
    expect(hasReason('因为我看到叶子黄了')).toBe(true);
    expect(hasReason('because I saw it')).toBe(true);
    expect(hasReason('A')).toBe(false);
    expect(hasReason('')).toBe(false);
  });
  it('safety topics without false alarms on 火车/电脑', () => {
    expect(isSafetyTopic('我可以玩打火机吗')).toBe(true);
    expect(isSafetyTopic('Can I touch the outlet?')).toBe(true);
    expect(isSafetyTopic('药好吃吗')).toBe(true);
    expect(isSafetyTopic('火车为什么跑得快')).toBe(false);
    expect(isSafetyTopic('电脑是什么')).toBe(false);
  });
});
