'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { T } from './ui';
import { sfx } from '@/lib/sfx';
import { SttError, startListening, type ListenSession } from '@/lib/speech/stt';
import type { Bi } from '@/lib/types';

const HOLD_LABEL: Bi = { zh: '按住说话', en: 'Hold to talk' };
const LISTENING: Bi = { zh: '我在听…', en: "I'm listening…" };
const TAP_STOP: Bi = { zh: '说完点一下', en: 'Tap when done' };
const NOT_HEARD: Bi = { zh: '小星没听清，再说一次好吗？', en: "I didn't catch that. Can you say it again?" };
const NO_MIC: Bi = { zh: '小星听不到你的声音，请大人帮忙打开麦克风哦！', en: "I can't hear you. Ask a grown-up to turn on the microphone!" };

/**
 * The child's main input: hold the big mic while talking (or tap once to start, tap again to stop).
 * When a parent enables "typing assist", a keyboard box appears next to it.
 */
export function HoldToTalk({
  onResult,
  label = HOLD_LABEL,
  disabled,
  testId = 'mic',
  size = 'lg',
  color,
}: {
  onResult: (text: string) => void | Promise<void>;
  label?: Bi;
  disabled?: boolean;
  testId?: string;
  size?: 'md' | 'lg';
  color?: string;
}) {
  const { settings, say, setMicIssue, speak } = useApp();
  const [state, setState] = useState<'idle' | 'starting' | 'listening' | 'processing'>('idle');
  const [interim, setInterim] = useState('');
  const [tapMode, setTapMode] = useState(false);
  const [typed, setTyped] = useState('');
  const session = useRef<ListenSession | null>(null);
  const downAt = useRef(0);
  const releasedEarly = useRef(false);
  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => session.current?.cancel(), []);

  const finish = async () => {
    const s = session.current;
    session.current = null;
    if (autoStop.current) clearTimeout(autoStop.current);
    if (!s) return;
    setState('processing');
    sfx.listenStop();
    try {
      const text = (await s.stop()).trim();
      setInterim('');
      setTapMode(false);
      setState('idle');
      if (!text) {
        sfx.soft();
        void say(NOT_HEARD, { mood: 'surprised' });
        return;
      }
      await onResult(text);
    } catch (e) {
      setState('idle');
      setTapMode(false);
      handleError(e);
    }
  };

  const handleError = (e: unknown) => {
    const code = e instanceof SttError ? e.code : 'failed';
    if (code === 'unsupported' || code === 'denied') setMicIssue(code);
    sfx.soft();
    void say(code === 'unsupported' || code === 'denied' ? NO_MIC : NOT_HEARD, { mood: 'surprised' });
  };

  const begin = async () => {
    if (disabled || state !== 'idle') return;
    setState('starting');
    releasedEarly.current = false;
    downAt.current = Date.now();
    sfx.listenStart();
    try {
      const lang = settings.lang === 'en' ? 'en' : 'zh';
      session.current = await startListening(settings, lang, setInterim);
      setMicIssue(null);
      setState('listening');
      autoStop.current = setTimeout(() => void finish(), 25000);
      if (releasedEarly.current) {
        // A quick tap: keep listening until the next tap.
        setTapMode(true);
      }
    } catch (e) {
      session.current = null;
      setState('idle');
      handleError(e);
    }
  };

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (state === 'listening' && tapMode) return void finish();
    void begin();
  };

  const onUp = () => {
    if (state === 'starting') {
      releasedEarly.current = true;
      return;
    }
    if (state !== 'listening' || tapMode) return;
    if (Date.now() - downAt.current < 450) {
      setTapMode(true);
      void speak(TAP_STOP);
      return;
    }
    void finish();
  };

  const sendTyped = async () => {
    const t = typed.trim();
    if (!t || disabled) return;
    sfx.tap();
    setTyped('');
    await onResult(t);
  };

  const active = state === 'listening' || state === 'starting';
  return (
    <div className={`talk talk-${size}`}>
      <button
        className={`mic-btn ${active ? 'listening' : ''} ${state === 'processing' ? 'processing' : ''}`}
        style={color ? { ['--mic' as string]: color } : undefined}
        data-testid={testId}
        disabled={disabled}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={`${label.zh} ${label.en}`}
      >
        <span className="mic-rings">
          <i />
          <i />
        </span>
        <span className="mic-icon">🎤</span>
      </button>
      <div className="talk-label">
        <T b={active ? (tapMode ? TAP_STOP : LISTENING) : label} />
      </div>
      {interim && <div className="interim">“{interim}”</div>}
      {settings.typingAssist && (
        <form
          className="typing-assist"
          onSubmit={(e) => {
            e.preventDefault();
            void sendTyped();
          }}
        >
          <span aria-hidden>⌨️</span>
          <input
            data-testid={`${testId}-input`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="家长代打字 / parent typing"
            disabled={disabled}
          />
          <button type="submit" data-testid={`${testId}-send`} disabled={disabled || !typed.trim()}>
            ➤
          </button>
        </form>
      )}
    </div>
  );
}
