import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BillingService } from '../billing.service';

import type { Job } from 'bullmq';

export const GRACE_PERIOD_QUEUE = 'grace-period';

@Processor(GRACE_PERIOD_QUEUE)
export class GracePeriodProcessor extends WorkerHost {
  private readonly logger = new Logger(GracePeriodProcessor.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ suspended: number }> {
    this.logger.log(`Running grace-period sweep (job ${job.id ?? 'unknown'})`);
    const gracePeriodDays = Number(this.configService.get<string>('BILLING_GRACE_PERIOD_DAYS') ?? '7');
    const suspended = await this.billingService.suspendOverdueClients(gracePeriodDays);
    return { suspended };
  }
}
