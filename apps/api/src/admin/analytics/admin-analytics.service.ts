import { Injectable } from '@nestjs/common';

import { bucketByDayAndType, fillTimeseriesBuckets } from '../../analytics/analytics.service';
import { PrismaService } from '../../prisma/prisma.service';

import type { TimeseriesPoint } from '../../analytics/analytics.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Platform-wide counterpart to `AnalyticsService.getTimeseries` — same
 * daily bucketing, summed across every client instead of scoped to one. */
@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeseries(days: number): Promise<TimeseriesPoint[]> {
    const since = new Date(Date.now() - days * MS_PER_DAY);

    const events = await this.prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, eventType: true },
    });

    return fillTimeseriesBuckets(bucketByDayAndType(events), days);
  }
}
