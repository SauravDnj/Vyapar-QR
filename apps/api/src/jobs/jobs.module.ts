import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module';
import { BookingsModule } from '../bookings/bookings.module';
import { DigestModule } from '../digest/digest.module';
import { LeadsModule } from '../leads/leads.module';
import { ReviewsModule } from '../reviews/reviews.module';

import { CronController } from './cron.controller';

/**
 * HTTP entry points for the recurring sweeps. Registered unconditionally so
 * the endpoints exist on every deploy — a VPS running BullMQ can still use
 * them to trigger a sweep manually, which is how they get exercised without
 * waiting a week for the digest cron to fire.
 */
@Module({
  imports: [BillingModule, BookingsModule, DigestModule, LeadsModule, ReviewsModule],
  controllers: [CronController],
})
export class JobsModule {}
