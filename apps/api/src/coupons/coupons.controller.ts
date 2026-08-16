import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { RedeemCouponDto } from './dto/redeem-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Controller('coupons')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  list(@CurrentClientId() clientId: string) {
    return this.couponsService.list(clientId);
  }

  @Post()
  @Roles('client_admin')
  create(@CurrentClientId() clientId: string, @Body() dto: CreateCouponDto) {
    return this.couponsService.create(clientId, dto);
  }

  @Patch(':id')
  @Roles('client_admin')
  update(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(clientId, id, dto);
  }

  @Delete(':id')
  @Roles('client_admin')
  remove(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.couponsService.remove(clientId, id);
  }

  @Post('redeem')
  redeem(@CurrentClientId() clientId: string, @Body() dto: RedeemCouponDto) {
    return this.couponsService.redeem(clientId, dto.code);
  }
}
