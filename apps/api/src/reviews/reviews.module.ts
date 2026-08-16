import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, type OnModuleInit } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

import { googleSheetsProvider } from './google-sheets.provider';
import { GoogleSheetsService } from './google-sheets.service';
import { REVIEW_SYNC_QUEUE, ReviewSyncProcessor } from './jobs/review-sync.processor';
import { placesApiKeyProvider } from './places-api.provider';
import { PlacesApiService } from './places-api.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

import type { Queue } from 'bullmq';

@Module({
  imports: [BullModule.registerQueue({ name: REVIEW_SYNC_QUEUE }), WebhooksModule, EmailModule, WhatsappModule, AiModule, SmsModule],
  controllers: [ReviewsController],
  providers: [googleSheetsProvider, GoogleSheetsService, placesApiKeyProvider, PlacesApiService, ReviewsService, ReviewSyncProcessor],
  exports: [ReviewsService],
})
export class ReviewsModule implements OnModuleInit {
  constructor(@InjectQueue(REVIEW_SYNC_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    // Upserting the scheduler is idempotent, so this is safe to run on every boot.
    await this.queue.upsertJobScheduler('review-sync-daily-sweep', { pattern: '0 4 * * *' }, { name: 'sweep' });
  }
}
