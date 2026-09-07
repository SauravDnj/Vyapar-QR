import { InjectQueue } from '@nestjs/bullmq';
import { Module, Optional, type OnModuleInit } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { bullQueueImports, isRedisEnabled } from '../jobs/jobs.config';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

import { LEAD_FOLLOW_UP_QUEUE, LeadFollowUpProcessor } from './jobs/lead-follow-up.processor';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

import type { Queue } from 'bullmq';

@Module({
  imports: [...bullQueueImports(LEAD_FOLLOW_UP_QUEUE), WebhooksModule, EmailModule, WhatsappModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadFollowUpProcessor],
  exports: [LeadsService],
})
export class LeadsModule implements OnModuleInit {
  constructor(
    @Optional() @InjectQueue(LEAD_FOLLOW_UP_QUEUE) private readonly queue?: Queue,
  ) {}

  async onModuleInit() {
    // Without Redis there is no BullMQ scheduler; Vercel Cron calls
    // `/internal/cron/*` instead (see JobsModule).
    if (!isRedisEnabled() || !this.queue) return;

    // 10am daily — same cron-scheduling pattern as the billing grace-period
    // and review-sync sweeps.
    await this.queue.upsertJobScheduler('lead-follow-up-daily-sweep', { pattern: '0 10 * * *' }, { name: 'sweep' });
  }
}
