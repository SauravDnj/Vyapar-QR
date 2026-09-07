import { createApp } from './bootstrap';

/** Long-running server entrypoint (local dev and VPS/PM2 deploys). */
async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 4100);
}
void bootstrap();
