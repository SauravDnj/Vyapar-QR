import { InjectQueue } from '@nestjs/bullmq';
import { Module, Optional, type OnModuleInit } from '@nestjs/common';

import { bullQueueImports, isRedisEnabled } from '../jobs/jobs.config';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BOOKING_REMINDER_QUEUE, BookingReminderProcessor } from './jobs/booking-reminder.processor';

import type { Queue } from 'bullmq';

@Module({
  imports: [...bullQueueImports(BOOKING_REMINDER_QUEUE), WhatsappModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingReminderProcessor],
  exports: [BookingsService],
})
export class BookingsModule implements OnModuleInit {
  constructor(
    @Optional() @InjectQueue(BOOKING_REMINDER_QUEUE) private readonly queue?: Queue,
  ) {}

  async onModuleInit() {
    // Without Redis there is no BullMQ scheduler; Vercel Cron calls
    // `/internal/cron/*` instead (see JobsModule).
    if (!isRedisEnabled() || !this.queue) return;

    // Every 15 minutes — frequent enough that a 2-hour reminder window
    // never misses a slot, unlike the once-daily sweeps elsewhere.
    await this.queue.upsertJobScheduler('booking-reminder-sweep', { pattern: '*/15 * * * *' }, { name: 'sweep' });
  }
}
