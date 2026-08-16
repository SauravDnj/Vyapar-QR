import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';

import { AnalyticsService } from './analytics.service';
import { FunnelQueryDto } from './dto/funnel-query.dto';
import { TimeseriesQueryDto } from './dto/timeseries-query.dto';

@Controller('analytics')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard, PermissionsGuard)
@RequirePermission('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  getSummary(@CurrentClientId() clientId: string) {
    return this.analyticsService.getSummary(clientId);
  }

  @Get('timeseries')
  @UseGuards(PlanFeatureGuard)
  @RequireFeature('analytics')
  getTimeseries(@CurrentClientId() clientId: string, @Query() query: TimeseriesQueryDto) {
    return this.analyticsService.getTimeseries(clientId, query.days);
  }

  @Get('funnel')
  @UseGuards(PlanFeatureGuard)
  @RequireFeature('analytics')
  getFunnel(@CurrentClientId() clientId: string, @Query() query: FunnelQueryDto) {
    return this.analyticsService.getFunnel(clientId, query.days);
  }
}
