import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, type OnModuleInit } from '@nestjs/common';


import { EmailModule } from '../email/email.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { GRACE_PERIOD_QUEUE, GracePeriodProcessor } from './jobs/grace-period.processor';
import { razorpayProvider } from './razorpay.provider';

import type { Queue } from 'bullmq';

@Module({
  imports: [BullModule.registerQueue({ name: GRACE_PERIOD_QUEUE }), EmailModule, WebhooksModule],
  controllers: [BillingController],
  providers: [BillingService, razorpayProvider, GracePeriodProcessor],
})
export class BillingModule implements OnModuleInit {
  constructor(@InjectQueue(GRACE_PERIOD_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    // Upserting the scheduler is idempotent, so this is safe to run on every boot.
    await this.queue.upsertJobScheduler('grace-period-daily-sweep', { pattern: '0 3 * * *' }, { name: 'sweep' });
  }
}
