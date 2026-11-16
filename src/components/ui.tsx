'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useApp } from './AppContext';
import { Mascot } from './Mascot';
import { pick } from '@/lib/i18n';
import { levelProgress } from '@/lib/logic/levels';
import { sfx } from '@/lib/sfx';
import type { Bi, Lang } from '@/lib/types';

export function useLang(): Lang {
  return useApp().settings.lang;
}

/** Text in the current language, rendered line by line (zh + en in "both"). */
export function T({ b, className }: { b: Bi; className?: string }) {
  const lang = useLang();
  const s = pick(b, lang);
  const parts = s.split('\n');
  return (
    <span className={className}>
      {parts.map((p, i) => (
        <span key={i} className={i > 0 ? 'en-line' : undefined}>
          {p}
        </span>
      ))}
    </span>
  );
}

export function SpeakButton({ b, size = 'md', testId }: { b: Bi; size?: 'sm' | 'md' | 'lg'; testId?: string }) {
  const { speak } = useApp();
  return (
    <button
      className={`speak-btn speak-${size}`}
      aria-label="朗读 Read aloud"
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation();
        sfx.tap();
        void speak(b);
      }}
    >
      🔊
    </button>
  );
}

/** Text + speaker button. Every readable sentence in the child UI goes through this. */
export function Say({ b, className, big }: { b: Bi; className?: string; big?: boolean }) {
  return (
    <div className={`say ${big ? 'say-big' : ''} ${className ?? ''}`}>
      <T b={b} className="say-text" />
      <SpeakButton b={b} size={big ? 'lg' : 'md'} />
    </div>
  );
}

const THINKING: Bi = { zh: '小星想一想', en: 'Xiaoxing is thinking' };

/** 小星 with a speech bubble showing the current line (or animated thinking dots). */
export function Mentor({ size = 220, layout = 'column' }: { size?: number; layout?: 'column' | 'row' }) {
  const { displayMood, line, thinking, setMood } = useApp();
  return (
    <div className={`mentor mentor-${layout}`}>
      <button
        className="mascot-btn"
        aria-label="小星"
        onClick={() => {
          sfx.pop();
          setMood('surprised');
          setTimeout(() => setMood('happy'), 900);
        }}
      >
        <Mascot mood={displayMood} size={size} />
      </button>
      {(line || thinking) && (
        <div className={`bubble ${thinking ? 'bubble-thinking' : ''}`} data-testid="mentor-bubble">
          {thinking ? (
            <div className="thinking-row">
              <T b={THINKING} />
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : (
            line && <Say b={line} />
          )}
        </div>
      )}
    </div>
  );
}

export function StarCounter() {
  const { wallet, dataVersion } = useApp();
  const [bump, setBump] = useState(false);
  const prev = useRef(wallet.balance);
  useEffect(() => {
    if (wallet.balance > prev.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 700);
      prev.current = wallet.balance;
      return () => clearTimeout(t);
    }
    prev.current = wallet.balance;
  }, [wallet.balance, dataVersion]);
  return (
    <div className={`star-counter ${bump ? 'bump' : ''}`} data-testid="star-balance" data-balance={wallet.balance}>
      <span className="star-icon">⭐</span>
      <b>{wallet.balance}</b>
      {wallet.pendingBig > 0 && (
        <span className="pending-chip" title="等待家长确认">
          🎁 {wallet.pendingBig}
        </span>
      )}
    </div>
  );
}

export function LevelChip() {
  const { wallet, speak } = useApp();
  const { cur, next, ratio } = levelProgress(wallet.totalEarned);
  const label: Bi = next
    ? { zh: `${cur.title.zh}，再得 ${next.min - wallet.totalEarned} 颗星就是${next.title.zh}`, en: `${cur.title.en}. ${next.min - wallet.totalEarned} more stars to ${next.title.en}` }
    : cur.title;
  return (
    <button className="level-chip" onClick={() => (sfx.tap(), void speak(label))} data-testid="level-chip">
      <span className="level-icon">{cur.icon}</span>
      <span className="level-text">
        <T b={cur.title} />
        <span className="level-bar">
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
      </span>
    </button>
  );
}

const LANG_CYCLE: Lang[] = ['zh', 'en', 'both'];
const LANG_LABEL: Record<Lang, string> = { zh: '中', en: 'EN', both: '中/EN' };

export function LangToggle() {
  const { settings, saveSettings } = useApp();
  return (
    <button
      className="round-btn lang-btn"
      data-testid="lang-toggle"
      aria-label="语言 Language"
      onClick={() => {
        sfx.tap();
        const i = LANG_CYCLE.indexOf(settings.lang);
        void saveSettings({ lang: LANG_CYCLE[(i + 1) % LANG_CYCLE.length] });
      }}
    >
      🌐<small>{LANG_LABEL[settings.lang]}</small>
    </button>
  );
}

/** Hold for 1.5 s to open the parent area — kids won't stumble in by tapping. */
export function ParentLock({ onOpen }: { onOpen: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => {
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      sfx.unlock();
      onOpen();
    }, 1500);
  };
  const stop = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <button
      className={`round-btn parent-lock ${holding ? 'holding' : ''}`}
      data-testid="parent-lock"
      aria-label="家长 Parents (hold)"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      🔒
      <svg className="hold-ring" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="17" />
      </svg>
    </button>
  );
}

export function TopBar({ title, back = true, extra }: { title?: Bi; back?: boolean; extra?: ReactNode }) {
  const { go } = useApp();
  return (
    <header className="topbar">
      <div className="topbar-left">
        {back && (
          <button className="round-btn home-btn" data-testid="home-btn" aria-label="首页 Home" onClick={() => (sfx.tap(), go({ name: 'home' }))}>
            🏠
          </button>
        )}
        {title && (
          <div className="topbar-title">
            <Say b={title} />
          </div>
        )}
        {extra}
      </div>
      <div className="topbar-right">
        <LevelChip />
        <StarCounter />
        <LangToggle />
        <ParentLock onOpen={() => go({ name: 'parent' })} />
      </div>
    </header>
  );
}

/** Huge icon tile used for navigation; speaks its label on tap so non-readers know what it is. */
export function Tile({
  icon,
  label,
  onClick,
  color,
  size = 'md',
  testId,
  disabled,
  badge,
  glow,
  style,
}: {
  icon: ReactNode;
  label: Bi;
  onClick?: () => void;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  testId?: string;
  disabled?: boolean;
  badge?: ReactNode;
  glow?: boolean;
  style?: CSSProperties;
}) {
  const { speak } = useApp();
  return (
    <button
      className={`tile tile-${size} ${glow ? 'glow' : ''}`}
      style={{ ...(color ? { ['--tile' as string]: color } : {}), ...style }}
      data-testid={testId}
      disabled={disabled}
      onClick={() => {
        sfx.tap();
        void speak(label);
        onClick?.();
      }}
    >
      <span className="tile-icon">{icon}</span>
      <T b={label} className="tile-label" />
      {badge && <span className="tile-badge">{badge}</span>}
    </button>
  );
}

export function Stars({ n, max = 3, size = 28 }: { n: number; max?: number; size?: number }) {
  return (
    <span className="stars" style={{ fontSize: size }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? 'on' : 'off'}>
          ★
        </span>
      ))}
    </span>
  );
}
