import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { BillingService } from '../billing/billing.service';
import { BookingsService } from '../bookings/bookings.service';
import { Public } from '../common/decorators/public.decorator';
import { DigestService } from '../digest/digest.service';
import { LeadsService } from '../leads/leads.service';
import { ReviewsService } from '../reviews/reviews.service';

/**
 * The five recurring sweeps, reachable over HTTP.
 *
 * On a VPS these run under BullMQ's scheduler, as before. On Vercel there is
 * no long-lived worker to run a scheduler in, so Vercel Cron calls these
 * endpoints instead (see `vercel.json`). Both paths call the same service
 * methods, so there is exactly one implementation of each sweep.
 *
 * Access is by shared secret rather than a user session: Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`.
 */
@Controller('internal/cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private readonly billing: BillingService,
    private readonly bookings: BookingsService,
    private readonly digest: DigestService,
    private readonly leads: LeadsService,
    private readonly reviews: ReviewsService,
  ) {}

  // Vercel Cron invokes its targets with GET; POST is offered too so a sweep
  // can be triggered by hand or by an external scheduler.
  //
  // These are two separate handlers on purpose. Stacking `@Get()` and
  // `@Post()` on a single method does NOT register both routes — Nest stores
  // one method per handler, so the outer decorator silently wins and the
  // other verb 404s.
  @Get(':job')
  @Public()
  // Cron traffic is a handful of requests a day; the default per-route limit
  // would be shared with real users behind the same proxy IP.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  runViaGet(
    @Param('job') job: string,
    @Headers('authorization') authorization?: string,
    @Query('secret') secretQuery?: string,
  ): Promise<{ job: string; result: unknown }> {
    return this.run(job, authorization, secretQuery);
  }

  @Post(':job')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  runViaPost(
    @Param('job') job: string,
    @Headers('authorization') authorization?: string,
    @Query('secret') secretQuery?: string,
  ): Promise<{ job: string; result: unknown }> {
    return this.run(job, authorization, secretQuery);
  }

  private async run(
    job: string,
    authorization?: string,
    secretQuery?: string,
  ): Promise<{ job: string; result: unknown }> {
    this.authorize(authorization, secretQuery);

    const result = await this.dispatch(job);
    this.logger.log(`Cron job "${job}" finished: ${JSON.stringify(result)}`);
    return { job, result };
  }

  private authorize(authorization?: string, secretQuery?: string): void {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      // Failing closed matters here: without it, an unset secret would leave
      // these sweeps callable by anyone who guesses the path.
      throw new ForbiddenException('CRON_SECRET is not configured');
    }
    const bearer = authorization?.replace(/^Bearer\s+/i, '');
    if (bearer !== expected && secretQuery !== expected) {
      throw new ForbiddenException('Invalid cron secret');
    }
  }

  /** Every sweep, in one request. See `runAll` for why this exists. */
  private static readonly ALL_JOBS = [
    'grace-period',
    'lead-follow-up',
    'booking-reminder',
    'review-sync',
    'weekly-digest',
  ];

  /**
   * Runs every sweep in sequence.
   *
   * Vercel's Hobby plan allows a small number of cron jobs and runs them at
   * most once a day, which the five separate schedules exceed. One daily job
   * that fans out keeps all of them running on Hobby. A failure in one sweep
   * is recorded and the rest still run — otherwise an outage in, say, the
   * Google Reviews API would also stop billing suspensions.
   *
   * On Pro, split this back into the five individual entries in `vercel.json`
   * to get each sweep on its own schedule.
   */
  private async runAll(): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    for (const job of CronController.ALL_JOBS) {
      try {
        results[job] = await this.dispatch(job);
      } catch (error) {
        this.logger.error(`Cron job "${job}" failed: ${String(error)}`);
        results[job] = { error: error instanceof Error ? error.message : String(error) };
      }
    }
    return results;
  }

  private async dispatch(job: string): Promise<unknown> {
    switch (job) {
      case 'all':
        return this.runAll();
      case 'grace-period': {
        const days = Number(process.env.BILLING_GRACE_PERIOD_DAYS ?? '7');
        return { suspended: await this.billing.suspendOverdueClients(days) };
      }
      case 'booking-reminder':
        return this.bookings.sendReminders();
      case 'weekly-digest':
        return this.digest.sendToAllPublishedClients();
      case 'lead-follow-up':
        return this.leads.sendFollowUps();
      case 'review-sync':
        return this.reviews.syncAllConfiguredClients();
      default:
        throw new NotFoundException(`Unknown cron job "${job}"`);
    }
  }
}
