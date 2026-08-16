import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import type { ThrottlerStorage } from '@nestjs/throttler';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttle:{${key}}:${throttlerName}`;
    const blockKey = `throttle:{${key}}:${throttlerName}:blocked`;

    const blockPttl = await this.redis.pttl(blockKey);
    if (blockPttl > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockPttl / 1000),
      };
    }

    const totalHits = await this.redis.incr(hitsKey);
    if (totalHits === 1) {
      await this.redis.pexpire(hitsKey, ttl);
    }
    const hitsPttl = await this.redis.pttl(hitsKey);
    const timeToExpire = Math.ceil(Math.max(hitsPttl, 0) / 1000);

    let isBlocked = false;
    let timeToBlockExpire = 0;
    if (totalHits > limit) {
      isBlocked = true;
      if (blockDuration > 0) {
        await this.redis.set(blockKey, '1', 'PX', blockDuration);
        timeToBlockExpire = Math.ceil(blockDuration / 1000);
      } else {
        timeToBlockExpire = timeToExpire;
      }
    }

    return { totalHits, timeToExpire, isBlocked, timeToBlockExpire };
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
