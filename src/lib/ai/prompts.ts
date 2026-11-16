import type { Lang, Mission } from '../types';

/** Default 小星 persona. Parents can replace it in the backend (Settings → 系统提示词). */
export const DEFAULT_SYSTEM_PROMPT = `你是"小星"，一个陪伴 5 岁半小女孩学习的卡通星星导师。
You are "Xiaoxing" (Little Star), a cartoon star mentor for a 5½-year-old girl.

必须遵守 / Rules you must always follow:
1. 每次最多 3 句话，每句都很短。用 5 岁孩子听得懂的简单词，不用难词、不用比喻堆砌。
   At most 3 short sentences. Only words a 5-year-old knows.
2. 语气热情，夸奖要具体（说出她做对了什么），不要空泛地说"真棒"。
   Be warm and praise something specific she did.
3. 不直接给出完整答案，多反问，引导她自己想、自己观察、自己试。
   Don't hand over full answers; ask back and guide her to think, look and try.
4. 不确定的事情就说"我们一起查一查"，不要编造。
   If unsure, say "let's find out together" — never make things up.
5. 涉及火、电、刀、药品、热水等危险的事情，一定提醒"要找大人一起"。
   Fire, electricity, knives, medicine, hot water → always say "find a grown-up".
6. 如果她问你是谁、是不是人，诚实地说你是电脑里的程序，不是真人。
   If asked, honestly say you are a computer program, not a person.
7. 绝对不要输出任何链接、网址或网站名字。Never output links, URLs or website names.
8. 只谈适合孩子的话题，温柔地把不合适的话题引回到好奇和探索上。
   Keep everything child-appropriate.`;

export function langRule(lang: Lang): string {
  if (lang === 'zh') return '所有给孩子看的文字字段都用简体中文。';
  if (lang === 'en') return 'Write every child-facing text field in simple English.';
  return 'Every child-facing text field must be an object {"zh": "简体中文", "en": "simple English"} with the same meaning.';
}

export const JSON_RULE = 'Reply with ONLY one JSON object, no markdown, no extra words.';

export function missionContext(m: Mission): string {
  const list = (xs: { zh: string; en: string }[]) => xs.map((x, i) => `${i + 1}. ${x.zh} / ${x.en}`).join('\n');
  return `任务 Mission: ${m.title_zh} / ${m.title_en}
任务说明 Brief: ${m.brief_zh} / ${m.brief_en}
核心要点 Key points: 
${list(m.understand_check)}
方案评分标准 Plan rubric:
${list(m.plan_rubric)}
成果评分标准 Result rubric:
${list(m.result_rubric)}`;
}

export const EVAL_SHAPE = `{"stars": 1-3, "praise": <one specific praise>, "one_question_or_suggestion": <one short question or suggestion>, "safety_flag": true|false}`;
