import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { BookingsService } from './bookings.service';
import { CreateBulkSlotsDto } from './dto/create-bulk-slots.dto';
import { CreateSlotDto } from './dto/create-slot.dto';

@Controller('bookings')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('slots')
  listSlots(@CurrentClientId() clientId: string) {
    return this.bookingsService.listUpcoming(clientId);
  }

  @Post('slots')
  @Roles('client_admin')
  createSlot(@CurrentClientId() clientId: string, @Body() dto: CreateSlotDto) {
    return this.bookingsService.createSlot(clientId, dto);
  }

  @Post('slots/bulk')
  @Roles('client_admin')
  createBulkSlots(@CurrentClientId() clientId: string, @Body() dto: CreateBulkSlotsDto) {
    return this.bookingsService.createBulkSlots(clientId, dto);
  }

  @Delete('slots/:id')
  @Roles('client_admin')
  deleteSlot(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.bookingsService.deleteSlot(clientId, id);
  }
}
