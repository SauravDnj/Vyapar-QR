import type { JsonDbDriver } from './drivers/types';
import type { Row } from './query/where';

/**
 * Holds the JSON collections in memory and writes them back through a driver.
 *
 * Concurrency, stated plainly: a JSON-document store has no row-level locking.
 * Within one process, every mutation is funnelled through `mutate()`, which
 * serialises on a per-collection promise chain and re-reads the collection
 * immediately before applying — so read-modify-write races inside an instance
 * are safe. Across *concurrent serverless instances* two writes to the same
 * collection can still clobber one another (last write wins). That is inherent
 * to file-backed storage and is acceptable for this workload's write volume;
 * it is the main reason to move to a real database as traffic grows.
 */
export class JsonStore {
  private cache = new Map<string, { rows: Row[]; loadedAt: number }>();
  private chains = new Map<string, Promise<unknown>>();

  constructor(
    private readonly driver: JsonDbDriver,
    /**
     * How long a loaded collection may be served from memory. Zero disables
     * caching entirely, which is the right setting on serverless where two
     * instances can otherwise drift apart.
     */
    private readonly ttlMs = Number(process.env.JSONDB_CACHE_TTL_MS ?? 0),
  ) {}

  async load(collection: string): Promise<Row[]> {
    const hit = this.cache.get(collection);
    if (hit && this.ttlMs > 0 && Date.now() - hit.loadedAt < this.ttlMs) {
      return hit.rows;
    }
    const rows = ((await this.driver.read(collection)) ?? []) as Row[];
    this.cache.set(collection, { rows, loadedAt: Date.now() });
    return rows;
  }

  private async persist(collection: string, rows: Row[]): Promise<void> {
    await this.driver.write(collection, rows);
    this.cache.set(collection, { rows, loadedAt: Date.now() });
  }

  /**
   * Runs `fn` against a freshly-read copy of the collection, serialised
   * against every other mutation of that same collection in this process.
   * `fn` returns the rows to persist plus whatever the caller needs back.
   */
  async mutate<T>(
    collection: string,
    fn: (rows: Row[]) => { rows: Row[]; result: T } | Promise<{ rows: Row[]; result: T }>,
  ): Promise<T> {
    const previous = this.chains.get(collection) ?? Promise.resolve();

    const next = previous.then(async () => {
      // Bypass the cache: the point of the queue is that we act on current data.
      const rows = ((await this.driver.read(collection)) ?? []) as Row[];
      const { rows: updated, result } = await fn(rows);
      await this.persist(collection, updated);
      return result;
    });

    // Keep the chain alive even if this link rejects, so one failed write
    // doesn't wedge every later write to the collection.
    this.chains.set(
      collection,
      next.catch(() => undefined),
    );
    return next;
  }

  /** Drops the in-memory cache. Used between tests and after a seed. */
  invalidate(collection?: string): void {
    if (collection) this.cache.delete(collection);
    else this.cache.clear();
  }

  listCollections(): Promise<string[]> {
    return this.driver.list();
  }

  get driverName(): string {
    return this.driver.name;
  }
}
