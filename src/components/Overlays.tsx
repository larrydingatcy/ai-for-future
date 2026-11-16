'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from './AppContext';
import { Mascot } from './Mascot';
import { Say, T } from './ui';
import { hashPin } from '@/lib/util';
import { sfx } from '@/lib/sfx';
import type { Bi } from '@/lib/types';

/** "+2 ⭐" pop with stars flying out and up toward the counter. */
export function StarBursts() {
  const { bursts } = useApp();
  return (
    <div className="burst-layer" aria-hidden>
      {bursts.map((b) => (
        <BurstItem key={b.id} amount={b.amount} label={b.label} big={b.big} />
      ))}
    </div>
  );
}

function BurstItem({ amount, label, big }: { amount: number; label?: Bi; big?: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: Math.min(14, 5 + amount * 3) }, (_, i) => {
        const a = (i / Math.min(14, 5 + amount * 3)) * Math.PI * 2 + Math.random() * 0.4;
        const d = 120 + Math.random() * 120;
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, delay: Math.random() * 0.15, s: 0.7 + Math.random() * 0.8 };
      }),
    [amount],
  );
  return (
    <div className={`burst ${big ? 'burst-big' : ''}`} data-testid="star-burst">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="burst-star"
          style={{ ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, ['--s' as string]: p.s, animationDelay: `${p.delay}s` }}
        >
          ⭐
        </span>
      ))}
      <div className="burst-amount">+{amount}⭐</div>
      {label && (
        <div className="burst-label">
          <T b={label} />
        </div>
      )}
    </div>
  );
}

const CONFETTI_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9ECD'];

export function CelebrationOverlay() {
  const { celebration, closeCelebration, speak } = useApp();
  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        dur: 2.2 + Math.random() * 1.8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rot: Math.random() * 360,
      })),
    // regenerate per celebration
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [celebration?.id],
  );
  useEffect(() => {
    if (!celebration) return;
    const text: Bi = celebration.subtitle
      ? { zh: `${celebration.title.zh}${celebration.subtitle.zh}`, en: `${celebration.title.en} ${celebration.subtitle.en}` }
      : celebration.title;
    void speak(text);
  }, [celebration, speak]);
  if (!celebration) return null;
  return (
    <div className="celebration" data-testid="celebration" onClick={() => (sfx.tap(), closeCelebration())}>
      {confetti.map((c, i) => (
        <i
          key={i}
          className="confetti"
          style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, transform: `rotate(${c.rot}deg)` }}
        />
      ))}
      <div className="celebration-card" onClick={(e) => e.stopPropagation()}>
        <Mascot mood="clapping" size={200} />
        {celebration.icon && <div className="celebration-icon">{celebration.icon}</div>}
        <Say b={celebration.title} big />
        {celebration.subtitle && <Say b={celebration.subtitle} />}
        {!!celebration.stars && <div className="celebration-stars">{'🌟'.repeat(celebration.stars)}</div>}
        <button className="big-btn primary" data-testid="celebration-close" onClick={() => (sfx.tap(), closeCelebration())}>
          👍 <T b={{ zh: '太棒了', en: 'Yay!' }} />
        </button>
      </div>
    </div>
  );
}

/** Number pad for parents (PIN). */
export function PinPad({ onSubmit, title, error }: { onSubmit: (pin: string) => void; title: Bi; error?: string }) {
  const [pin, setPin] = useState('');
  useEffect(() => {
    if (error) setPin('');
  }, [error]);
  const press = (d: string) => {
    sfx.tap();
    const next = (pin + d).slice(0, 8);
    setPin(next);
  };
  return (
    <div className="pinpad" data-testid="pinpad">
      <div className="pinpad-title">
        <T b={title} />
      </div>
      <div className="pin-dots">
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <i key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      {error && <div className="pin-error">{error}</div>}
      <div className="pin-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} data-testid={`pin-${d}`} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button onClick={() => setPin(pin.slice(0, -1))} aria-label="delete">
          ⌫
        </button>
        <button data-testid="pin-0" onClick={() => press('0')}>
          0
        </button>
        <button className="ok" data-testid="pin-ok" onClick={() => pin && onSubmit(pin)}>
          OK
        </button>
      </div>
    </div>
  );
}

/** Daily time limit reached: 小星 is sleepy; a parent PIN adds time. */
export function TimeLock() {
  const { locked, settings, unlockTime, go } = useApp();
  const [askPin, setAskPin] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  if (!locked) return null;
  return (
    <div className="timelock" data-testid="timelock">
      <div className="timelock-card">
        <Mascot mood="sleepy" size={220} />
        <Say b={{ zh: '今天的探索时间到啦！小星要睡觉了，明天见！', en: "Today's exploring time is over! Xiaoxing is going to sleep. See you tomorrow!" }} big />
        {!askPin && (
          <button className="link-btn" onClick={() => setAskPin(true)}>
            👨‍👩‍👧 家长 / Parents
          </button>
        )}
        {askPin && !ok && (
          <PinPad
            title={{ zh: '家长密码', en: 'Parent PIN' }}
            error={err}
            onSubmit={(p) => {
              if (hashPin(p) === settings.pinHash) {
                setOk(true);
                setErr('');
              } else setErr('密码不对 / Wrong PIN');
            }}
          />
        )}
        {ok && (
          <div className="row gap">
            {[10, 15, 30].map((m) => (
              <button key={m} className="big-btn" onClick={() => void unlockTime(m).then(() => (setOk(false), setAskPin(false)))}>
                +{m} min
              </button>
            ))}
            <button
              className="big-btn"
              onClick={() => {
                setOk(false);
                setAskPin(false);
                go({ name: 'parent' });
                void unlockTime(0);
              }}
            >
              ⚙️ 后台
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
