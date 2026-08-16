import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, type OnModuleInit } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EmailModule } from '../email/email.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';
import { WEEKLY_DIGEST_QUEUE, WeeklyDigestProcessor } from './jobs/weekly-digest.processor';

import type { Queue } from 'bullmq';

@Module({
  imports: [BullModule.registerQueue({ name: WEEKLY_DIGEST_QUEUE }), AnalyticsModule, EmailModule, AiModule, WhatsappModule],
  controllers: [DigestController],
  providers: [DigestService, WeeklyDigestProcessor],
  exports: [DigestService],
})
export class DigestModule implements OnModuleInit {
  constructor(@InjectQueue(WEEKLY_DIGEST_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    // Monday 9am — same cron-string scheduling pattern as the billing
    // grace-period sweep.
    await this.queue.upsertJobScheduler('weekly-digest-sweep', { pattern: '0 9 * * 1' }, { name: 'sweep' });
  }
}
