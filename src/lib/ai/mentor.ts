/**
 * Everything 小星 "thinks". Each function has an LLM path (OpenAI-compatible) and an offline
 * demo path. If the LLM fails, we fall back to demo so the child is never stuck.
 */
import { chat, type ChatMessage, type ContentPart } from './llm';
import { DEFAULT_SYSTEM_PROMPT, EVAL_SHAPE, JSON_RULE, langRule, missionContext } from './prompts';
import { GENERIC, findTopic } from './demoKb';
import { extractJson, kidSafeText, parseEvaluation, toBi, toBool, toStars } from '../logic/llmParse';
import { QTYPE_BADGES, classifyQuestion, hasReason, heuristicQuestionStars, richness } from '../logic/questionClassifier';
import { SAFETY_REMINDER, isSafetyTopic } from '../logic/safety';
import type { Bi, Evaluation, Lang, Mission, QuestionType, Settings } from '../types';
import { clamp, uid } from '../util';

export type Mode = 'llm' | 'demo';

export interface MentorCtx {
  settings: Settings;
  mode: Mode;
  /** Called when an LLM call failed and we used demo instead. */
  onFallback?: (err: unknown) => void;
}

export type Turn = { role: 'child' | 'mentor'; text: string };

const b = (zh: string, en: string): Bi => ({ zh, en });
const QTYPES: QuestionType[] = ['what', 'why', 'how', 'whatif', 'really'];
const rnd = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function system(ctx: MentorCtx): string {
  return (ctx.settings.systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT) + `\n\n${langRule(ctx.settings.lang)}\n${JSON_RULE}`;
}

async function askJson(ctx: MentorCtx, user: string | ContentPart[], opts: { vision?: boolean; history?: ChatMessage[] } = {}) {
  const { settings: s } = ctx;
  const messages: ChatMessage[] = [{ role: 'system', content: system(ctx) }, ...(opts.history ?? []), { role: 'user', content: user }];
  const raw = await chat(
    { baseUrl: s.baseUrl, apiKey: s.apiKey, model: opts.vision ? s.visionModel : s.textModel },
    messages,
    { json: true, timeoutMs: opts.vision ? 120000 : 60000 },
  );
  const j = extractJson(raw);
  if (!j) throw new Error('LLM did not return JSON');
  return { j, raw };
}

async function withFallback<T>(ctx: MentorCtx, llm: () => Promise<T>, demo: () => T | Promise<T>): Promise<T & { mode: Mode }> {
  if (ctx.mode === 'llm') {
    try {
      return { ...(await llm()), mode: 'llm' as const };
    } catch (e) {
      ctx.onFallback?.(e);
    }
  }
  // Tiny pause so the "thinking" animation is visible even offline.
  await new Promise((r) => setTimeout(r, 450));
  return { ...(await demo()), mode: 'demo' as const };
}

/** Append the safety reminder when needed (client-side guarantee, whatever the model said). */
function guard(text: Bi, source: string, flag = false): { text: Bi; safety: boolean } {
  const safety = flag || isSafetyTopic(source);
  if (!safety) return { text, safety };
  const has = (s: string) => /大人|grown-?up|adult/i.test(s);
  return {
    text: {
      zh: text.zh && !has(text.zh) ? `${text.zh}${SAFETY_REMINDER.zh}` : text.zh || SAFETY_REMINDER.zh,
      en: text.en && !has(text.en) ? `${text.en} ${SAFETY_REMINDER.en}` : text.en || SAFETY_REMINDER.en,
    },
    safety,
  };
}

const histMsgs = (h: Turn[]): ChatMessage[] =>
  h.slice(-8).map((t) => ({ role: t.role === 'child' ? 'user' : 'assistant', content: t.text }));

// =====================================================================
// Curious Forest
// =====================================================================

export interface QuestionScore {
  qtype: QuestionType;
  stars: number;
  praise: Bi;
  askBack: Bi; // "你觉得呢？"
  safety: boolean;
}

/** Instant local guess — shown before the LLM replies so feedback is < 2 s. */
export function quickScore(question: string): Omit<QuestionScore, 'askBack'> {
  const qtype = classifyQuestion(question);
  return { qtype, stars: heuristicQuestionStars(question, qtype), praise: QTYPE_BADGES[qtype].praise, safety: isSafetyTopic(question) };
}

const ASK_BACKS: Bi[] = [
  b('你觉得呢？先猜一猜！', 'What do you think? Take a guess!'),
  b('你觉得会是为什么呢？', 'What do you think the reason is?'),
  b('你先说说你的想法吧！', 'Tell me your idea first!'),
];

export function scoreQuestion(ctx: MentorCtx, question: string, history: Turn[]) {
  return withFallback<QuestionScore>(
    ctx,
    async () => {
      const { j } = await askJson(
        ctx,
        `孩子问了一个问题 The child asked: "${question}"
判断问题类型 Classify the question type as one of: what (是什么), why (为什么), how (怎么做), whatif (如果…会怎样), really (真的吗/质疑).
按问题的好奇程度和深度给 1-3 颗星，写一句具体的夸奖（要提到问题类型，例如"你问了一个'如果'的问题，真像科学家！"），再写一个简短的反问，请她先说说自己的想法（类似"你觉得呢？"），不要回答问题本身。
Return: {"qtype": "...", "stars": 1-3, "praise": ..., "ask_back": ..., "safety_flag": true|false}`,
        { history: histMsgs(history) },
      );
      const qtype = QTYPES.includes(j.qtype as QuestionType) ? (j.qtype as QuestionType) : classifyQuestion(question);
      const praise = toBi(j.praise, ctx.settings.lang, 2);
      const askBack = toBi(j.ask_back, ctx.settings.lang, 1);
      return {
        qtype,
        stars: toStars(j.stars, 1, 3, heuristicQuestionStars(question, qtype)),
        praise: praise.zh || praise.en ? praise : QTYPE_BADGES[qtype].praise,
        askBack: askBack.zh || askBack.en ? askBack : ASK_BACKS[0],
        safety: toBool(j.safety_flag) || isSafetyTopic(question),
      };
    },
    () => {
      const q = quickScore(question);
      return { ...q, askBack: q.qtype === 'why' ? ASK_BACKS[1] : rnd([ASK_BACKS[0], ASK_BACKS[2]]) };
    },
  );
}

export interface ForestAnswer {
  answer: Bi;
  tryIt: Bi;
  views?: [Bi, Bi];
  safety: boolean;
}

export function answerQuestion(ctx: MentorCtx, question: string, childGuess: string, history: Turn[], dialectic: boolean) {
  return withFallback<ForestAnswer>(
    ctx,
    async () => {
      const { j } = await askJson(
        ctx,
        `孩子的问题 Question: "${question}"
她自己的猜想 Her own guess: "${childGuess || '（她说不知道 / she does not know）'}"
请：先具体夸一下她的猜想（如果有），再用最多 2 句很简单的话回答；如果不确定就说"我们一起查一查"。
然后给一个在家里就能安全观察或动手试的小办法 (try_it)。
${
  dialectic
    ? `这次请给出两种不同的说法 (view_a, view_b)，用"有人认为……"和"也有人认为……"开头，两种说法都要是孩子能验证的。不要说哪个对。`
    : '这次不需要两种说法，view_a 和 view_b 留空字符串。'
}
Return: {"answer": ..., "try_it": ..., "view_a": ..., "view_b": ..., "safety_flag": true|false}`,
        { history: histMsgs(history) },
      );
      const L = ctx.settings.lang;
      const va = toBi(j.view_a, L, 2);
      const vb = toBi(j.view_b, L, 2);
      const g = guard(toBi(j.answer, L), question, toBool(j.safety_flag));
      return {
        answer: g.text,
        tryIt: toBi(j.try_it, L, 2),
        views: dialectic && (va.zh || va.en) && (vb.zh || vb.en) ? ([va, vb] as [Bi, Bi]) : undefined,
        safety: g.safety,
      };
    },
    () => {
      // Prefer the current question's topic; fall back to the conversation so far.
      let t = findTopic(question);
      if (t === GENERIC) t = findTopic(history.map((h) => h.text).join(' ').slice(-200));
      const guessPraise = childGuess.trim()
        ? richness(childGuess) >= 6
          ? b('你的猜想说得好清楚！', 'You explained your guess so clearly!')
          : b('谢谢你说出你的想法！', 'Thanks for sharing your idea!')
        : b('不知道也没关系！', "It's okay not to know!");
      const g = guard({ zh: guessPraise.zh + t.answer.zh, en: `${guessPraise.en} ${t.answer.en}` }, question);
      return { answer: g.text, tryIt: t.tryIt, views: dialectic ? t.views : undefined, safety: g.safety };
    },
  );
}

/** She tapped "真的吗？" and (maybe) explained why she doubts the answer. */
export function respondChallenge(ctx: MentorCtx, question: string, answer: string, reason: string) {
  const reasoned = hasReason(reason);
  return withFallback<{ reply: Bi; stars: number; hasReason: boolean; safety: boolean }>(
    ctx,
    async () => {
      const { j } = await askJson(
        ctx,
        `孩子之前问：${question}\n小星回答：${answer}\n孩子说"真的吗？"，她的理由是："${reason}"
请：先夸她敢于质疑（具体说她的理由好在哪），承认小星也可能会错，再提议一个一起验证的办法。最多 3 句。
has_reason: 她是否说出了真正的理由。stars: 有理由 2-3，没有理由 1。
Return: {"reply": ..., "has_reason": true|false, "stars": 1-3, "safety_flag": true|false}`,
      );
      const has = toBool(j.has_reason) || reasoned;
      const g = guard(toBi(j.reply, ctx.settings.lang), reason, toBool(j.safety_flag));
      return { reply: g.text, stars: toStars(j.stars, 1, 3, has ? 2 : 1), hasReason: has, safety: g.safety };
    },
    () => {
      const g = guard(
        reasoned
          ? b('哇，你不光问"真的吗"，还说出了理由，真像小侦探！小星也可能会错，我们一起查一查、试一试吧。', 'Wow, you asked "really?" and gave a reason — a true detective! I can be wrong too, so let\'s check together.')
          : b('问"真的吗"很勇敢！你为什么觉得不对呢？说说你的理由吧。', 'Asking "really?" is brave! Why do you think it might be wrong? Tell me your reason.'),
        reason,
      );
      return { reply: g.text, stars: reasoned ? 3 : 1, hasReason: reasoned, safety: g.safety };
    },
  );
}

/** Two views shown; she picked one and said why. */
export function evaluateChoice(ctx: MentorCtx, views: [Bi, Bi], choice: 0 | 1, reason: string) {
  const reasoned = hasReason(reason);
  const fallback: Evaluation = {
    stars: reasoned ? (richness(reason) >= 12 ? 3 : 2) : 1,
    praise: reasoned
      ? b('你选好了，还说出了理由，这就是会思考！', 'You chose and explained why — that is real thinking!')
      : b('你做出了选择！再告诉小星为什么吧。', 'You made a choice! Now tell me why.'),
    one_question_or_suggestion: b('我们怎么验证你的想法呢？可以试一试、看一看！', 'How could we test your idea? We can try it and look!'),
    safety_flag: isSafetyTopic(reason),
  };
  return withFallback<Evaluation & { hasReason: boolean }>(
    ctx,
    async () => {
      const raw = await chat(
        { baseUrl: ctx.settings.baseUrl, apiKey: ctx.settings.apiKey, model: ctx.settings.textModel },
        [
          { role: 'system', content: system(ctx) },
          {
            role: 'user',
            content: `两种说法 Two views:\nA: ${views[0].zh} / ${views[0].en}\nB: ${views[1].zh} / ${views[1].en}
孩子选了 ${choice === 0 ? 'A' : 'B'}，她的理由："${reason}"
评分：说出理由 2-3 星（理由越具体越高），没有理由 1 星。夸奖要具体提到她的理由。one_question_or_suggestion 问她"我们怎么验证？"并给一个验证的小办法。
Return: ${EVAL_SHAPE} plus "has_reason": true|false`,
          },
        ],
        { json: true },
      );
      const e = parseEvaluation(raw, ctx.settings.lang, fallback);
      const j = extractJson(raw) ?? {};
      return { ...e, hasReason: toBool(j.has_reason) || reasoned };
    },
    () => ({ ...fallback, hasReason: reasoned }),
  );
}

// =====================================================================
// Mission Base
// =====================================================================

function coverage(m: Mission, text: string): number {
  const t = text.toLowerCase();
  let hit = 0;
  for (const p of m.understand_check) {
    const zh = p.zh.replace(/[^\u4e00-\u9fff]/g, '');
    const grams = Array.from({ length: Math.max(0, zh.length - 1) }, (_, i) => zh.slice(i, i + 2));
    const words = p.en.toLowerCase().split(/\W+/).filter((w) => w.length >= 4);
    if (grams.some((g) => t.includes(g)) || words.some((w) => t.includes(w))) hit++;
  }
  return hit;
}

export function checkUnderstanding(ctx: MentorCtx, m: Mission, retell: string, attempt: number) {
  return withFallback<{ understood: boolean; praise: Bi; rephrase: Bi }>(
    ctx,
    async () => {
      const { j } = await askJson(
        ctx,
        `${missionContext(m)}
孩子用自己的话复述任务："${retell}"（第 ${attempt} 次）
判断她是否理解了核心要点（大意对就算理解，不要求说全）。理解了：具体夸她说对的部分。没理解：温柔地换一种更简单的说法，再讲一次任务（rephrase，最多 2 句），并请她再说一次。
Return: {"understood": true|false, "praise": ..., "rephrase": ...}`,
      );
      return { understood: toBool(j.understood), praise: toBi(j.praise, ctx.settings.lang), rephrase: toBi(j.rephrase, ctx.settings.lang) };
    },
    () => {
      const hits = coverage(m, retell);
      const understood = hits >= 1 && richness(retell) >= 4;
      const point = m.understand_check[0];
      return {
        understood,
        praise: understood
          ? b(`你说到了"${point.zh}"，说明你听懂啦！`, `You said "${point.en}" — you understood!`)
          : b('谢谢你试着说一说！', 'Thanks for trying to say it!'),
        rephrase: b(
          `小星换个说法：就是要${m.understand_check.map((p) => p.zh).join('，')}。你再用自己的话说一次吧！`,
          `Let me say it another way: we need to ${m.understand_check.map((p) => p.en).join(', ')}. Can you say it again in your own words?`,
        ),
      };
    },
  );
}

/** Info card source "ask 小星". */
export function askForInfo(ctx: MentorCtx, m: Mission, question: string) {
  return withFallback<{ answer: Bi; card: Bi; safety: boolean }>(
    ctx,
    async () => {
      const { j } = await askJson(
        ctx,
        `${missionContext(m)}
为了完成任务，孩子问小星："${question}"
用最多 2 句简单的话给一点有用的信息或线索（不确定就说一起查一查），并写一条信息卡 card（最多 12 个字/8 个英文词，记录关键信息）。
Return: {"answer": ..., "card": ..., "safety_flag": true|false}`,
      );
      const g = guard(toBi(j.answer, ctx.settings.lang), question, toBool(j.safety_flag));
      const card = toBi(j.card, ctx.settings.lang, 1);
      return { answer: g.text, card: card.zh || card.en ? card : g.text, safety: g.safety };
    },
    () => {
      const t = findTopic(question);
      const hint = rnd(m.info_hints);
      const generic = t === GENERIC;
      const answer = generic
        ? b(`好问题！小星的线索是：${hint.zh}我们一起查一查吧。`, `Great question! My clue: ${hint.en} Let's find out together.`)
        : t.answer;
      const g = guard(answer, question);
      return { answer: g.text, card: generic ? hint : t.answer, safety: g.safety };
    },
  );
}

function rubricQuestion(rubric: Bi[], seed: number, kind: 'plan' | 'result' = 'plan'): Bi {
  const r = rubric[seed % rubric.length];
  return kind === 'plan'
    ? b(`想一想：你的方案里有没有"${r.zh}"？可以怎么加上呢？`, `Think: does your plan cover "${r.en}"? How could you add it?`)
    : b(`下次可以看看：${r.zh}了吗？`, `Next time, check: ${r.en}?`);
}

/** Step 3: drawing photo and/or spoken plan, judged against plan_rubric. */
export function evaluatePlan(ctx: MentorCtx, m: Mission, input: { image?: string; text?: string; improved?: boolean; previous?: string }) {
  const seed = (input.text?.length ?? 0) + (input.image ? 1 : 0) + (input.improved ? 1 : 0);
  const fallback: Evaluation = {
    stars: clamp(1 + (input.image ? 1 : 0) + (richness(input.text ?? '') >= 10 ? 1 : 0), 1, 3),
    praise: input.improved
      ? b('你真的把方案改得更好了，会动脑筋！', 'You really made your plan better — great thinking!')
      : input.image
        ? b('你画得好认真，小星看到你的方案啦！', 'You drew so carefully — I can see your plan!')
        : b('你把方案讲得清清楚楚！', 'You explained your plan so clearly!'),
    one_question_or_suggestion: rubricQuestion(m.plan_rubric, seed),
    safety_flag: isSafetyTopic(input.text ?? ''),
  };
  return withFallback<Evaluation>(
    ctx,
    async () => {
      const prompt = `${missionContext(m)}
这是孩子的${input.improved ? '改进后的' : ''}方案。${input.image ? '图片是她画的方案。' : ''}${input.text ? `她说："${input.text}"` : ''}
${input.previous ? `上次小星的建议是：${input.previous}` : ''}
只按"方案评分标准"打 1-3 星。先具体夸一个你真的看到/听到的地方（比如画里的某个东西），再问一个能让方案更好的问题。
Return: ${EVAL_SHAPE}`;
      const content: ContentPart[] = [{ type: 'text', text: prompt }];
      if (input.image) content.push({ type: 'image_url', image_url: { url: input.image } });
      const s = ctx.settings;
      const raw = await chat(
        { baseUrl: s.baseUrl, apiKey: s.apiKey, model: input.image ? s.visionModel : s.textModel },
        [{ role: 'system', content: system(ctx) }, { role: 'user', content: input.image ? content : prompt }],
        { json: true, timeoutMs: 120000 },
      );
      if (!extractJson(raw)) throw new Error('no json');
      return parseEvaluation(raw, s.lang, fallback);
    },
    () => fallback,
  );
}

/** Step 4a: reflection answers. */
export function evaluateReflection(ctx: MentorCtx, m: Mission, answers: string[]) {
  const said = answers.filter((a) => a.trim());
  const reasons = said.filter((a) => hasReason(a) || richness(a) >= 6).length;
  const fallback: Evaluation = {
    stars: clamp(said.length === 0 ? 1 : 1 + Math.min(2, reasons), 1, 3),
    praise: b('你会回头想一想做得怎么样，这是很厉害的本领！', 'You looked back at how it went — that is a super skill!'),
    one_question_or_suggestion: b('下次你最想先试哪个新办法？', 'Which new idea do you want to try first next time?'),
    safety_flag: said.some(isSafetyTopic),
  };
  return withFallback<Evaluation>(
    ctx,
    async () => {
      const { raw } = await askJson(
        ctx,
        `${missionContext(m)}
孩子的反思 Reflection:
${m.reflection_prompts.map((p, i) => `${p.zh} → "${answers[i] ?? ''}"`).join('\n')}
按反思的认真程度打 1-3 星（说出了做得好的、没成功的、下次怎么改，各算一点）。夸她具体说得好的地方，再给一个下次的小建议。
Return: ${EVAL_SHAPE}`,
      );
      return parseEvaluation(raw, ctx.settings.lang, fallback);
    },
    () => fallback,
  );
}

/** Step 4b: final result photo → 通关大星 (pending parent confirmation). */
export function evaluateResult(ctx: MentorCtx, m: Mission, input: { image?: string; reflections: string[] }) {
  const fallback: Evaluation = {
    stars: clamp((input.image ? 2 : 1) + (input.reflections.filter((r) => richness(r) >= 6).length >= 2 ? 1 : 0), 1, 3),
    praise: input.image
      ? b(`你真的动手完成了"${m.title_zh}"，小星看到你的成果啦！`, `You really made "${m.title_en}" — I can see your result!`)
      : b(`你完成了"${m.title_zh}"！`, `You finished "${m.title_en}"!`),
    one_question_or_suggestion: rubricQuestion(m.result_rubric, input.reflections.join('').length, 'result'),
    safety_flag: input.reflections.some(isSafetyTopic),
  };
  return withFallback<Evaluation>(
    ctx,
    async () => {
      const s = ctx.settings;
      const prompt = `${missionContext(m)}
${input.image ? '图片是孩子完成的成果照片。' : '没有照片。'}
她的反思：${input.reflections.join(' / ')}
只按"成果评分标准"给 1-3 颗通关大星。先具体夸一个你在照片里看到的东西，再给一个建议。
Return: ${EVAL_SHAPE}`;
      const content: ContentPart[] = [{ type: 'text', text: prompt }];
      if (input.image) content.push({ type: 'image_url', image_url: { url: input.image } });
      const raw = await chat(
        { baseUrl: s.baseUrl, apiKey: s.apiKey, model: input.image ? s.visionModel : s.textModel },
        [{ role: 'system', content: system(ctx) }, { role: 'user', content: input.image ? content : prompt }],
        { json: true, timeoutMs: 120000 },
      );
      if (!extractJson(raw)) throw new Error('no json');
      return parseEvaluation(raw, s.lang, fallback);
    },
    () => fallback,
  );
}

// =====================================================================
// Parent tools
// =====================================================================

export const MISSION_TEMPLATE = `{
  "id": "kebab-case-id",
  "icon": "one emoji",
  "title_zh": "", "title_en": "",
  "brief_zh": "2 句以内，5 岁孩子能懂", "brief_en": "",
  "difficulty": 1,
  "unlock_requires": [],
  "understand_check": [{"zh": "", "en": ""}, {"zh": "", "en": ""}, {"zh": "", "en": ""}],
  "info_hints": [{"zh": "", "en": ""}, {"zh": "", "en": ""}, {"zh": "", "en": ""}],
  "plan_rubric": [{"zh": "", "en": ""}, {"zh": "", "en": ""}, {"zh": "", "en": ""}],
  "result_rubric": [{"zh": "", "en": ""}, {"zh": "", "en": ""}, {"zh": "", "en": ""}],
  "reflection_prompts": [{"zh": "什么做得好？", "en": "What went well?"}, {"zh": "什么没成功？", "en": "What didn't work?"}, {"zh": "下次怎么改？", "en": "What will you change next time?"}],
  "est_minutes": 20
}`;

export function normalizeMission(j: Record<string, unknown>, fallbackId = uid('m-')): Mission {
  const str = (v: unknown) => kidSafeText(v, 4);
  const arr = (v: unknown): Bi[] =>
    Array.isArray(v)
      ? v
          .map((x) => (typeof x === 'string' ? { zh: str(x), en: str(x) } : { zh: str((x as Bi)?.zh), en: str((x as Bi)?.en) }))
          .filter((x) => x.zh || x.en)
      : [];
  const id = typeof j.id === 'string' && /^[a-z0-9-]{3,40}$/.test(j.id) ? j.id : fallbackId;
  const refl = arr(j.reflection_prompts);
  return {
    id,
    icon: typeof j.icon === 'string' && j.icon.trim() ? [...j.icon.trim()].slice(0, 2).join('') : '⭐',
    title_zh: str(j.title_zh),
    title_en: str(j.title_en),
    brief_zh: str(j.brief_zh),
    brief_en: str(j.brief_en),
    difficulty: clamp(Math.round(Number(j.difficulty) || 1), 1, 3) as 1 | 2 | 3,
    unlock_requires: Array.isArray(j.unlock_requires) ? j.unlock_requires.filter((x): x is string => typeof x === 'string') : [],
    understand_check: arr(j.understand_check),
    info_hints: arr(j.info_hints),
    plan_rubric: arr(j.plan_rubric),
    result_rubric: arr(j.result_rubric),
    reflection_prompts: refl.length
      ? refl
      : [b('什么做得好？', 'What went well?'), b('什么没成功？', "What didn't work?"), b('下次怎么改？', 'What will you change next time?')],
    est_minutes: clamp(Math.round(Number(j.est_minutes) || 20), 5, 120),
  };
}

export function validateMission(m: Mission): string[] {
  const errs: string[] = [];
  if (!m.title_zh && !m.title_en) errs.push('title');
  if (!m.brief_zh && !m.brief_en) errs.push('brief');
  if (m.understand_check.length === 0) errs.push('understand_check');
  if (m.plan_rubric.length === 0) errs.push('plan_rubric');
  if (m.result_rubric.length === 0) errs.push('result_rubric');
  return errs;
}

/** Parent asks the LLM to draft a mission from the template; it lands as "pending review". */
export async function generateMission(ctx: MentorCtx, theme: string, difficulty: number): Promise<{ mission: Mission; mode: Mode }> {
  if (ctx.mode === 'llm') {
    try {
      const s = ctx.settings;
      const raw = await chat(
        { baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.textModel },
        [
          {
            role: 'system',
            content: `You design hands-on, safe home missions for a 5½-year-old girl, in Chinese and English. Missions train: understanding a problem, gathering information, planning, doing and reflecting. Use kid words. ${JSON_RULE}`,
          },
          {
            role: 'user',
            content: `主题 Theme: ${theme || '家里的小发明'}\n难度 difficulty: ${difficulty}\n严格按这个模板输出 JSON（填满所有字段）：\n${MISSION_TEMPLATE}`,
          },
        ],
        { json: true, timeoutMs: 120000, temperature: 0.9 },
      );
      const j = extractJson(raw);
      if (j) {
        const m = normalizeMission(j);
        if (validateMission(m).length === 0) return { mission: { ...m, difficulty: clamp(difficulty, 1, 3) as 1 | 2 | 3 }, mode: 'llm' };
      }
      throw new Error('invalid mission JSON');
    } catch (e) {
      ctx.onFallback?.(e);
    }
  }
  const t = theme.trim() || '家里的小发明';
  return {
    mode: 'demo',
    mission: normalizeMission({
      id: uid('m-'),
      icon: '💡',
      title_zh: `${t}小任务`,
      title_en: `${t} Mission`,
      brief_zh: `我们来完成一个和"${t}"有关的小任务！想一想要做什么，再动手试一试。`,
      brief_en: `Let's do a little mission about "${t}"! Think about what to make, then try it.`,
      difficulty,
      understand_check: [b(t, t), b('动手做', 'make something'), b('试一试', 'try it out')],
      info_hints: [b('问问家人有什么好主意', 'Ask your family for ideas'), b('看看家里有什么材料', 'Look for materials at home'), b('问问小星', 'Ask Xiaoxing')],
      plan_rubric: [b('想好要做什么', 'knows what to make'), b('想好用什么材料', 'knows which materials'), b('想好怎么试', 'knows how to test it')],
      result_rubric: [b('做出来了', 'it is made'), b('试过了', 'it was tested'), b('能说出哪里好', 'can say what is good')],
      est_minutes: 20,
    }),
  };
}

/** Parent-facing narrative for the daily summary (LLM only; local stats are always shown). */
export async function summarizeDay(ctx: MentorCtx, facts: string): Promise<string | undefined> {
  if (ctx.mode !== 'llm') return undefined;
  try {
    const s = ctx.settings;
    const raw = await chat(
      { baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.textModel },
      [
        { role: 'system', content: '你是儿童教育顾问。根据孩子一天的学习记录，用中文给家长写 3-5 条简短要点：她的兴趣点、提问方式的进步、值得鼓励的地方、明天可以一起做的事、需要家长注意的安全问题。不要输出链接。' },
        { role: 'user', content: facts },
      ],
      { timeoutMs: 120000, temperature: 0.5 },
    );
    return kidSafeText(raw, 12);
  } catch (e) {
    ctx.onFallback?.(e);
    return undefined;
  }
}
