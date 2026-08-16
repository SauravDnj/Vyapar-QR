import { Controller, Get, Query } from '@nestjs/common';

import { TimeseriesQueryDto } from '../../analytics/dto/timeseries-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';

import { AdminAnalyticsService } from './admin-analytics.service';

@Controller('admin/analytics')
@Roles('super_admin')
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get('timeseries')
  getTimeseries(@Query() query: TimeseriesQueryDto) {
    return this.adminAnalyticsService.getTimeseries(query.days);
  }
}
