import { PRIMARY_KEYS, TABLE_NAMES, validateBackup, type Backup, type Collection, type Repo, type TableName, type Tables } from './repo';

/** In-memory Repo — used by unit tests and as a fallback when IndexedDB is unavailable. */
class MemCollection<T> implements Collection<T> {
  private map = new Map<string, T>();
  constructor(private key: string) {}
  private k(v: T): string {
    return String((v as Record<string, unknown>)[this.key]);
  }
  async get(key: string) {
    const v = this.map.get(key);
    return v === undefined ? undefined : structuredClone(v);
  }
  async put(v: T) {
    this.map.set(this.k(v), structuredClone(v));
  }
  async bulkPut(vs: T[]) {
    for (const v of vs) this.map.set(this.k(v), structuredClone(v));
  }
  async delete(key: string) {
    this.map.delete(key);
  }
  async all() {
    return [...this.map.values()].map((v) => structuredClone(v));
  }
  async where<F extends keyof T & string>(field: F, value: T[F]) {
    return (await this.all()).filter((v) => v[field] === value);
  }
  async clear() {
    this.map.clear();
  }
  snapshot() {
    return new Map(this.map);
  }
  restore(m: Map<string, T>) {
    this.map = m;
  }
}

export function createMemoryRepo(): Repo {
  const tables = Object.fromEntries(TABLE_NAMES.map((n) => [n, new MemCollection(PRIMARY_KEYS[n])])) as unknown as Tables &
    Record<TableName, MemCollection<unknown>>;
  const repo: Repo = {
    ...tables,
    async transaction(fn) {
      const snaps = TABLE_NAMES.map((n) => [n, tables[n].snapshot()] as const);
      try {
        return await fn();
      } catch (e) {
        for (const [n, s] of snaps) tables[n].restore(s);
        throw e;
      }
    },
    async exportAll(): Promise<Backup> {
      const out: Backup = { app: 'ai-for-future', version: 1, exportedAt: Date.now(), tables: {} };
      for (const n of TABLE_NAMES) out.tables[n] = await tables[n].all();
      return out;
    },
    async importAll(b) {
      if (!validateBackup(b)) throw new Error('invalid backup file');
      for (const n of TABLE_NAMES) {
        await tables[n].clear();
        const rows = b.tables[n];
        if (Array.isArray(rows)) await tables[n].bulkPut(rows);
      }
    },
    async clearAll() {
      for (const n of TABLE_NAMES) await tables[n].clear();
    },
  };
  return repo;
}
