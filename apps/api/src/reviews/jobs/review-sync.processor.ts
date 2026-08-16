import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { ReviewsService } from '../reviews.service';

import type { Job } from 'bullmq';

export const REVIEW_SYNC_QUEUE = 'review-sync';

@Processor(REVIEW_SYNC_QUEUE)
export class ReviewSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewSyncProcessor.name);

  constructor(private readonly reviewsService: ReviewsService) {
    super();
  }

  async process(job: Job): Promise<{ synced: number; skipped: number }> {
    this.logger.log(`Running review-sync sweep (job ${job.id ?? 'unknown'})`);
    return this.reviewsService.syncAllConfiguredClients();
  }
}
