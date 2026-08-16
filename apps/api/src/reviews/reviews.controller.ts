import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

import { SaveReviewConfigDto } from './dto/save-review-config.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard, PermissionsGuard)
@RequirePermission('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('config')
  getConfig(@CurrentClientId() clientId: string) {
    return this.reviewsService.getConfig(clientId);
  }

  @Put('config')
  @Roles('client_admin')
  saveConfig(@CurrentClientId() clientId: string, @Body() dto: SaveReviewConfigDto) {
    return this.reviewsService.saveConfig(clientId, dto);
  }

  @Post('sync')
  @Roles('client_admin')
  sync(@CurrentClientId() clientId: string) {
    return this.reviewsService.syncNow(clientId);
  }

  @Get('funnel-stats')
  getFunnelStats(@CurrentClientId() clientId: string) {
    return this.reviewsService.getFunnelStats(clientId);
  }

  @Get('cached')
  getCachedReviews(@CurrentClientId() clientId: string) {
    return this.reviewsService.getCachedReviews(clientId);
  }

  @Post(':id/draft-reply')
  @Roles('client_admin')
  draftReply(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.reviewsService.draftReply(clientId, id);
  }
}
