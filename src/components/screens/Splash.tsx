'use client';

import { useState } from 'react';
import { useApp } from '../AppContext';
import { Mascot } from '../Mascot';
import { T } from '../ui';
import { unlockAudio, sfx } from '@/lib/sfx';
import { tts } from '@/lib/speech/tts';

/** iOS needs a tap before any sound — this big start button is that tap. */
export function Splash() {
  const { ready, game, go, say, reward, refresh } = useApp();
  const [starting, setStarting] = useState(false);
  const start = async () => {
    if (!ready || starting) return;
    setStarting(true);
    unlockAudio();
    tts.unlock();
    sfx.unlock();
    const login = await game.dailyLogin();
    await refresh();
    go({ name: 'home' });
    if (login.firstToday) {
      setTimeout(() => {
        void reward(1, { zh: '今天第一次来！', en: 'First visit today!' });
        if (login.streakBonus)
          setTimeout(() => void reward(5, { zh: `连续 ${login.profile.streak} 天打卡！`, en: `${login.profile.streak}-day streak!` }, { big: true }), 1800);
      }, 300);
      void say(
        login.streakBonus
          ? { zh: `哇，你连续来了 ${login.profile.streak} 天！送你 5 颗星！`, en: `Wow, ${login.profile.streak} days in a row! Here are 5 stars!` }
          : { zh: '你好呀！今天第一次来，送你 1 颗星！想去哪里探险？', en: 'Hi there! First visit today, so here is a star! Where shall we explore?' },
        { mood: 'clapping' },
      );
    } else {
      void say({ zh: '欢迎回来！今天想问问题，还是做任务？', en: 'Welcome back! Ask questions or do a mission today?' });
    }
  };
  return (
    <main className="splash" onClick={start}>
      <div className="splash-sky">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 53) % 100}%`, top: `${(i * 37) % 90}%`, animationDelay: `${(i % 6) * 0.4}s` }} />
        ))}
      </div>
      <h1 className="splash-title">
        AI for Future
        <small>未来小创想家</small>
      </h1>
      <Mascot mood={starting ? 'clapping' : 'happy'} size={260} />
      <button className="start-btn" data-testid="start" disabled={!ready} aria-label="开始 Start">
        <span>▶</span>
      </button>
      <div className="splash-hint">
        <T b={{ zh: '点一下开始', en: 'Tap to start' }} />
      </div>
    </main>
  );
}
