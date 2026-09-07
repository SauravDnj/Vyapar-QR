import { InjectQueue } from '@nestjs/bullmq';
import { Module, Optional, type OnModuleInit } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EmailModule } from '../email/email.module';
import { bullQueueImports, isRedisEnabled } from '../jobs/jobs.config';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';
import { WEEKLY_DIGEST_QUEUE, WeeklyDigestProcessor } from './jobs/weekly-digest.processor';

import type { Queue } from 'bullmq';

@Module({
  imports: [...bullQueueImports(WEEKLY_DIGEST_QUEUE), AnalyticsModule, EmailModule, AiModule, WhatsappModule],
  controllers: [DigestController],
  providers: [DigestService, WeeklyDigestProcessor],
  exports: [DigestService],
})
export class DigestModule implements OnModuleInit {
  constructor(
    @Optional() @InjectQueue(WEEKLY_DIGEST_QUEUE) private readonly queue?: Queue,
  ) {}

  async onModuleInit() {
    // Without Redis there is no BullMQ scheduler; Vercel Cron calls
    // `/internal/cron/*` instead (see JobsModule).
    if (!isRedisEnabled() || !this.queue) return;

    // Monday 9am — same cron-string scheduling pattern as the billing
    // grace-period sweep.
    await this.queue.upsertJobScheduler('weekly-digest-sweep', { pattern: '0 9 * * 1' }, { name: 'sweep' });
  }
}
