import type { DynamicModule } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';

/**
 * Redis is optional. It's present on a VPS deploy (BullMQ job scheduling plus
 * exact global rate limits) and absent on Vercel, where a serverless function
 * has nothing long-lived to connect to. Everything Redis-backed therefore has
 * a working fallback, selected here in one place.
 */
export function isRedisEnabled(): boolean {
  // `JOBS_DRIVER=cron` forces the serverless path even when a REDIS_URL is
  // present, which is what a Vercel deploy sharing a VPS's env should use.
  if (process.env.JOBS_DRIVER === 'cron') return false;
  return Boolean(process.env.REDIS_URL);
}

/* eslint-disable @typescript-eslint/no-require-imports --
   These loads must be lazy and conditional: a static import would pull
   bullmq/ioredis into the serverless bundle and construct a Redis client that
   can never connect on Vercel. A top-level `await import` isn't available in
   the CommonJS module graph Nest builds here. */

/**
 * `BullModule.forRoot(...)` when Redis is available, nothing otherwise.
 * Returned as a spreadable array so module `imports` stay declarative.
 */
export function bullRootImports(): DynamicModule[] {
  if (!isRedisEnabled()) return [];

  // Required lazily: importing bullmq/ioredis at module scope would pull a
  // Redis client into the serverless bundle that can never connect.
  const { BullModule } = require('@nestjs/bullmq') as typeof import('@nestjs/bullmq');
  const Redis = (require('ioredis') as { default: typeof import('ioredis').default }).default;

  return [
    BullModule.forRoot({
      // BullMQ requires this exact setting on the shared connection for its
      // blocking commands to work correctly.
      connection: new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
      }),
    }),
  ];
}

/** `BullModule.registerQueue({ name })` when Redis is available. */
export function bullQueueImports(name: string): DynamicModule[] {
  if (!isRedisEnabled()) return [];
  const { BullModule } = require('@nestjs/bullmq') as typeof import('@nestjs/bullmq');
  return [BullModule.registerQueue({ name })];
}

export function createThrottlerStorage(): ThrottlerStorage {
  if (isRedisEnabled()) {
    const {
      RedisThrottlerStorage,
    } = require('../common/throttler/redis-throttler.storage') as typeof import('../common/throttler/redis-throttler.storage');
    return new RedisThrottlerStorage();
  }
  const {
    MemoryThrottlerStorage,
  } = require('../common/throttler/memory-throttler.storage') as typeof import('../common/throttler/memory-throttler.storage');
  return new MemoryThrottlerStorage();
}
