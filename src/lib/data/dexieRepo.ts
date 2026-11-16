import Dexie, { type Table } from 'dexie';
import { PRIMARY_KEYS, TABLE_NAMES, validateBackup, type Backup, type Collection, type Repo, type TableName } from './repo';

// Secondary indexes per table (primary key first).
const SCHEMA: Record<TableName, string> = {
  settings: 'id',
  profile: 'id',
  forest: 'id',
  ledger: 'id, ts, kind',
  bigStars: 'id, missionId, status',
  rewards: 'id',
  redemptions: 'id, status',
  logs: 'id, day, ts, module',
  cards: 'id, missionId, ts',
  progress: 'missionId, status',
  missions: 'id, status',
  usage: 'day',
  summaries: 'day',
};

class AiffDb extends Dexie {
  constructor(name: string) {
    super(name);
    this.version(1).stores(SCHEMA);
  }
}

class DexieCollection<T> implements Collection<T> {
  constructor(private t: Table<T, string>) {}
  get(key: string) {
    return this.t.get(key);
  }
  async put(v: T) {
    await this.t.put(v);
  }
  async bulkPut(vs: T[]) {
    await this.t.bulkPut(vs);
  }
  async delete(key: string) {
    await this.t.delete(key);
  }
  all() {
    return this.t.toArray();
  }
  where<F extends keyof T & string>(field: F, value: T[F] & (string | number)) {
    const indexed = this.t.schema.indexes.some((i) => i.name === field) || this.t.schema.primKey.name === field;
    if (indexed) return this.t.where(field).equals(value).toArray();
    return this.t.filter((r) => r[field] === value).toArray();
  }
  async clear() {
    await this.t.clear();
  }
}

export function createDexieRepo(name = 'ai-for-future'): Repo {
  const db = new AiffDb(name);
  const col = <T,>(n: TableName) => new DexieCollection<T>(db.table(n));
  const tables = Object.fromEntries(TABLE_NAMES.map((n) => [n, col(n)])) as unknown as Omit<
    Repo,
    'transaction' | 'exportAll' | 'importAll' | 'clearAll'
  >;
  void PRIMARY_KEYS;
  // Dexie's generic transaction overloads are too deep for tsc; the runtime contract is simple.
  function rw<R>(fn: () => Promise<R>): Promise<R> {
    const tx = db.transaction as unknown as (mode: string, tables: unknown, f: () => Promise<R>) => Promise<R>;
    return tx.call(db, 'rw', db.tables, fn);
  }
  return {
    ...tables,
    transaction: rw,
    async exportAll(): Promise<Backup> {
      const out: Backup = { app: 'ai-for-future', version: 1, exportedAt: Date.now(), tables: {} };
      for (const n of TABLE_NAMES) out.tables[n] = await db.table(n).toArray();
      return out;
    },
    async importAll(b) {
      if (!validateBackup(b)) throw new Error('invalid backup file');
      await rw(async () => {
        for (const n of TABLE_NAMES) {
          await db.table(n).clear();
          const rows = b.tables[n];
          if (Array.isArray(rows) && rows.length) await db.table(n).bulkPut(rows);
        }
      });
    },
    async clearAll() {
      await rw(async () => {
        for (const t of db.tables) await t.clear();
      });
    },
  };
}
