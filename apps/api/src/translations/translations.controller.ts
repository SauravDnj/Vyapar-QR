import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { UpsertTranslationDto } from './dto/upsert-translation.dto';
import { TranslationsService } from './translations.service';

@Controller('translations')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard)
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

  @Get()
  list(@CurrentClientId() clientId: string) {
    return this.translationsService.list(clientId);
  }

  @Put(':locale')
  @Roles('client_admin')
  upsert(@CurrentClientId() clientId: string, @Param('locale') locale: string, @Body() dto: UpsertTranslationDto) {
    return this.translationsService.upsert(clientId, locale, dto.content);
  }

  @Delete(':locale')
  @Roles('client_admin')
  remove(@CurrentClientId() clientId: string, @Param('locale') locale: string) {
    return this.translationsService.remove(clientId, locale);
  }
}
