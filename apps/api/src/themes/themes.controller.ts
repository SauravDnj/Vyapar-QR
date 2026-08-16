import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator';

import { ThemesService } from './themes.service';

@Controller('themes')
@Public()
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @Get()
  list(@Query('category') category?: string) {
    return this.themesService.list(category);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.themesService.findOneOrThrow(id);
  }
}
