import type { Bi, QuestionType } from '../types';

// Order matters: a challenge ("真的吗") beats "what if", which beats "why", "how", "what".
const RULES: { type: QuestionType; zh: RegExp; en: RegExp }[] = [
  {
    type: 'really',
    zh: /真的吗|真的是|是真的吗|真的假的|不对吧|我不信|不相信|怎么可能|确定吗|你确定|骗人/,
    en: /\breally\b|are you sure|is that true|is it true|no way|i don'?t believe|i don'?t think so/i,
  },
  {
    type: 'whatif',
    zh: /如果|要是|假如|假设|万一|会怎样|会怎么样|会发生什么/,
    en: /what if|\bif\b|suppose|imagine|what would happen/i,
  },
  { type: 'why', zh: /为什么|为啥|干嘛|怎么会|何必/, en: /\bwhy\b|how come/i },
  { type: 'how', zh: /怎么|如何|怎样|咋/, en: /\bhow\b/i },
  { type: 'what', zh: /什么|啥|哪|谁|几|多少|是不是|吗|呢/, en: /\bwhat\b|\bwhich\b|\bwho\b|\bwhere\b|\bwhen\b|\?/i },
];

export function classifyQuestion(text: string): QuestionType {
  const t = text.trim();
  for (const r of RULES) if (r.zh.test(t) || r.en.test(t)) return r.type;
  return 'what';
}

export const QTYPE_BADGES: Record<QuestionType, { icon: string; name: Bi; praise: Bi }> = {
  what: {
    icon: '🔎',
    name: { zh: '是什么', en: 'What' },
    praise: { zh: '你问了一个"是什么"的问题，好奇心满满！', en: 'You asked a "what" question — so curious!' },
  },
  why: {
    icon: '🤔',
    name: { zh: '为什么', en: 'Why' },
    praise: { zh: '你问了一个"为什么"的问题，像个小科学家！', en: 'You asked a "why" question, like a little scientist!' },
  },
  how: {
    icon: '🛠️',
    name: { zh: '怎么做', en: 'How' },
    praise: { zh: '你问了一个"怎么做"的问题，真会动脑筋！', en: 'You asked a "how" question — great thinking!' },
  },
  whatif: {
    icon: '🌀',
    name: { zh: '如果…会怎样', en: 'What if' },
    praise: { zh: '你问了一个"如果"的问题，真像科学家！', en: 'You asked a "what if" question, just like a scientist!' },
  },
  really: {
    icon: '🧐',
    name: { zh: '真的吗', en: 'Really?' },
    praise: { zh: '你敢说"真的吗"，是个会思考的小侦探！', en: 'You asked "really?" — a true thinking detective!' },
  },
};

const BASE_STARS: Record<QuestionType, number> = { what: 1, how: 2, why: 2, whatif: 2, really: 3 };

/** Rough "how much detail" measure that works for Chinese and English. */
export function richness(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const words = text.replace(/[\u4e00-\u9fff]/g, ' ').split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
  return cjk + words * 2;
}

/** Offline question score: deeper question types earn more, a detailed question earns +1. Range 1..3. */
export function heuristicQuestionStars(text: string, qtype: QuestionType): number {
  const bonus = richness(text) >= 14 ? 1 : 0;
  return Math.min(3, Math.max(1, BASE_STARS[qtype] + bonus));
}

const REASON = /因为|所以|我觉得|我认为|我看到|我看过|我试过|我发现|我想|如果|可能|because|since|i think|i saw|i tried|i found|maybe|so\b/i;

/** Did the child give a reason (not just "yes"/"A")? */
export function hasReason(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return REASON.test(t) || richness(t) >= 8;
}
