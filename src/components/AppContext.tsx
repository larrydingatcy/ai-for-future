'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createDexieRepo } from '@/lib/data/dexieRepo';
import { createMemoryRepo } from '@/lib/data/memoryRepo';
import { GameService, type Wallet } from '@/lib/services/game';
import { ping } from '@/lib/ai/llm';
import type { MentorCtx, Mode } from '@/lib/ai/mentor';
import { speakParts } from '@/lib/i18n';
import { leveledUp, type LevelTitle } from '@/lib/logic/levels';
import { sfx } from '@/lib/sfx';
import { tts } from '@/lib/speech/tts';
import type { Bi, MascotMood, Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { uid } from '@/lib/util';

export type View =
  | { name: 'splash' }
  | { name: 'home' }
  | { name: 'forest' }
  | { name: 'base' }
  | { name: 'mission'; id: string }
  | { name: 'album' }
  | { name: 'badges' }
  | { name: 'shop' }
  | { name: 'parent' };

export interface Burst {
  id: string;
  amount: number;
  label?: Bi;
  big?: boolean;
}

export interface Celebration {
  id: string;
  title: Bi;
  subtitle?: Bi;
  stars?: number;
  icon?: string;
}

interface Ctx {
  game: GameService;
  ready: boolean;
  settings: Settings;
  saveSettings: (p: Partial<Settings>) => Promise<void>;
  wallet: Wallet;
  refresh: () => Promise<void>;
  dataVersion: number;
  view: View;
  go: (v: View) => void;
  mode: Mode | 'checking';
  modeDetail: string;
  recheckMode: () => Promise<void>;
  mentor: () => MentorCtx;
  // 小星
  mood: MascotMood;
  displayMood: MascotMood;
  setMood: (m: MascotMood) => void;
  line: Bi | null;
  thinking: boolean;
  speaking: boolean;
  say: (b: Bi, opts?: { mood?: MascotMood; silent?: boolean }) => Promise<void>;
  speak: (b: Bi) => Promise<void>;
  think: <T>(p: Promise<T>) => Promise<T>;
  // rewards & feedback
  reward: (amount: number, label?: Bi, opts?: { big?: boolean }) => Promise<void>;
  bursts: Burst[];
  celebration: Celebration | null;
  celebrate: (c: Omit<Celebration, 'id'>) => void;
  closeCelebration: () => void;
  // time limit
  locked: boolean;
  remainingSec: number;
  unlockTime: (extraMin: number) => Promise<void>;
  micIssue: string | null;
  setMicIssue: (s: string | null) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

const EMPTY_WALLET: Wallet = { balance: 0, available: 0, totalEarned: 0, pendingBig: 0, reserved: 0 };

function makeRepo() {
  try {
    if (typeof indexedDB !== 'undefined') return createDexieRepo();
  } catch {
    /* private mode etc. */
  }
  return createMemoryRepo();
}

export function AppProvider({ children }: { children: ReactNode }) {
  const game = useMemo(() => new GameService(makeRepo()), []);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [wallet, setWallet] = useState<Wallet>(EMPTY_WALLET);
  const [dataVersion, setDataVersion] = useState(0);
  const [view, setView] = useState<View>({ name: 'splash' });
  const [mode, setMode] = useState<Mode | 'checking'>('checking');
  const [modeDetail, setModeDetail] = useState('');
  const [mood, setMood] = useState<MascotMood>('happy');
  const [line, setLine] = useState<Bi | null>(null);
  const [thinkingCount, setThinkingCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [locked, setLocked] = useState(false);
  const [remainingSec, setRemainingSec] = useState(30 * 60);
  const [micIssue, setMicIssue] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const viewRef = useRef(view);
  viewRef.current = view;

  const refresh = useCallback(async () => {
    setWallet(await game.wallet());
    setDataVersion((v) => v + 1);
  }, [game]);

  const recheckMode = useCallback(async () => {
    const s = settingsRef.current;
    if (s.forceDemo) {
      setMode('demo');
      setModeDetail('forced');
      return;
    }
    setMode('checking');
    const r = await ping({ baseUrl: s.baseUrl, apiKey: s.apiKey });
    if (r.ok) {
      setMode('llm');
      setModeDetail(r.models.length ? r.models.slice(0, 6).join(', ') : 'connected');
    } else {
      setMode('demo');
      setModeDetail(r.error ?? 'unreachable');
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await game.settings();
      setSettings(s);
      settingsRef.current = s;
      setWallet(await game.wallet());
      setRemainingSec(await game.remainingSeconds());
      setReady(true);
      void recheckMode();
    })();
    return tts.onChange(setSpeaking);
  }, [game, recheckMode]);

  const saveSettings = useCallback(
    async (p: Partial<Settings>) => {
      const next = await game.saveSettings(p);
      setSettings(next);
      settingsRef.current = next;
      if ('baseUrl' in p || 'apiKey' in p || 'forceDemo' in p) void recheckMode();
      if ('dailyLimitMin' in p) setRemainingSec(await game.remainingSeconds());
    },
    [game, recheckMode],
  );

  const mentor = useCallback(
    (): MentorCtx => ({
      settings: settingsRef.current,
      mode: modeRef.current === 'llm' ? 'llm' : 'demo',
      onFallback: (e) => {
        console.warn('LLM failed, using demo mode', e);
        setMode('demo');
        setModeDetail(e instanceof Error ? e.message : String(e));
        // Try the real model again a bit later.
        setTimeout(() => void recheckMode(), 60000);
      },
    }),
    [recheckMode],
  );

  const speak = useCallback(async (b: Bi) => {
    const s = settingsRef.current;
    await tts.speak(speakParts(b, s.lang), { voiceZh: s.voiceZh, voiceEn: s.voiceEn, rate: s.ttsRate });
  }, []);

  const say = useCallback(
    async (b: Bi, opts: { mood?: MascotMood; silent?: boolean } = {}) => {
      setLine(b);
      if (opts.mood) setMood(opts.mood);
      if (!opts.silent) await speak(b);
    },
    [speak],
  );

  const think = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    setThinkingCount((n) => n + 1);
    try {
      return await p;
    } finally {
      setThinkingCount((n) => Math.max(0, n - 1));
    }
  }, []);

  const celebrate = useCallback((c: Omit<Celebration, 'id'>) => {
    sfx.fanfare();
    setMood('clapping');
    setCelebration({ ...c, id: uid('c') });
  }, []);

  const reward = useCallback(
    async (amount: number, label?: Bi, opts: { big?: boolean } = {}) => {
      if (amount <= 0) return;
      const before = walletRef.current.totalEarned;
      sfx.star(amount);
      setMood('clapping');
      const id = uid('b');
      setBursts((b) => [...b, { id, amount, label, big: opts.big }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 2200);
      const w = await game.wallet();
      setWallet(w);
      setDataVersion((v) => v + 1);
      const up: LevelTitle | null = leveledUp(before, w.totalEarned);
      if (up) {
        setTimeout(
          () =>
            celebrate({
              title: { zh: `升级啦！你是"${up.title.zh}"了！`, en: `Level up! You are a ${up.title.en}!` },
              icon: up.icon,
            }),
          1400,
        );
      }
    },
    [game, celebrate],
  );

  const closeCelebration = useCallback(() => {
    setCelebration(null);
    setMood('happy');
  }, []);

  const go = useCallback((v: View) => {
    tts.cancel();
    setLine(null);
    setMood('happy');
    setView(v);
  }, []);

  // ---- daily time limit: count active, visible time on child screens ----
  useEffect(() => {
    if (!ready) return;
    const TICK = 5;
    let warned = false;
    const t = setInterval(async () => {
      const v = viewRef.current.name;
      if (document.hidden || v === 'splash' || v === 'parent') return;
      await game.addUsage(TICK);
      const rem = await game.remainingSeconds();
      setRemainingSec(rem);
      if (rem <= 120 && rem > 0 && !warned) {
        warned = true;
        void say({ zh: '还有两分钟就要休息啦，我们把这一步做完吧！', en: 'Two more minutes, then it is rest time. Let us finish this step!' });
      }
      if (rem <= 0) setLocked((was) => {
        if (!was) {
          tts.cancel();
          setMood('sleepy');
          void say(
            { zh: '今天玩了好久啦，小星有点困了。我们明天再一起探索吧！', en: 'We played a lot today and I am sleepy. Let us explore again tomorrow!' },
            { mood: 'sleepy' },
          );
        }
        return true;
      });
    }, TICK * 1000);
    return () => clearInterval(t);
  }, [ready, game, say]);

  useEffect(() => {
    if (ready && remainingSec > 0 && locked) setLocked(false);
  }, [ready, remainingSec, locked]);

  const unlockTime = useCallback(
    async (extraMin: number) => {
      if (extraMin > 0) await game.extendToday(extraMin);
      const rem = await game.remainingSeconds();
      setRemainingSec(rem);
      if (rem > 0) {
        setLocked(false);
        setMood('happy');
      }
    },
    [game],
  );

  const thinking = thinkingCount > 0;
  const displayMood: MascotMood = thinking ? 'thinking' : speaking && (mood === 'happy' || mood === 'surprised') ? 'talking' : mood;

  // Return to a calm face a moment after clapping.
  useEffect(() => {
    if (mood !== 'clapping' || celebration) return;
    const t = setTimeout(() => setMood('happy'), 2600);
    return () => clearTimeout(t);
  }, [mood, celebration]);

  const value: Ctx = {
    game,
    ready,
    settings,
    saveSettings,
    wallet,
    refresh,
    dataVersion,
    view,
    go,
    mode,
    modeDetail,
    recheckMode,
    mentor,
    mood,
    displayMood,
    setMood,
    line: thinking ? null : line,
    thinking,
    speaking,
    say,
    speak,
    think,
    reward,
    bursts,
    celebration,
    celebrate,
    closeCelebration,
    locked,
    remainingSec,
    unlockTime,
    micIssue,
    setMicIssue,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
