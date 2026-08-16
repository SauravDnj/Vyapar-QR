import { Body, Controller, Get, Put } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';

@Controller('admin/settings')
@Roles('super_admin')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  @Put()
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.settingsService.updateMany(dto.values, user.sub);
  }
}
