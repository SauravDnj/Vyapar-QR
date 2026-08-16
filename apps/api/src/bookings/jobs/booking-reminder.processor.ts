import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { BookingsService } from '../bookings.service';

import type { Job } from 'bullmq';

export const BOOKING_REMINDER_QUEUE = 'booking-reminder';

@Processor(BOOKING_REMINDER_QUEUE)
export class BookingReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingReminderProcessor.name);

  constructor(private readonly bookingsService: BookingsService) {
    super();
  }

  async process(job: Job): Promise<{ sent: number }> {
    this.logger.log(`Running booking reminder sweep (job ${job.id ?? 'unknown'})`);
    return this.bookingsService.sendReminders();
  }
}
