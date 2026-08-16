import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { InviteStaffDto } from './dto/invite-staff.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { StaffService } from './staff.service';

@Controller('staff')
@Roles('client_admin')
@UseGuards(ClientScopeGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  list(@CurrentClientId() clientId: string) {
    return this.staffService.list(clientId);
  }

  @Post('invite')
  invite(@CurrentClientId() clientId: string, @Body() dto: InviteStaffDto) {
    return this.staffService.invite(clientId, dto.email, dto.permissions);
  }

  @Patch(':id/permissions')
  updatePermissions(
    @CurrentClientId() clientId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.staffService.updatePermissions(clientId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.staffService.remove(clientId, id);
  }
}
