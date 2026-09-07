import { createApp } from './bootstrap';

import type { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Request handler for a serverless deploy.
 *
 * Unlike `main.ts` this never calls `listen()`: Vercel owns the HTTP server
 * and hands each request to this function, so the app is initialised and its
 * underlying Express instance is invoked directly.
 *
 * The promise is cached at module scope so warm invocations reuse the built
 * application — constructing 25+ Nest modules per request would otherwise
 * dominate response time.
 */
let appPromise: Promise<NestExpressApplication> | null = null;

function getApp(): Promise<NestExpressApplication> {
  appPromise ??= createApp().then(async (app) => {
    // `init()` runs the module lifecycle hooks (including PrismaService's)
    // without binding a port, which is what a serverless function needs.
    await app.init();
    return app;
  });
  return appPromise;
}

export async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await getApp();
  const express = app.getHttpAdapter().getInstance() as (
    request: IncomingMessage,
    response: ServerResponse,
  ) => void;
  express(req, res);
}

export default handler;
