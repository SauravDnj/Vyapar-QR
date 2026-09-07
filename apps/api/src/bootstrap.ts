import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { UPLOADS_DIR } from './storage/storage.service';

/**
 * Builds the Nest application with the middleware every entrypoint needs.
 *
 * Shared by `main.ts` (a long-running server on a VPS) and `api/index.ts`
 * (a Vercel serverless function). Keeping the setup here means the two can't
 * drift — a CORS or validation change made for one applies to both.
 */
export async function createApp(): Promise<NestExpressApplication> {
  // rawBody is required to verify the Razorpay webhook signature, which is
  // computed over the exact bytes received — not the re-serialized JSON body.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Must come before useStaticAssets — Express's static handler terminates
  // matching requests immediately, so CORS registered after it never runs
  // for /uploads/*, breaking cross-origin fetch() (though <img src> still
  // works, since that doesn't require CORS).
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  // On Vercel the filesystem is read-only and uploads live in Vercel Blob,
  // which serves its own absolute URLs — there is no local directory to
  // expose, and registering one would shadow nothing but cost a stat call.
  if (!process.env.VERCEL) {
    app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads' });
  }

  return app;
}
