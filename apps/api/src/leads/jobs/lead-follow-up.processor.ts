import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { LeadsService } from '../leads.service';

import type { Job } from 'bullmq';

export const LEAD_FOLLOW_UP_QUEUE = 'lead-follow-up';

@Processor(LEAD_FOLLOW_UP_QUEUE)
export class LeadFollowUpProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadFollowUpProcessor.name);

  constructor(private readonly leadsService: LeadsService) {
    super();
  }

  async process(job: Job): Promise<{ sent: number }> {
    this.logger.log(`Running lead follow-up sweep (job ${job.id ?? 'unknown'})`);
    return this.leadsService.sendFollowUps();
  }
}
