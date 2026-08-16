import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, type OnModuleInit } from '@nestjs/common';

import { WhatsappModule } from '../whatsapp/whatsapp.module';

import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BOOKING_REMINDER_QUEUE, BookingReminderProcessor } from './jobs/booking-reminder.processor';

import type { Queue } from 'bullmq';

@Module({
  imports: [BullModule.registerQueue({ name: BOOKING_REMINDER_QUEUE }), WhatsappModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingReminderProcessor],
  exports: [BookingsService],
})
export class BookingsModule implements OnModuleInit {
  constructor(@InjectQueue(BOOKING_REMINDER_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    // Every 15 minutes — frequent enough that a 2-hour reminder window
    // never misses a slot, unlike the once-daily sweeps elsewhere.
    await this.queue.upsertJobScheduler('booking-reminder-sweep', { pattern: '*/15 * * * *' }, { name: 'sweep' });
  }
}
