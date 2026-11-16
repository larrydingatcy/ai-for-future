'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { HoldToTalk } from '../HoldToTalk';
import { PhotoButton } from '../PhotoButton';
import { Mentor, Say, SpeakButton, Stars, T, TopBar } from '../ui';
import {
  askForInfo,
  checkUnderstanding,
  evaluatePlan,
  evaluateReflection,
  evaluateResult,
} from '@/lib/ai/mentor';
import { sfx } from '@/lib/sfx';
import type { Bi, InfoCard, InfoSource, Mission, MissionProgress, PendingBigStar } from '@/lib/types';

const cat = (...parts: Bi[]): Bi => ({
  zh: parts.map((p) => p.zh).filter(Boolean).join(''),
  en: parts.map((p) => p.en).filter(Boolean).join(' '),
});

export const STEPS: { icon: string; name: Bi }[] = [
  { icon: '👂', name: { zh: '听懂任务', en: 'Understand' } },
  { icon: '🔍', name: { zh: '收集信息', en: 'Gather info' } },
  { icon: '✏️', name: { zh: '想个办法', en: 'Make a plan' } },
  { icon: '🏆', name: { zh: '动手完成', en: 'Do & reflect' } },
];

export const SOURCES: Record<InfoSource, { icon: string; name: Bi; prompt: Bi; color: string }> = {
  ask_mentor: { icon: '⭐', name: { zh: '问小星', en: 'Ask Xiaoxing' }, prompt: { zh: '按住话筒问小星', en: 'Hold the mic and ask me' }, color: '#FFC93C' },
  ask_family: { icon: '👨‍👩‍👧', name: { zh: '问家人', en: 'Ask family' }, prompt: { zh: '去问问家人，再按住话筒把答案录下来', en: 'Ask your family, then hold the mic and record the answer' }, color: '#FF8FB1' },
  observe: { icon: '👀', name: { zh: '我观察', en: 'I looked' }, prompt: { zh: '仔细看一看，按住话筒说说你发现了什么', en: 'Look closely, then hold the mic and say what you found' }, color: '#6BCB77' },
  photo: { icon: '📷', name: { zh: '拍照片', en: 'Take photo' }, prompt: { zh: '拍一张有用的照片', en: 'Take a helpful photo' }, color: '#5CC8FF' },
};

const NEXT: Bi = { zh: '下一关', en: 'Next' };

export function MissionScreen({ id }: { id: string }) {
  const { game, say, speak, go } = useApp();
  const [m, setM] = useState<Mission | null>(null);
  const [p, setP] = useState<MissionProgress | null>(null);
  const [cards, setCards] = useState<InfoCard[]>([]);
  const [big, setBig] = useState<PendingBigStar | null>(null);

  useEffect(() => {
    void (async () => {
      const all = await game.missions({ includeDisabled: true });
      const mission = all.find((x) => x.id === id);
      if (!mission) return go({ name: 'base' });
      setM(mission);
      const prog = await game.startMission(id);
      setP(prog);
      setCards(await game.repo.cards.where('missionId', id));
      if (prog.bigStarId) setBig((await game.repo.bigStars.get(prog.bigStarId)) ?? null);
    })();
  }, [game, id, go]);

  const update = useCallback(
    async (patch: Partial<MissionProgress>) => {
      if (!p) return;
      const next = await game.saveProgress({ ...p, ...patch });
      setP(next);
      return next;
    },
    [game, p],
  );

  if (!m || !p) return <main className="screen mission" />;

  const brief: Bi = { zh: m.brief_zh, en: m.brief_en };
  const title: Bi = { zh: m.title_zh, en: m.title_en };
  const shownStep = p.status === 'active' ? p.step : 5;

  return (
    <main className="screen mission">
      <TopBar
        title={title}
        extra={
          <button className="round-btn" aria-label="任务列表" data-testid="back-base" onClick={() => (sfx.tap(), go({ name: 'base' }))}>
            🚀
          </button>
        }
      />
      <div className="stepbar" data-testid="stepbar" data-step={shownStep}>
        {STEPS.map((s, i) => {
          const n = i + 1;
          const st = n < shownStep ? 'done' : n === shownStep ? 'current' : 'todo';
          return (
            <button key={n} className={`step ${st}`} onClick={() => (sfx.tap(), void speak(s.name))}>
              <span className="step-icon">{st === 'done' ? '✅' : s.icon}</span>
              <T b={s.name} className="step-name" />
            </button>
          );
        })}
      </div>
      <div className="mission-body">
        <aside className="mission-mentor">
          <div className="mission-badge">{m.icon}</div>
          <Mentor size={190} />
        </aside>
        <section className="step-panel" data-testid={`step-panel-${shownStep}`}>
          {p.status === 'active' && p.step === 1 && <StepUnderstand m={m} p={p} brief={brief} update={update} />}
          {p.status === 'active' && p.step === 2 && <StepInfo m={m} p={p} cards={cards} setCards={setCards} update={update} />}
          {p.status === 'active' && p.step === 3 && <StepPlan m={m} p={p} update={update} />}
          {p.status === 'active' && p.step === 4 && (
            <StepResult
              m={m}
              p={p}
              update={update}
              onSubmitted={(b) => {
                setBig(b);
                void game.progress(m.id).then((x) => x && setP(x));
              }}
            />
          )}
          {p.status !== 'active' && <Finished m={m} p={p} big={big} />}
        </section>
      </div>
    </main>
  );
}

type StepProps = { m: Mission; p: MissionProgress; update: (patch: Partial<MissionProgress>) => Promise<MissionProgress | undefined> };

function NextButton({ onClick, testId = 'next-step' }: { onClick: () => void; testId?: string }) {
  return (
    <button className="big-btn primary next-btn glow" data-testid={testId} onClick={() => (sfx.tap(), onClick())}>
      <T b={NEXT} /> ➡️
    </button>
  );
}

// ---------------- Step 1: understand ----------------
function StepUnderstand({ m, p, brief, update }: StepProps & { brief: Bi }) {
  const { game, mentor, think, say, reward } = useApp();
  const [busy, setBusy] = useState(false);
  const [retell, setRetell] = useState('');
  const spoke = useRef(false);
  useEffect(() => {
    if (spoke.current || p.understood) return;
    spoke.current = true;
    void say(cat({ zh: '任务来啦！', en: 'Here is your mission!' }, brief, { zh: '你能用自己的话说一说要做什么吗？', en: 'Can you say in your own words what to do?' }));
  }, [brief, p.understood, say]);

  const onRetell = async (text: string) => {
    setBusy(true);
    setRetell(text);
    void game.log({ module: 'mission', missionId: m.id, role: 'child', text: `[retell] ${text}` });
    const attempt = p.retellAttempts + 1;
    const r = await think(checkUnderstanding(mentor(), m, text, attempt));
    void game.log({ module: 'mission', missionId: m.id, role: 'mentor', text: r.understood ? r.praise.zh || r.praise.en : r.rephrase.zh || r.rephrase.en, mode: r.mode });
    const accept = r.understood || attempt >= 3;
    if (accept) {
      await update({ retellAttempts: attempt, understood: true });
      await game.award('step', 1, `${m.id}:understand`, m.id);
      void reward(1, STEPS[0].name);
      void say(
        cat(
          r.understood ? r.praise : { zh: '你很努力地说了好几次，我们边做边懂吧！', en: 'You tried hard! We will understand more as we go.' },
          { zh: '点"下一关"，我们去收集信息！', en: 'Tap "Next" to gather information!' },
        ),
        { mood: 'clapping' },
      );
    } else {
      await update({ retellAttempts: attempt });
      sfx.soft();
      void say(r.rephrase, { mood: 'talking' });
    }
    setBusy(false);
  };

  return (
    <div className="step-content">
      <div className="brief-card">
        <span className="brief-icon">{m.icon}</span>
        <Say b={brief} big />
      </div>
      {retell && (
        <div className="said-chip">
          👧 “{retell}”
        </div>
      )}
      {!p.understood ? (
        <div className="row gap center">
          <button className="big-btn" onClick={() => (sfx.tap(), void say(brief))} data-testid="replay-brief">
            🔁 <T b={{ zh: '再听一次', en: 'Hear again' }} />
          </button>
          <HoldToTalk onResult={onRetell} disabled={busy} label={{ zh: '用我的话说一说', en: 'Say it my way' }} testId="mic-retell" />
        </div>
      ) : (
        <div className="row center">
          <NextButton onClick={() => void update({ step: 2 })} />
        </div>
      )}
    </div>
  );
}

// ---------------- Step 2: info cards ----------------
function StepInfo({ m, p, cards, setCards, update }: StepProps & { cards: InfoCard[]; setCards: (c: InfoCard[]) => void }) {
  const { game, mentor, think, say, reward } = useApp();
  const [source, setSource] = useState<InfoSource | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const spoke = useRef(false);
  const mine = cards.filter((c) => p.cardIds.includes(c.id));

  useEffect(() => {
    if (spoke.current) return;
    spoke.current = true;
    void say(
      mine.length >= 2
        ? { zh: '信息卡收集好啦！还想再收集，或者点"下一关"。', en: 'You have your info cards! Collect more, or tap "Next".' }
        : { zh: '我们来收集信息！至少收集两张信息卡。先选一个办法：问小星、问家人、自己观察，或者拍照片。', en: 'Let us gather information! Collect at least two info cards. Pick a way: ask me, ask family, look, or take a photo.' },
    );
  }, [mine.length, say]);

  const addCard = async (src: InfoSource, text: string, image?: string) => {
    const c = await game.addCard({ missionId: m.id, source: src, text, image });
    setCards([...cards, c]);
    const next = await update({ cardIds: [...p.cardIds, c.id] });
    await game.award('step', 1, `${m.id}:card`, c.id);
    void reward(1, { zh: '信息卡 +1', en: 'Info card +1' });
    void game.log({ module: 'mission', missionId: m.id, role: 'child', text: `[card:${src}] ${text}`, image });
    const n = next?.cardIds.length ?? 0;
    setSource(null);
    setPhoto(null);
    void say(
      n >= 2
        ? { zh: `太好了，你已经有 ${n} 张信息卡了！可以点"下一关"啦。`, en: `Great, you have ${n} info cards! You can tap "Next" now.` }
        : { zh: '收进收藏册啦！再收集一张吧！', en: 'It went into your album! Collect one more!' },
      { mood: 'clapping' },
    );
  };

  const onAskMentor = async (q: string) => {
    setBusy(true);
    void game.log({ module: 'mission', missionId: m.id, role: 'child', text: `[ask] ${q}` });
    const r = await think(askForInfo(mentor(), m, q));
    void game.log({ module: 'mission', missionId: m.id, role: 'mentor', text: r.answer.zh || r.answer.en, safety: r.safety, mode: r.mode });
    void say(r.answer);
    const cardText = r.card.zh && r.card.en && r.card.zh !== r.card.en ? `${r.card.zh} / ${r.card.en}` : r.card.zh || r.card.en;
    await addCard('ask_mentor', `${q} → ${cardText}`);
    setBusy(false);
  };

  return (
    <div className="step-content">
      <div className="hints">
        {m.info_hints.map((h, i) => (
          <div key={i} className="hint">
            💡 <Say b={h} />
          </div>
        ))}
      </div>

      {!source && (
        <div className="source-grid" data-testid="source-grid">
          {(Object.keys(SOURCES) as InfoSource[]).map((k) => (
            <button
              key={k}
              className="source-tile"
              style={{ ['--tile' as string]: SOURCES[k].color }}
              data-testid={`source-${k}`}
              onClick={() => {
                sfx.tap();
                setSource(k);
                void say(SOURCES[k].prompt);
              }}
            >
              <span className="source-icon">{SOURCES[k].icon}</span>
              <T b={SOURCES[k].name} />
            </button>
          ))}
        </div>
      )}

      {source && (
        <div className="source-panel" style={{ ['--tile' as string]: SOURCES[source].color }}>
          <div className="source-head">
            <span className="source-icon">{SOURCES[source].icon}</span>
            <Say b={SOURCES[source].prompt} />
            <button className="round-btn" aria-label="back" onClick={() => (sfx.tap(), setSource(null), setPhoto(null))}>
              ↩️
            </button>
          </div>
          {source === 'ask_mentor' && <HoldToTalk onResult={onAskMentor} disabled={busy} label={{ zh: '问小星', en: 'Ask me' }} testId="mic-card" />}
          {(source === 'ask_family' || source === 'observe') && (
            <HoldToTalk onResult={(t) => addCard(source, t)} label={source === 'ask_family' ? { zh: '录下家人的话', en: 'Record family' } : { zh: '说说我发现的', en: 'Say what I found' }} testId="mic-card" />
          )}
          {source === 'photo' && !photo && (
            <PhotoButton testId="card-photo" onPhoto={(url) => (setPhoto(url), void say({ zh: '拍好啦！说说照片里是什么？也可以直接收下。', en: 'Got it! Tell me what it shows, or just keep it.' }))} />
          )}
          {source === 'photo' && photo && (
            <div className="row gap center">
              <img src={photo} alt="" className="preview" />
              <HoldToTalk onResult={(t) => addCard('photo', t, photo)} label={{ zh: '说说这是什么', en: 'What is it?' }} testId="mic-card" size="md" />
              <button className="big-btn primary" data-testid="keep-photo" onClick={() => (sfx.tap(), void addCard('photo', '📷', photo))}>
                ✅ <T b={{ zh: '收下', en: 'Keep' }} />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card-strip" data-testid="card-strip" data-count={mine.length}>
        {mine.map((c) => (
          <div key={c.id} className="info-card pop-in">
            <span className="info-src">{SOURCES[c.source].icon}</span>
            {c.image && <img src={c.image} alt="" />}
            <span className="info-text">{c.text}</span>
          </div>
        ))}
        {Array.from({ length: Math.max(0, 2 - mine.length) }, (_, i) => (
          <div key={`e${i}`} className="info-card empty">
            ？
          </div>
        ))}
      </div>
      {mine.length >= 2 && !source && (
        <div className="row center">
          <NextButton onClick={() => void update({ step: 3 })} />
        </div>
      )}
    </div>
  );
}

// ---------------- Step 3: plan ----------------
function StepPlan({ m, p, update }: StepProps) {
  const { game, mentor, think, say, reward } = useApp();
  const [busy, setBusy] = useState(false);
  const spoke = useRef(false);
  useEffect(() => {
    if (spoke.current) return;
    spoke.current = true;
    if (!p.planFeedback)
      void say({ zh: '现在想个办法！把你的方案画在纸上拍下来，或者按住话筒讲给小星听。', en: 'Now make a plan! Draw it and take a photo, or hold the mic and tell me.' });
  }, [p.planFeedback, say]);

  const submit = async (input: { image?: string; text?: string }) => {
    setBusy(true);
    const improving = !!p.planFeedback;
    void game.log({ module: 'mission', missionId: m.id, role: 'child', text: `[plan${improving ? ' improved' : ''}] ${input.text ?? '(drawing)'}`, image: input.image });
    const e = await think(
      evaluatePlan(mentor(), m, {
        ...input,
        improved: improving,
        previous: p.planFeedback ? p.planFeedback.question.zh || p.planFeedback.question.en : undefined,
      }),
    );
    void game.log({ module: 'mission', missionId: m.id, role: 'mentor', text: `${e.praise.zh || e.praise.en} ${e.one_question_or_suggestion.zh || e.one_question_or_suggestion.en}`, safety: e.safety_flag, mode: e.mode });
    const feedback = { praise: e.praise, question: e.one_question_or_suggestion, stars: e.stars };
    if (improving) {
      await update({ planImproved: true, planFeedback: feedback, planImage: input.image ?? p.planImage, planText: input.text ?? p.planText });
      await game.award('step', 1, `${m.id}:plan-improved`, m.id);
      void reward(1, { zh: '改进方案', en: 'Plan improved' });
      void say(cat(e.praise, { zh: '改进成功，多得一颗星！点"下一关"去动手做吧！', en: 'You improved it — one extra star! Tap "Next" to build it!' }), { mood: 'clapping' });
    } else {
      await update({ planDone: true, planFeedback: feedback, planImage: input.image, planText: input.text });
      await game.award('step', e.stars, `${m.id}:plan`, m.id);
      void reward(e.stars, STEPS[2].name);
      void say(cat(e.praise, e.one_question_or_suggestion, { zh: '想改进一下吗？改进可以多得一颗星！', en: 'Want to improve it? That earns one more star!' }), { mood: 'clapping' });
    }
    setBusy(false);
  };

  return (
    <div className="step-content">
      {p.planFeedback && (
        <div className="feedback-card" data-testid="plan-feedback">
          {p.planImage && <img src={p.planImage} alt="" className="preview" />}
          <div className="col">
            <Stars n={p.planFeedback.stars} />
            <Say b={p.planFeedback.praise} />
            <div className="question-line">
              ❓ <Say b={p.planFeedback.question} />
            </div>
          </div>
        </div>
      )}
      {(!p.planFeedback || !p.planImproved) && (
        <div className="row gap center wrap">
          {p.planFeedback && (
            <div className="improve-tag">
              ✨ <T b={{ zh: '改进一下 +1⭐', en: 'Improve +1⭐' }} />
            </div>
          )}
          <PhotoButton
            testId="plan-photo"
            disabled={busy}
            label={p.planFeedback ? { zh: '拍新的方案', en: 'Photo of new plan' } : { zh: '拍下我画的方案', en: 'Photo of my drawing' }}
            icon="🖍️"
            onPhoto={(url) => submit({ image: url })}
          />
          <HoldToTalk
            onResult={(t) => submit({ text: t })}
            disabled={busy}
            label={p.planFeedback ? { zh: '讲讲怎么改', en: 'Tell my change' } : { zh: '讲讲我的方案', en: 'Tell my plan' }}
            testId="mic-plan"
          />
        </div>
      )}
      {p.planFeedback && (
        <div className="row center">
          <NextButton onClick={() => void update({ step: 4 })} />
        </div>
      )}
    </div>
  );
}

// ---------------- Step 4: do it, photo, reflect ----------------
const REFLECT_ICONS = ['👍', '🤔', '🔁'];

function StepResult({ m, p, update, onSubmitted }: StepProps & { onSubmitted: (b: PendingBigStar) => void }) {
  const { game, mentor, think, say, reward, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const spoke = useRef(false);
  useEffect(() => {
    if (spoke.current) return;
    spoke.current = true;
    void say(
      p.resultImage
        ? { zh: '照片拍好了！现在回答三个小问题吧。', en: 'Photo done! Now answer three little questions.' }
        : { zh: '去动手做吧！做好以后，拍一张成果照片给小星看。', en: 'Go and make it! When you are done, take a photo of it for me.' },
    );
  }, [p.resultImage, say]);

  const onPhoto = async (url: string) => {
    await update({ resultImage: url });
    void game.log({ module: 'mission', missionId: m.id, role: 'child', text: '[result photo]', image: url });
    sfx.pop();
    const first = m.reflection_prompts[0];
    void say(cat({ zh: '哇，做出来啦！', en: 'Wow, you made it!' }, first), { mood: 'surprised' });
  };

  const onReflect = async (i: number, text: string) => {
    const refl = [...p.reflections];
    refl[i] = text;
    await update({ reflections: refl });
    void game.log({ module: 'mission', missionId: m.id, role: 'child', text: `[reflect ${i + 1}] ${text}` });
    sfx.pop();
    const nextIdx = m.reflection_prompts.findIndex((_, k) => !refl[k]);
    void say(
      nextIdx >= 0
        ? cat({ zh: '说得好！', en: 'Nicely said!' }, m.reflection_prompts[nextIdx])
        : { zh: '三个问题都回答了！点"完成任务"交给小星吧！', en: 'All three answered! Tap "Finish" to hand it in!' },
    );
  };

  const finish = async () => {
    setBusy(true);
    sfx.tap();
    const answers = m.reflection_prompts.map((_, i) => p.reflections[i] ?? '');
    const r = await think(evaluateReflection(mentor(), m, answers));
    await game.award('step', r.stars, `${m.id}:reflect`, m.id);
    void reward(r.stars, { zh: '认真反思', en: 'Great reflecting' });
    await update({ reflectionDone: true });
    const e = await think(evaluateResult(mentor(), m, { image: p.resultImage, reflections: answers }));
    void game.log({ module: 'mission', missionId: m.id, role: 'mentor', text: `[result ${e.stars}★] ${e.praise.zh || e.praise.en} ${e.one_question_or_suggestion.zh || e.one_question_or_suggestion.en}`, safety: e.safety_flag || r.safety_flag, mode: e.mode });
    const b = await game.submitMission(m.id, { stars: e.stars, praise: e.praise, suggestion: e.one_question_or_suggestion, resultImage: p.resultImage });
    await refresh();
    sfx.fanfare();
    onSubmitted(b);
    void say(
      cat(r.praise, e.praise, {
        zh: `你得到了 ${e.stars} 颗通关大星！等爸爸妈妈看一看，大星就会到你的口袋里。`,
        en: `You earned ${e.stars} big mission stars! Once your grown-ups check, they go into your pocket.`,
      }),
      { mood: 'clapping' },
    );
    setBusy(false);
  };

  const answered = m.reflection_prompts.filter((_, i) => p.reflections[i]).length;
  return (
    <div className="step-content">
      <div className="row gap center wrap">
        {p.resultImage ? (
          <div className="result-photo">
            <img src={p.resultImage} alt="" className="preview big" />
            <PhotoButton testId="result-photo" label={{ zh: '重拍', en: 'Retake' }} onPhoto={onPhoto} disabled={busy} />
          </div>
        ) : (
          <PhotoButton testId="result-photo" label={{ zh: '拍下我的成果', en: 'Photo of my result' }} onPhoto={onPhoto} />
        )}
      </div>
      {p.resultImage && (
        <div className="reflect-list">
          {m.reflection_prompts.map((q, i) => (
            <div key={i} className={`reflect-row ${p.reflections[i] ? 'done' : ''}`} data-testid={`reflect-${i}`}>
              <span className="reflect-icon">{REFLECT_ICONS[i] ?? '💬'}</span>
              <div className="reflect-q">
                <Say b={q} />
                {p.reflections[i] && <div className="said-chip">“{p.reflections[i]}”</div>}
              </div>
              <HoldToTalk onResult={(t) => onReflect(i, t)} disabled={busy} label={p.reflections[i] ? { zh: '重说', en: 'Again' } : { zh: '按住回答', en: 'Hold & answer' }} testId={`mic-reflect-${i}`} size="md" />
            </div>
          ))}
        </div>
      )}
      {p.resultImage && answered >= 1 && (
        <div className="row center">
          <button className="big-btn primary glow" data-testid="finish-mission" disabled={busy} onClick={finish}>
            🏁 <T b={{ zh: '完成任务', en: 'Finish' }} />
          </button>
        </div>
      )}
    </div>
  );
}

function Finished({ m, p, big }: { m: Mission; p: MissionProgress; big: PendingBigStar | null }) {
  const { go } = useApp();
  const stars = big ? (big.finalStars ?? big.stars) : 0;
  const msg: Bi =
    p.status === 'awaiting'
      ? { zh: `通关大星 ${stars} 颗，正在等爸爸妈妈确认哦！`, en: `${stars} big stars are waiting for your grown-ups to check!` }
      : { zh: `这个任务完成啦！你得到了 ${stars} 颗大星！`, en: `Mission complete! You earned ${stars} big stars!` };
  return (
    <div className="step-content finished" data-testid="mission-finished" data-status={p.status}>
      <div className={`gift ${p.status === 'awaiting' ? 'wobble' : ''}`}>{p.status === 'awaiting' ? '🎁' : '🏆'}</div>
      <div className="big-stars">
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className={i < stars ? 'on' : 'off'}>
            🌟
          </span>
        ))}
      </div>
      <Say b={msg} big />
      {big && (
        <div className="feedback-card">
          {big.resultImage && <img src={big.resultImage} alt="" className="preview" />}
          <div className="col">
            <Say b={big.praise} />
            <div className="question-line">
              💡 <Say b={big.suggestion} />
            </div>
          </div>
        </div>
      )}
      <div className="row gap center">
        <SpeakButton b={msg} size="lg" />
        <button className="big-btn primary" data-testid="to-base" onClick={() => (sfx.tap(), go({ name: 'base' }))}>
          🚀 <T b={{ zh: '回到基地', en: 'Back to base' }} />
        </button>
      </div>
      <span hidden>{m.id}</span>
    </div>
  );
}
