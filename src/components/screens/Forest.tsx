'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { HoldToTalk } from '../HoldToTalk';
import { Mentor, Say, Stars, T, TopBar } from '../ui';
import { answerQuestion, evaluateChoice, quickScore, respondChallenge, scoreQuestion, type ForestAnswer, type Turn } from '@/lib/ai/mentor';
import { currentLevelIndex } from '@/lib/logic/forestLevels';
import { QTYPE_BADGES, classifyQuestion } from '@/lib/logic/questionClassifier';
import { sfx } from '@/lib/sfx';
import type { Bi, ForestLevel, ForestProgress, QuestionType } from '@/lib/types';

type Phase = 'ask' | 'busy' | 'guess' | 'answered' | 'compare' | 'compareReason' | 'challenge';

type Item =
  | { id: number; kind: 'q'; text: string; qtype: QuestionType; stars: number; followUp: number }
  | { id: number; kind: 'guess'; text: string }
  | { id: number; kind: 'a'; answer: Bi; tryIt: Bi }
  | { id: number; kind: 'views'; views: [Bi, Bi]; chosen: 0 | 1 | null }
  | { id: number; kind: 'child'; text: string; icon: string }
  | { id: number; kind: 'reply'; text: Bi; stars?: number }
  | { id: number; kind: 'level'; level: ForestLevel };

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> & { id?: number } : never;
type NewItem = WithoutId<Item>;

const cat = (...parts: Bi[]): Bi => ({
  zh: parts.map((p) => p.zh).filter(Boolean).join(''),
  en: parts.map((p) => p.en).filter(Boolean).join(' '),
});

const TXT = {
  askFirst: { zh: '按住话筒，问小星一个你好奇的问题吧！', en: 'Hold the mic and ask me something you wonder about!' },
  newTopic: { zh: '好呀，问一个新问题吧！', en: 'Okay, ask me a new question!' },
  dontKnow: { zh: '我不知道', en: "I don't know" },
  whichView: { zh: '你同意哪个？为什么？我们怎么验证？', en: 'Which one do you agree with? Why? How could we check?' },
  whyChoice: { zh: '为什么选这个呢？按住话筒说说你的理由！', en: 'Why that one? Hold the mic and tell me your reason!' },
  needReason: { zh: '你选好啦！再说一说"因为……"，就能得到星星哦！', en: 'Good choice! Now say "because…" to earn stars!' },
  challengeAsk: { zh: '你觉得哪里不对？按住话筒说说你的理由！', en: 'What seems wrong? Hold the mic and tell me why!' },
  tryIt: { zh: '在家试一试', en: 'Try at home' },
  views: { zh: '两种说法', en: 'Two ideas' },
};

function decideDialectic(n: number, ratio: number) {
  // Spreads dialectic answers evenly: ratio 1/3 → the 3rd, 6th, 9th… answer.
  return Math.floor((n + 1) * ratio) > Math.floor(n * ratio);
}

export function Forest() {
  const { game, mentor, think, say, reward, settings, dataVersion } = useApp();
  const levels = game.forestLevels;
  const [progress, setProgress] = useState<ForestProgress | null>(null);
  const [phase, setPhase] = useState<Phase>('ask');
  const [items, setItems] = useState<Item[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<ForestAnswer | null>(null);
  const [views, setViews] = useState<[Bi, Bi] | null>(null);
  const [choice, setChoice] = useState<0 | 1 | null>(null);
  const thread = useRef<Turn[]>([]);
  const followUps = useRef(0);
  const nextId = useRef(1);
  const feedEnd = useRef<HTMLDivElement>(null);

  const push = useCallback((it: NewItem) => {
    const id = it.id ?? nextId.current++;
    setItems((xs) => [...xs, { ...it, id } as Item]);
    return id;
  }, []);

  useEffect(() => {
    void game.forest().then(setProgress);
  }, [game, dataVersion]);

  useEffect(() => {
    feedEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items, phase]);

  // Greet with the current level goal.
  const greeted = useRef(false);
  useEffect(() => {
    if (!progress || greeted.current) return;
    greeted.current = true;
    const idx = currentLevelIndex(levels, progress);
    const lv = levels[idx];
    void say(
      lv
        ? cat({ zh: `第${idx + 1}关：`, en: `Level ${idx + 1}:` }, { zh: lv.goal_zh, en: lv.goal_en })
        : { zh: '六关全部通过啦！你可以随便问小星任何问题！', en: 'All six levels done! Ask me anything you like!' },
    );
  }, [progress, levels, say]);

  const log = (role: 'child' | 'mentor', text: string, extra: { qtype?: QuestionType; safety?: boolean; mode?: 'llm' | 'demo' } = {}) =>
    void game.log({ module: 'forest', role, text, ...extra });

  /** Apply a forest event and return the speech for a passed level (if any). */
  const forestEvent = async (ev: Parameters<typeof game.forestEvent>[0]): Promise<Bi | null> => {
    const r = await game.forestEvent(ev);
    setProgress(r.progress);
    if (!r.passed) return null;
    const lv = r.passed;
    push({ kind: 'level', level: lv });
    sfx.unlock();
    setTimeout(() => void reward(lv.reward_stars, { zh: `${lv.icon} 通过：${lv.title_zh}`, en: `${lv.icon} Passed: ${lv.title_en}` }, { big: true }), 900);
    const idx = levels.findIndex((l) => l.id === lv.id);
    const nxt = levels[idx + 1];
    return cat(
      { zh: `你通过了第${idx + 1}关"${lv.title_zh}"！`, en: `You passed level ${idx + 1}, "${lv.title_en}"!` },
      nxt ? { zh: `下一关：${nxt.goal_zh}`, en: `Next: ${nxt.goal_en}` } : { zh: '', en: '' },
    );
  };

  // ---------- 1. question ----------
  const onQuestion = async (text: string) => {
    if (phase === 'answered' && answer && classifyQuestion(text) === 'really') {
      // "真的吗？因为……" spoken directly counts as challenging the answer.
      return onChallengeReason(text);
    }
    const followUp = phase === 'answered' ? followUps.current : 0;
    if (phase !== 'answered') {
      thread.current = [];
      followUps.current = 0;
    }
    setPhase('busy');
    setQuestion(text);
    setViews(null);
    setChoice(null);
    const quick = quickScore(text);
    const qid = push({ kind: 'q', text, qtype: quick.qtype, stars: 0, followUp });
    log('child', text, { qtype: quick.qtype, safety: quick.safety });

    const s = await think(scoreQuestion(mentor(), text, thread.current));
    setItems((xs) => xs.map((x) => (x.id === qid && x.kind === 'q' ? { ...x, qtype: s.qtype, stars: s.stars } : x)));
    thread.current.push({ role: 'child', text });
    followUps.current = followUp + 1;
    await game.award('forest', s.stars, `question:${s.qtype}`);
    void reward(s.stars, { zh: `${QTYPE_BADGES[s.qtype].icon} ${QTYPE_BADGES[s.qtype].name.zh}`, en: `${QTYPE_BADGES[s.qtype].icon} ${QTYPE_BADGES[s.qtype].name.en}` });
    const levelLine = await forestEvent({ kind: 'question', qtype: s.qtype, followUpIndex: followUp });
    const praise = cat(s.praise, { zh: `+${s.stars}⭐`, en: `+${s.stars}⭐` });
    log('mentor', `${praise.zh || praise.en} ${s.askBack.zh || s.askBack.en}`, { mode: s.mode });
    setPhase('guess');
    void say(levelLine ? cat(praise, levelLine, s.askBack) : cat(praise, s.askBack), { mood: 'clapping' });
  };

  // ---------- 2. her own guess, then the answer ----------
  const onGuess = async (guess: string) => {
    setPhase('busy');
    if (guess) {
      push({ kind: 'guess', text: guess });
      log('child', guess);
      thread.current.push({ role: 'child', text: guess });
    }
    const f = await game.forest();
    const dialectic = decideDialectic(Math.max(0, f.totalQuestions - 1), settings.dialecticRatio);
    const a = await think(answerQuestion(mentor(), question, guess, thread.current, dialectic));
    setAnswer(a);
    push({ kind: 'a', answer: a.answer, tryIt: a.tryIt });
    const said = a.answer.zh || a.answer.en;
    thread.current.push({ role: 'mentor', text: said });
    log('mentor', `${said} | ${a.tryIt.zh || a.tryIt.en}${a.views ? ` | A: ${a.views[0].zh || a.views[0].en} B: ${a.views[1].zh || a.views[1].en}` : ''}`, {
      safety: a.safety,
      mode: a.mode,
    });
    if (a.views) {
      setViews(a.views);
      push({ kind: 'views', views: a.views, chosen: null });
      setPhase('compare');
      void say(cat(a.answer, a.views[0], a.views[1], TXT.whichView), { mood: 'talking' });
    } else {
      setPhase('answered');
      void say(cat(a.answer, { zh: '在家试一试：', en: 'Try at home:' }, a.tryIt));
    }
  };

  // ---------- 3a. compare two views ----------
  const onChoose = (i: 0 | 1) => {
    sfx.pop();
    setChoice(i);
    setItems((xs) => xs.map((x) => (x.kind === 'views' && x.chosen === null ? { ...x, chosen: i } : x)));
    setPhase('compareReason');
    void say(cat({ zh: `你选了${i === 0 ? '第一种' : '第二种'}！`, en: `You picked idea ${i + 1}!` }, TXT.whyChoice), { mood: 'surprised' });
  };

  const onCompareReason = async (reason: string) => {
    if (!views || choice === null) return;
    setPhase('busy');
    push({ kind: 'child', text: reason, icon: choice === 0 ? '🅰️' : '🅱️' });
    log('child', `[choice ${choice === 0 ? 'A' : 'B'}] ${reason}`);
    const e = await think(evaluateChoice(mentor(), views, choice, reason));
    log('mentor', `${e.praise.zh || e.praise.en} ${e.one_question_or_suggestion.zh || e.one_question_or_suggestion.en}`, { mode: e.mode, safety: e.safety_flag });
    if (!e.hasReason) {
      setPhase('compareReason');
      push({ kind: 'reply', text: TXT.needReason });
      void say(TXT.needReason, { mood: 'surprised' });
      return;
    }
    await game.award('forest', e.stars, 'compare-reason');
    void reward(e.stars, { zh: '说出了理由', en: 'You gave a reason' });
    const levelLine = await forestEvent({ kind: 'compare', chose: true, hasReason: true });
    push({ kind: 'reply', text: cat(e.praise, e.one_question_or_suggestion), stars: e.stars });
    setPhase('answered');
    void say(levelLine ? cat(e.praise, e.one_question_or_suggestion, levelLine) : cat(e.praise, e.one_question_or_suggestion), { mood: 'clapping' });
  };

  // ---------- 3b. "真的吗？" ----------
  const onReally = () => {
    sfx.pop();
    setPhase('challenge');
    void say(TXT.challengeAsk, { mood: 'surprised' });
  };

  const onChallengeReason = async (reason: string) => {
    setPhase('busy');
    push({ kind: 'child', text: reason, icon: '🧐' });
    log('child', `[really?] ${reason}`, { qtype: 'really' });
    const said = answer ? answer.answer.zh || answer.answer.en : '';
    const r = await think(respondChallenge(mentor(), question, said, reason));
    log('mentor', r.reply.zh || r.reply.en, { mode: r.mode, safety: r.safety });
    let levelLine: Bi | null = null;
    if (r.hasReason) {
      await game.award('forest', r.stars, 'challenge-reason');
      void reward(r.stars, { zh: '🧐 真的吗侦探', en: '🧐 Really? detective' });
    }
    levelLine = await forestEvent({ kind: 'challenge', hasReason: r.hasReason });
    push({ kind: 'reply', text: r.reply, stars: r.hasReason ? r.stars : undefined });
    setPhase(r.hasReason ? 'answered' : 'challenge');
    void say(levelLine ? cat(r.reply, levelLine) : r.reply, { mood: r.hasReason ? 'clapping' : 'surprised' });
  };

  const newTopic = () => {
    sfx.tap();
    thread.current = [];
    followUps.current = 0;
    setItems([]);
    setAnswer(null);
    setViews(null);
    setPhase('ask');
    void say(TXT.newTopic);
  };

  const lvIdx = progress ? currentLevelIndex(levels, progress) : 0;
  const busy = phase === 'busy';

  return (
    <main className="screen forest">
      <TopBar title={{ zh: '好奇森林', en: 'Curious Forest' }} />
      <LevelPath levels={levels} current={lvIdx} />
      <div className="forest-body">
        <aside className="forest-mentor">
          <Mentor size={210} />
        </aside>
        <section className="forest-feed" data-testid="forest-feed">
          {items.length === 0 && (
            <div className="feed-empty">
              <span className="feed-empty-art">🌳🐿️🍄🦋</span>
              <Say b={TXT.askFirst} big />
            </div>
          )}
          {items.map((it) => (
            <FeedItem key={it.id} it={it} onChoose={phase === 'compare' ? onChoose : undefined} />
          ))}
          <div ref={feedEnd} />
        </section>
      </div>

      <footer className="action-bar" data-testid="forest-actions" data-phase={phase}>
        {(phase === 'ask' || phase === 'busy') && (
          <HoldToTalk onResult={onQuestion} disabled={busy} label={{ zh: '按住提问', en: 'Hold & ask' }} testId="mic-question" />
        )}
        {phase === 'guess' && (
          <>
            <HoldToTalk onResult={onGuess} label={{ zh: '说说你的想法', en: 'Say your idea' }} testId="mic-guess" color="#FF9F43" />
            <button className="big-btn" data-testid="dont-know" onClick={() => (sfx.tap(), void onGuess(''))}>
              🤷 <T b={TXT.dontKnow} />
            </button>
          </>
        )}
        {phase === 'answered' && (
          <>
            <HoldToTalk onResult={onQuestion} label={{ zh: '接着追问', en: 'Ask more' }} testId="mic-followup" />
            <button className="big-btn really-btn" data-testid="really" onClick={onReally}>
              🧐 <T b={{ zh: '真的吗？', en: 'Really?' }} />
            </button>
            <button className="big-btn" data-testid="new-topic" onClick={newTopic}>
              🌱 <T b={{ zh: '新问题', en: 'New question' }} />
            </button>
          </>
        )}
        {phase === 'compare' && (
          <div className="hint-pill">
            <T b={{ zh: '👆 点一个你同意的想法', en: '👆 Tap the idea you agree with' }} />
          </div>
        )}
        {phase === 'compareReason' && (
          <>
            <HoldToTalk onResult={onCompareReason} label={{ zh: '说说为什么', en: 'Tell me why' }} testId="mic-reason" color="#FF9F43" />
            <button className="big-btn" onClick={() => (sfx.tap(), setPhase('answered'))}>
              ⏭️ <T b={{ zh: '先跳过', en: 'Skip' }} />
            </button>
          </>
        )}
        {phase === 'challenge' && (
          <>
            <HoldToTalk onResult={onChallengeReason} label={{ zh: '说说你的理由', en: 'Say your reason' }} testId="mic-challenge" color="#9B59FF" />
            <button className="big-btn" onClick={() => (sfx.tap(), setPhase('answered'))}>
              ↩️ <T b={{ zh: '算了', en: 'Never mind' }} />
            </button>
          </>
        )}
      </footer>
    </main>
  );
}

function LevelPath({ levels, current }: { levels: ForestLevel[]; current: number }) {
  const { speak } = useApp();
  return (
    <nav className="level-path" data-testid="level-path" data-current={current}>
      {levels.map((l, i) => {
        const st = i < current ? 'done' : i === current ? 'current' : 'locked';
        const b: Bi = { zh: `第${i + 1}关 ${l.title_zh}：${l.goal_zh}`, en: `Level ${i + 1}, ${l.title_en}: ${l.goal_en}` };
        return (
          <button key={l.id} className={`level-node ${st}`} onClick={() => (sfx.tap(), void speak(b))} data-testid={`level-${l.id}`} data-state={st}>
            <span className="level-node-icon">{st === 'locked' ? '🔒' : l.icon}</span>
            <span className="level-node-num">{st === 'done' ? '✓' : i + 1}</span>
          </button>
        );
      })}
    </nav>
  );
}

function FeedItem({ it, onChoose }: { it: Item; onChoose?: (i: 0 | 1) => void }) {
  switch (it.kind) {
    case 'q': {
      const badge = QTYPE_BADGES[it.qtype];
      return (
        <div className="msg msg-child" data-testid="msg-question">
          <div className="msg-avatar">👧</div>
          <div className="msg-body">
            <Say b={{ zh: it.text, en: it.text }} />
            <div className="qbadge-row">
              <span className={`qbadge qbadge-${it.qtype}`} data-testid="qbadge" data-qtype={it.qtype}>
                {badge.icon} <T b={badge.name} />
              </span>
              {it.stars > 0 ? <Stars n={it.stars} size={22} /> : <span className="mini-dots">···</span>}
              {it.followUp > 0 && <span className="followup-chip">🔁 {it.followUp}</span>}
            </div>
          </div>
        </div>
      );
    }
    case 'guess':
    case 'child':
      return (
        <div className="msg msg-child">
          <div className="msg-avatar">{it.kind === 'child' ? it.icon : '💭'}</div>
          <div className="msg-body">
            <Say b={{ zh: it.text, en: it.text }} />
          </div>
        </div>
      );
    case 'a':
      return (
        <div className="msg msg-mentor" data-testid="msg-answer">
          <div className="msg-avatar">⭐</div>
          <div className="msg-body">
            <Say b={it.answer} />
            {(it.tryIt.zh || it.tryIt.en) && (
              <div className="try-card">
                <div className="try-title">
                  🧪 <T b={TXT.tryIt} />
                </div>
                <Say b={it.tryIt} />
              </div>
            )}
          </div>
        </div>
      );
    case 'views':
      return (
        <div className="views" data-testid="views">
          {it.views.map((v, i) => (
            <button
              key={i}
              className={`view-card ${it.chosen === i ? 'chosen' : ''} ${it.chosen !== null && it.chosen !== i ? 'dim' : ''}`}
              data-testid={`view-${i}`}
              disabled={!onChoose}
              onClick={() => onChoose?.(i as 0 | 1)}
            >
              <span className="view-letter">{i === 0 ? '🅰️' : '🅱️'}</span>
              <Say b={v} />
              {it.chosen === i && <span className="view-check">✅</span>}
            </button>
          ))}
        </div>
      );
    case 'reply':
      return (
        <div className="msg msg-mentor">
          <div className="msg-avatar">⭐</div>
          <div className="msg-body">
            <Say b={it.text} />
            {it.stars ? <Stars n={it.stars} size={22} /> : null}
          </div>
        </div>
      );
    case 'level':
      return (
        <div className="level-banner" data-testid="level-passed">
          <span>{it.level.icon}</span>
          <Say b={{ zh: `通过：${it.level.title_zh}！`, en: `Passed: ${it.level.title_en}!` }} />
          <span>+{it.level.reward_stars}⭐</span>
        </div>
      );
  }
}
