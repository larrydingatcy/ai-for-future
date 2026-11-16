import type {
  CustomMission,
  DailySummary,
  DailyUsage,
  ForestProgress,
  InfoCard,
  LedgerEntry,
  LogMessage,
  MissionProgress,
  PendingBigStar,
  Profile,
  Redemption,
  Reward,
  Settings,
} from '../types';

/**
 * Storage abstraction. The app only talks to this interface, so the on-device IndexedDB
 * implementation (DexieRepo) can later be swapped for a server-backed one without touching UI
 * or game logic.
 */
export interface Collection<T, K extends string = string> {
  get(key: K): Promise<T | undefined>;
  put(value: T): Promise<void>;
  bulkPut(values: T[]): Promise<void>;
  delete(key: K): Promise<void>;
  all(): Promise<T[]>;
  /** Exact-match lookup on an indexed field. */
  where<F extends keyof T & string>(field: F, value: T[F] & (string | number)): Promise<T[]>;
  clear(): Promise<void>;
}

export interface Tables {
  settings: Collection<Settings>;
  profile: Collection<Profile>;
  forest: Collection<ForestProgress>;
  ledger: Collection<LedgerEntry>;
  bigStars: Collection<PendingBigStar>;
  rewards: Collection<Reward>;
  redemptions: Collection<Redemption>;
  logs: Collection<LogMessage>;
  cards: Collection<InfoCard>;
  progress: Collection<MissionProgress>;
  missions: Collection<CustomMission>;
  usage: Collection<DailyUsage>;
  summaries: Collection<DailySummary>;
}

export type TableName = keyof Tables;

export const TABLE_NAMES: TableName[] = [
  'settings',
  'profile',
  'forest',
  'ledger',
  'bigStars',
  'rewards',
  'redemptions',
  'logs',
  'cards',
  'progress',
  'missions',
  'usage',
  'summaries',
];

/** Primary key field of each table. */
export const PRIMARY_KEYS: Record<TableName, string> = {
  settings: 'id',
  profile: 'id',
  forest: 'id',
  ledger: 'id',
  bigStars: 'id',
  rewards: 'id',
  redemptions: 'id',
  logs: 'id',
  cards: 'id',
  progress: 'missionId',
  missions: 'id',
  usage: 'day',
  summaries: 'day',
};

export interface Backup {
  app: 'ai-for-future';
  version: 1;
  exportedAt: number;
  tables: Partial<Record<TableName, unknown[]>>;
}

export interface Repo extends Tables {
  /** Run several writes atomically (all-or-nothing). */
  transaction<R>(fn: () => Promise<R>): Promise<R>;
  exportAll(): Promise<Backup>;
  importAll(b: Backup): Promise<void>;
  clearAll(): Promise<void>;
}

export function validateBackup(b: unknown): b is Backup {
  if (!b || typeof b !== 'object') return false;
  const o = b as Backup;
  return o.app === 'ai-for-future' && o.version === 1 && !!o.tables && typeof o.tables === 'object';
}
