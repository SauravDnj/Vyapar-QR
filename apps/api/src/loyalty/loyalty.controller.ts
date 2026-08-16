import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { SaveLoyaltyProgramDto } from './dto/save-program.dto';
import { StampCardDto } from './dto/stamp-card.dto';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('program')
  getProgram(@CurrentClientId() clientId: string) {
    return this.loyaltyService.getProgram(clientId);
  }

  @Put('program')
  @Roles('client_admin')
  saveProgram(@CurrentClientId() clientId: string, @Body() dto: SaveLoyaltyProgramDto) {
    return this.loyaltyService.saveProgram(clientId, dto);
  }

  @Get('cards')
  listCards(@CurrentClientId() clientId: string) {
    return this.loyaltyService.listCards(clientId);
  }

  @Post('stamp')
  addStamp(@CurrentClientId() clientId: string, @Body() dto: StampCardDto) {
    return this.loyaltyService.addStamp(clientId, dto.phone);
  }

  @Post('cards/:id/redeem')
  redeem(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.loyaltyService.redeem(clientId, id);
  }
}
