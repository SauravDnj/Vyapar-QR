import { UpstashRest, type RedisCommand } from './upstash-rest';

import type { Redis } from 'ioredis';

/**
 * The two Redis operations the JSON database and `StorageService` need. Two
 * transports implement it, because the Vercel Marketplace offers both kinds of
 * database:
 *
 *   - Upstash ("Upstash for Redis") injects `KV_REST_API_URL`/`KV_REST_API_TOKEN`
 *     and is spoken to over HTTP — `UpstashRest`.
 *   - Redis Cloud ("Redis") injects only `REDIS_URL`, a plain `redis://` URL,
 *     spoken to over TCP — `TcpRedis`.
 */
export interface RedisClient {
  command<T>(cmd: RedisCommand): Promise<T>;
  /** Runs the commands atomically (MULTI/EXEC). */
  transaction(cmds: RedisCommand[]): Promise<unknown[]>;
}

/** A `redis://` / `rediss://` connection through ioredis. */
export class TcpRedis implements RedisClient {
  private readonly client: Redis;

  constructor(url: string) {
    // Lazy require: a local or VPS deploy that never selects a Redis store
    // should not construct a client that tries to connect.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis: IoRedis } = require('ioredis') as typeof import('ioredis');
    this.client = new IoRedis(url, {
      // Fail a request rather than hang a serverless invocation until its
      // timeout when the database is unreachable.
      maxRetriesPerRequest: 2,
      connectTimeout: 10_000,
    });
  }

  async command<T>(cmd: RedisCommand): Promise<T> {
    const [name, ...args] = cmd;
    return (await this.client.call(String(name), ...args)) as T;
  }

  async transaction(cmds: RedisCommand[]): Promise<unknown[]> {
    // ioredis resolves each queued command as a method on the pipeline, and
    // those methods are lowercase — `['SET', …]` fails with "reading 'apply'".
    const results = await this.client
      .multi(cmds.map(([name, ...args]) => [String(name).toLowerCase(), ...args]))
      .exec();
    if (!results) throw new Error('Redis transaction was aborted');
    return results.map(([error, value]) => {
      if (error) throw new Error(`Redis transaction failed: ${error.message}`);
      return value;
    });
  }
}

/** The TCP URL for the data store — `JSONDB_REDIS_URL` wins over `REDIS_URL`. */
function tcpUrl(): string | undefined {
  return process.env.JSONDB_REDIS_URL ?? process.env.REDIS_URL;
}

export function isRedisStoreConfigured(): boolean {
  return UpstashRest.isConfigured() || Boolean(tcpUrl());
}

let shared: RedisClient | undefined;

/**
 * One client per process, shared by the database and file storage so a warm
 * serverless instance holds a single connection. Upstash REST is preferred
 * when both are configured: it needs no connection at all.
 */
export function redisClientFromEnv(): RedisClient {
  if (shared) return shared;
  const url = tcpUrl();
  if (UpstashRest.isConfigured()) {
    shared = UpstashRest.fromEnv();
  } else if (url) {
    shared = new TcpRedis(url);
  } else {
    throw new Error(
      'Redis store is not configured: set REDIS_URL, or KV_REST_API_URL and KV_REST_API_TOKEN',
    );
  }
  return shared;
}
