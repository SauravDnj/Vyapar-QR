import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { fillTimeseriesBuckets } from '../../analytics/analytics.service';
import { PrismaService } from '../../prisma/prisma.service';

import type { TimeseriesPoint, TimeseriesRow } from '../../analytics/analytics.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Platform-wide counterpart to `AnalyticsService.getTimeseries` — same
 * daily bucketing, summed across every client instead of scoped to one. */
@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeseries(days: number): Promise<TimeseriesPoint[]> {
    const since = new Date(Date.now() - days * MS_PER_DAY);

    const rows = await this.prisma.$queryRaw<TimeseriesRow[]>(
      Prisma.sql`
        SELECT DATE(created_at) AS day, event_type AS "eventType", COUNT(*) AS total
        FROM analytics_events
        WHERE created_at >= ${since}
        GROUP BY DATE(created_at), event_type
        ORDER BY day ASC
      `,
    );

    return fillTimeseriesBuckets(rows, days);
  }
}
