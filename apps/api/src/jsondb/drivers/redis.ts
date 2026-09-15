import type { RedisClient } from './redis-client';
import type { JsonDbDriver } from './types';

/**
 * Stores each JSON collection as one string key in Redis — Upstash over REST
 * or any Redis over TCP, see `redis-client.ts`.
 *
 * This replaced `VercelBlobDriver` as the Vercel store. Blob is the wrong tool
 * for a database: every read there is a `list()` plus a CDN fetch of a
 * never-before-seen URL, which exhausted the Hobby plan's monthly operation
 * allowance within days — at which point Vercel blocks the store, every read
 * returns 403 "Your store is blocked", and every API call touching the
 * database (login included) fails with a 500.
 *
 * Redis has none of Blob's problems: a `SET` is visible to the very next `GET`
 * from any instance, so there is no stale-read or versioning machinery here,
 * and a read is a single command.
 *
 * Concurrent writes from two instances are still last-write-wins, exactly as
 * with the other drivers — see `JsonStore`.
 */
export class RedisDriver implements JsonDbDriver {
  readonly name = 'redis';

  constructor(
    private readonly redis: RedisClient,
    private readonly prefix = 'jsondb',
  ) {}

  private key(collection: string): string {
    return `${this.prefix}:${collection}`;
  }

  /** Set of collection names, so `list()` needs no `SCAN` over the keyspace. */
  private get indexKey(): string {
    return `${this.prefix}:__collections`;
  }

  async read(collection: string): Promise<unknown[] | null> {
    const raw = await this.redis.command<string | null>(['GET', this.key(collection)]);
    return raw === null ? null : (JSON.parse(raw) as unknown[]);
  }

  async write(collection: string, rows: unknown[]): Promise<void> {
    // One transaction so the value and its index entry land together.
    await this.redis.transaction([
      ['SET', this.key(collection), JSON.stringify(rows)],
      ['SADD', this.indexKey, collection],
    ]);
  }

  async list(): Promise<string[]> {
    return this.redis.command<string[]>(['SMEMBERS', this.indexKey]);
  }
}
