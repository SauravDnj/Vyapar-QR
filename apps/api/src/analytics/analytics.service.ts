import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CaptureEventDto } from './dto/capture-event.dto';

const SUMMARY_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AnalyticsSummary {
  pageViews: number;
  buttonClicks: number;
  qrScans: number;
  /** Button clicks specifically on the WhatsApp social button (P3-05) —
   * a dedicated count rather than a `Lead` row, since a click has no
   * name/phone to build one from (same reasoning `leads.service.ts`
   * already documents for `whatsapp_click`/`qr_scan` not auto-creating
   * leads). Read from `metaJson.label`, set by `SocialButtons`' beacon. */
  whatsappClicks: number;
}

export interface TimeseriesPoint {
  date: string;
  pageViews: number;
  buttonClicks: number;
  qrScans: number;
}

export interface TimeseriesRow {
  day: Date | string;
  eventType: string;
  total: bigint;
}

/** Exported so `AdminAnalyticsService` (platform-wide view) can bucket its
 * own raw-query rows the same way without duplicating this logic. */
export function toDateKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function buildEmptyBuckets(days: number): Map<string, TimeseriesPoint> {
  const buckets = new Map<string, TimeseriesPoint>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = toDateKey(new Date(Date.now() - offset * MS_PER_DAY));
    buckets.set(key, { date: key, pageViews: 0, buttonClicks: 0, qrScans: 0 });
  }
  return buckets;
}

/** Shared by `AnalyticsService` (per-client) and `AdminAnalyticsService`
 * (platform-wide) — both run the same `DATE(created_at)` raw-SQL grouping
 * and just need it bucketed into a zero-filled, ordered daily series. */
export function fillTimeseriesBuckets(rows: TimeseriesRow[], days: number): TimeseriesPoint[] {
  const buckets = buildEmptyBuckets(days);
  for (const row of rows) {
    const bucket = buckets.get(toDateKey(row.day));
    if (!bucket) continue;
    const count = Number(row.total);
    if (row.eventType === 'page_view') bucket.pageViews = count;
    else if (row.eventType === 'button_click') bucket.buttonClicks = count;
    else if (row.eventType === 'qr_scan') bucket.qrScans = count;
  }
  return [...buckets.values()];
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(slug: string, dto: CaptureEventDto): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (!client) {
      return;
    }

    const metaJson = dto.meta as unknown as Prisma.InputJsonValue | undefined;
    await this.prisma.analyticsEvent.create({
      data: { clientId: client.id, eventType: dto.eventType, metaJson },
    });
  }

  async getSummary(clientId: string): Promise<AnalyticsSummary> {
    const since = new Date(Date.now() - SUMMARY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [counts, whatsappClicks] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where: { clientId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.countWhatsappClicks(clientId, since),
    ]);

    const countFor = (eventType: string) => counts.find((row) => row.eventType === eventType)?._count._all ?? 0;

    return {
      pageViews: countFor('page_view'),
      buttonClicks: countFor('button_click'),
      qrScans: countFor('qr_scan'),
      whatsappClicks,
    };
  }

  private async countWhatsappClicks(clientId: string, since: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*) AS total
        FROM analytics_events
        WHERE client_id = ${clientId}
          AND event_type = 'button_click'
          AND created_at >= ${since}
          AND JSON_UNQUOTE(JSON_EXTRACT(meta_json, '$.label')) = 'whatsapp'
      `,
    );
    return Number(rows[0]?.total ?? 0);
  }

  /** Daily-bucketed event counts for the last `days` days, for chart display. */
  async getTimeseries(clientId: string, days: number): Promise<TimeseriesPoint[]> {
    const since = new Date(Date.now() - days * MS_PER_DAY);

    const rows = await this.prisma.$queryRaw<TimeseriesRow[]>(
      Prisma.sql`
        SELECT DATE(created_at) AS day, event_type AS eventType, COUNT(*) AS total
        FROM analytics_events
        WHERE client_id = ${clientId} AND created_at >= ${since}
        GROUP BY DATE(created_at), event_type
        ORDER BY day ASC
      `,
    );

    return fillTimeseriesBuckets(rows, days);
  }

  /** Scan → View → Engaged → Reviewed conversion funnel over the last
   * `days` days. "Engaged" unions Leads, Orders, and booked slots — the
   * three ways a visitor turns into a real interaction. Known
   * approximation: `BookingSlot` only has a slot-creation `createdAt`, not
   * a booked-at timestamp, so "booked in window" is filtered on slot
   * creation date rather than booking date — directionally useful, not
   * exact, and not worth a speculative schema change for. */
  async getFunnel(clientId: string, days: number): Promise<{ stage: string; count: number }[]> {
    const since = new Date(Date.now() - days * MS_PER_DAY);

    const [scanned, viewed, leadsCount, bookedCount, ordersCount, reviewed] = await Promise.all([
      this.prisma.analyticsEvent.count({ where: { clientId, eventType: 'qr_scan', createdAt: { gte: since } } }),
      this.prisma.analyticsEvent.count({ where: { clientId, eventType: 'page_view', createdAt: { gte: since } } }),
      this.prisma.lead.count({ where: { clientId, createdAt: { gte: since } } }),
      this.prisma.bookingSlot.count({ where: { clientId, isBooked: true, createdAt: { gte: since } } }),
      this.prisma.order.count({ where: { clientId, createdAt: { gte: since } } }),
      this.prisma.reviewFunnelResponse.count({ where: { clientId, createdAt: { gte: since } } }),
    ]);

    return [
      { stage: 'Scanned', count: scanned },
      { stage: 'Viewed', count: viewed },
      { stage: 'Engaged', count: leadsCount + bookedCount + ordersCount },
      { stage: 'Reviewed', count: reviewed },
    ];
  }
}
