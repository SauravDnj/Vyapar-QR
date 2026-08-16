import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { ThemesService } from '../../themes/themes.service';

import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';

@Controller('admin/themes')
@Roles('super_admin')
export class AdminThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @Get()
  list() {
    return this.themesService.listForAdmin();
  }

  @Post()
  create(@Body() dto: CreateThemeDto) {
    return this.themesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateThemeDto) {
    return this.themesService.update(id, dto);
  }
}
