import type { DailySummary, DailyUsage, LedgerEntry, LogMessage, QuestionType } from '../types';
import { classifyQuestion } from './questionClassifier';

// Topic words we can spot offline to describe what the child is curious about.
const TOPICS: { zh: string; en: string; re: RegExp }[] = [
  { zh: '天空和天气', en: 'sky & weather', re: /天|云|雨|雪|风|彩虹|雷|sky|cloud|rain|snow|wind|rainbow|thunder/i },
  { zh: '太阳月亮星星', en: 'sun, moon & stars', re: /太阳|月亮|星星|宇宙|地球|sun|moon|star|space|planet|earth/i },
  { zh: '动物', en: 'animals', re: /猫|狗|鸟|鱼|虫|蚂蚁|恐龙|动物|兔|熊|猴|cat|dog|bird|fish|bug|ant|dinosaur|animal|rabbit|bear/i },
  { zh: '植物', en: 'plants', re: /花|草|树|叶|种子|植物|flower|grass|tree|leaf|seed|plant/i },
  { zh: '身体', en: 'the body', re: /身体|牙|眼睛|头发|睡觉|梦|血|骨头|body|teeth|tooth|eye|hair|sleep|dream|blood|bone/i },
  { zh: '食物', en: 'food', re: /吃|饭|水果|菜|糖|蛋|奶|food|eat|fruit|vegetable|candy|egg|milk/i },
  { zh: '水和冰', en: 'water & ice', re: /水|冰|海|河|water|ice|sea|ocean|river/i },
  { zh: '机器和科技', en: 'machines & tech', re: /电脑|机器人|汽车|飞机|火车|手机|computer|robot|car|plane|train|phone|ai\b/i },
];

export function detectInterests(texts: string[]): string[] {
  const counts = TOPICS.map((t) => ({ t, n: texts.filter((x) => t.re.test(x)).length })).filter((x) => x.n > 0);
  counts.sort((a, b) => b.n - a.n);
  return counts.slice(0, 4).map((x) => `${x.t.zh} / ${x.t.en}`);
}

/** Local (no-LLM) daily summary for parents. */
export function buildLocalSummary(
  day: string,
  logs: LogMessage[],
  ledger: LedgerEntry[],
  usage: DailyUsage | undefined,
): DailySummary {
  const dayLogs = logs.filter((l) => l.day === day).sort((a, b) => a.ts - b.ts);
  const questions = dayLogs
    .filter((l) => l.role === 'child' && l.module === 'forest' && l.qtype)
    .map((l) => ({ text: l.text, qtype: l.qtype }));
  const typeCounts: Record<QuestionType, number> = { what: 0, why: 0, how: 0, whatif: 0, really: 0 };
  for (const q of questions) typeCounts[q.qtype ?? classifyQuestion(q.text)]++;
  const childTexts = dayLogs.filter((l) => l.role === 'child').map((l) => l.text);
  const starsEarned = ledger
    .filter((e) => e.amount > 0 && new Date(e.ts).toDateString() === new Date(`${day}T12:00:00`).toDateString())
    .reduce((s, e) => s + e.amount, 0);
  return {
    day,
    generatedTs: Date.now(),
    mode: 'local',
    questions,
    typeCounts,
    interests: detectInterests(childTexts),
    safetyFlags: dayLogs.filter((l) => l.safety).map((l) => ({ ts: l.ts, text: l.text })),
    starsEarned,
    minutesUsed: Math.round((usage?.activeSeconds ?? 0) / 60),
  };
}
