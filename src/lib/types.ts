// ---------- Core domain types for AI for Future ----------

export type Lang = 'zh' | 'en' | 'both';

/** A bilingual string. Either side may be empty; display helpers fall back to the other. */
export interface Bi {
  zh: string;
  en: string;
}

export type QuestionType = 'what' | 'why' | 'how' | 'whatif' | 'really';

export type InfoSource = 'ask_mentor' | 'ask_family' | 'observe' | 'photo';

export type MascotMood = 'happy' | 'thinking' | 'surprised' | 'clapping' | 'talking' | 'sleepy';

// ---------- Content (JSON-driven) ----------

export interface Mission {
  id: string;
  icon: string; // emoji shown on the mission card
  title_zh: string;
  title_en: string;
  brief_zh: string; // read aloud by TTS
  brief_en: string;
  difficulty: 1 | 2 | 3;
  unlock_requires: string[]; // mission ids that must be completed (parent-confirmed) first
  understand_check: Bi[]; // key points the child's retelling should cover
  info_hints: Bi[];
  plan_rubric: Bi[];
  result_rubric: Bi[]; // in child language
  reflection_prompts: Bi[];
  est_minutes: number;
}

export type ForestRule =
  | { type: 'first_question' }
  | { type: 'ask_type'; qtype: QuestionType }
  | { type: 'follow_up_streak'; count: number }
  | { type: 'challenge_with_reason' }
  | { type: 'compare_choose' };

export interface ForestLevel {
  id: string;
  icon: string;
  title_zh: string;
  title_en: string;
  goal_zh: string; // spoken to the child: what to do in this level
  goal_en: string;
  rule: ForestRule;
  reward_stars: number;
}

// ---------- Persistent records ----------

export type LedgerKind = 'forest' | 'step' | 'big' | 'daily' | 'streak' | 'redeem' | 'adjust';

/** Every star movement is an immutable ledger row. Balance = sum(amount). */
export interface LedgerEntry {
  id: string;
  ts: number;
  amount: number; // positive = earned, negative = spent
  kind: LedgerKind;
  reason: string;
  refId?: string;
}

export type ReviewStatus = 'pending' | 'confirmed' | 'rejected';

/** Mission "通关大星": waits for a parent before it reaches the ledger. */
export interface PendingBigStar {
  id: string;
  missionId: string;
  stars: number; // proposed by 小星 (1-3)
  finalStars?: number; // what the parent confirmed
  praise: Bi;
  suggestion: Bi;
  resultImage?: string;
  ts: number;
  status: ReviewStatus;
  resolvedTs?: number;
  celebrated: boolean; // child has seen the celebration after confirmation
}

export interface Reward {
  id: string;
  name: string;
  image?: string; // data URL
  cost: number;
  active: boolean;
  createdTs: number;
}

export interface Redemption {
  id: string;
  rewardId: string;
  rewardName: string;
  cost: number;
  ts: number;
  status: ReviewStatus;
  resolvedTs?: number;
  note?: string;
}

export interface LogMessage {
  id: string;
  ts: number;
  day: string; // YYYY-MM-DD (local)
  module: 'forest' | 'mission' | 'system';
  missionId?: string;
  role: 'child' | 'mentor';
  text: string;
  image?: string;
  qtype?: QuestionType;
  safety?: boolean;
  mode?: 'llm' | 'demo';
}

export interface InfoCard {
  id: string;
  ts: number;
  missionId: string;
  source: InfoSource;
  text: string;
  image?: string;
}

export type MissionStatus = 'active' | 'awaiting' | 'done';

export interface MissionProgress {
  missionId: string;
  status: MissionStatus;
  step: 1 | 2 | 3 | 4;
  startedTs: number;
  updatedTs: number;
  retellAttempts: number;
  understood: boolean;
  cardIds: string[];
  planImage?: string;
  planText?: string;
  planFeedback?: { praise: Bi; question: Bi; stars: number };
  planImproved: boolean;
  planDone: boolean;
  resultImage?: string;
  reflections: string[];
  reflectionDone: boolean;
  completedTs?: number;
  bigStarId?: string;
  attempts: number; // how many times the mission was (re)submitted
}

export interface CustomMission extends Mission {
  source: 'parent' | 'ai' | 'preset-edit';
  status: 'pending' | 'approved' | 'rejected';
  enabled: boolean;
  createdTs: number;
}

export interface ForestProgress {
  id: 'forest';
  completedLevels: string[]; // in order
  typeCounts: Record<QuestionType, number>;
  totalQuestions: number;
  challenges: number;
  comparisons: number;
}

export interface Profile {
  id: 'profile';
  lastLoginDay?: string;
  streak: number;
  bestStreak: number;
  createdTs: number;
}

export interface DailyUsage {
  day: string;
  activeSeconds: number;
  extraMinutes: number; // parent extensions for that day
}

export interface DailySummary {
  day: string;
  generatedTs: number;
  mode: 'llm' | 'local';
  questions: { text: string; qtype?: QuestionType }[];
  typeCounts: Record<QuestionType, number>;
  interests: string[];
  safetyFlags: { ts: number; text: string }[];
  starsEarned: number;
  minutesUsed: number;
  narrative?: string;
}

export type SttKind = 'webspeech' | 'whisper' | 'openai';

export interface Settings {
  id: 'settings';
  lang: Lang;
  baseUrl: string;
  apiKey: string;
  textModel: string;
  visionModel: string;
  forceDemo: boolean;
  sttKind: SttKind;
  sttUrl: string;
  sttModel: string;
  voiceZh: string; // voiceURI, '' = auto
  voiceEn: string;
  ttsRate: number;
  dailyLimitMin: number;
  pinHash: string;
  pinChanged: boolean;
  systemPrompt: string; // '' = built-in default
  typingAssist: boolean; // show keyboard input beside mic (parent helper)
  dialecticRatio: number; // ~1/3
}

/** Evaluation contract shared by every rubric-based 小星 judgement. */
export interface Evaluation {
  stars: number;
  praise: Bi;
  one_question_or_suggestion: Bi;
  safety_flag: boolean;
}
