import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { DigestService } from '../digest.service';

import type { Job } from 'bullmq';

export const WEEKLY_DIGEST_QUEUE = 'weekly-digest';

@Processor(WEEKLY_DIGEST_QUEUE)
export class WeeklyDigestProcessor extends WorkerHost {
  private readonly logger = new Logger(WeeklyDigestProcessor.name);

  constructor(private readonly digestService: DigestService) {
    super();
  }

  async process(job: Job): Promise<{ sent: number }> {
    this.logger.log(`Running weekly digest sweep (job ${job.id ?? 'unknown'})`);
    return this.digestService.sendToAllPublishedClients();
  }
}
