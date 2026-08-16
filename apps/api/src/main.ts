import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';


import { AppModule } from './app.module';
import { UPLOADS_DIR } from './storage/storage.service';

async function bootstrap() {
  // rawBody is required to verify the Razorpay webhook signature, which is
  // computed over the exact bytes received — not the re-serialized JSON body.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

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
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads' });

  await app.listen(process.env.PORT ?? 4100);
}
void bootstrap();
