import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { AddGalleryImageDto } from './dto/add-gallery-image.dto';
import { AiDraftDto } from './dto/ai-draft.dto';
import { BusinessInfoDto } from './dto/business-info.dto';
import { ContactSectionDto } from './dto/contact-section.dto';
import { AddLocationDto, UpdateLocationDto } from './dto/location.dto';
import { MenuSectionDto } from './dto/menu-section.dto';
import { SavePaymentMethodsDto } from './dto/payment-methods.dto';
import { SelectThemeDto } from './dto/select-theme.dto';
import { SocialReviewDto } from './dto/social-review.dto';
import { OnboardingService } from './onboarding.service';

import type { JwtPayload } from '../auth/types/jwt-payload.interface';

@Controller('onboarding')
@Roles('client_admin', 'client_staff')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  status(@CurrentUser() user: JwtPayload) {
    return this.onboardingService.getStatus(user.sub);
  }

  // No ClientScopeGuard here — the Client row may not exist yet on the very
  // first onboarding step, so it's resolved (or created) from the JWT's
  // userId directly instead of the guard's "must already have a client" check.
  @Post('business-info')
  @Roles('client_admin')
  businessInfo(@CurrentUser() user: JwtPayload, @Body() dto: BusinessInfoDto) {
    return this.onboardingService.saveBusinessInfo(user.sub, dto);
  }

  @Post('ai-draft')
  @Roles('client_admin')
  aiDraft(@Body() dto: AiDraftDto) {
    return this.onboardingService.draftBusinessCopy(dto.businessName, dto.category);
  }

  @Patch('theme')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  selectTheme(@CurrentClientId() clientId: string, @Body() dto: SelectThemeDto) {
    return this.onboardingService.selectTheme(clientId, dto.themeId, dto.accentColor);
  }

  @Post('menu')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  menuSection(@CurrentClientId() clientId: string, @Body() dto: MenuSectionDto) {
    return this.onboardingService.saveMenuSection(clientId, dto);
  }

  @Post('gallery')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  addGalleryImage(@CurrentClientId() clientId: string, @Body() dto: AddGalleryImageDto) {
    return this.onboardingService.addGalleryImage(clientId, dto.imageUrl);
  }

  @Delete('gallery/:id')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  removeGalleryImage(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.onboardingService.removeGalleryImage(clientId, id);
  }

  @Post('contact')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  contactSection(@CurrentClientId() clientId: string, @Body() dto: ContactSectionDto) {
    return this.onboardingService.saveContactSection(clientId, dto);
  }

  @Post('locations')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  addLocation(@CurrentClientId() clientId: string, @Body() dto: AddLocationDto) {
    return this.onboardingService.addLocation(clientId, dto);
  }

  @Patch('locations/:id')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  updateLocation(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.onboardingService.updateLocation(clientId, id, dto);
  }

  @Delete('locations/:id')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  removeLocation(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.onboardingService.removeLocation(clientId, id);
  }

  @Post('payment-methods')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  paymentMethods(@CurrentClientId() clientId: string, @Body() dto: SavePaymentMethodsDto) {
    return this.onboardingService.savePaymentMethods(clientId, dto);
  }

  @Post('social-review')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  socialReview(@CurrentClientId() clientId: string, @Body() dto: SocialReviewDto) {
    return this.onboardingService.saveSocialAndReview(clientId, dto);
  }

  @Post('complete')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  complete(@CurrentClientId() clientId: string) {
    return this.onboardingService.complete(clientId);
  }
}
