import { Injectable } from '@nestjs/common';

import type { ThrottlerStorage } from '@nestjs/throttler';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

interface Counter {
  hits: number;
  expiresAt: number;
  blockedUntil: number;
}

/**
 * Rate-limit counters held in process memory, used when there's no Redis —
 * which is the case on Vercel, where a serverless function has no shared
 * store to reach.
 *
 * The tradeoff is real and worth stating: each serverless instance keeps its
 * own counters, so the effective limit is `limit x live instances` rather than
 * a single global limit. That still stops a naive flood from one client, but
 * it is weaker than the Redis-backed limit a VPS deploy gets. Set `REDIS_URL`
 * (e.g. Upstash) to restore exact global limits on Vercel.
 */
@Injectable()
export class MemoryThrottlerStorage implements ThrottlerStorage {
  private readonly counters = new Map<string, Counter>();
  private lastSweep = Date.now();

  /** Drops expired counters so a long-lived instance doesn't grow unbounded. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, counter] of this.counters) {
      if (counter.expiresAt <= now && counter.blockedUntil <= now) {
        this.counters.delete(key);
      }
    }
  }

  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    this.sweep(now);

    const mapKey = `${key}:${throttlerName}`;
    let counter = this.counters.get(mapKey);

    if (counter && counter.blockedUntil > now) {
      return Promise.resolve({
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.ceil((counter.blockedUntil - now) / 1000),
      });
    }

    if (!counter || counter.expiresAt <= now) {
      counter = { hits: 0, expiresAt: now + ttl, blockedUntil: 0 };
      this.counters.set(mapKey, counter);
    }

    counter.hits += 1;
    const timeToExpire = Math.ceil(Math.max(counter.expiresAt - now, 0) / 1000);

    let isBlocked = false;
    let timeToBlockExpire = 0;
    if (counter.hits > limit) {
      isBlocked = true;
      if (blockDuration > 0) {
        counter.blockedUntil = now + blockDuration;
        timeToBlockExpire = Math.ceil(blockDuration / 1000);
      } else {
        timeToBlockExpire = timeToExpire;
      }
    }

    return Promise.resolve({
      totalHits: counter.hits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire,
    });
  }
}
