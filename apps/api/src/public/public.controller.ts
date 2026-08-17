import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query, Redirect, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CaptureEventDto } from '../analytics/dto/capture-event.dto';
import { BookSlotDto } from '../bookings/dto/book-slot.dto';
import { Public } from '../common/decorators/public.decorator';
import { CreateLeadDto } from '../leads/dto/create-lead.dto';
import { PlaceOrderDto } from '../menu/dto/place-order.dto';
import { DraftCustomerReviewDto } from '../reviews/dto/draft-customer-review.dto';
import { SubmitFunnelDto } from '../reviews/dto/submit-funnel.dto';
import { SubmitTestimonialDto } from '../testimonials/dto/submit-testimonial.dto';

import { ClaimPaymentDto } from './dto/claim-payment.dto';
import { PublicService } from './public.service';

import type { Response } from 'express';

@Controller('public')
@Public()
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('landing/:slug')
  getLandingPage(@Param('slug') slug: string, @Query('lang') lang?: string) {
    return this.publicService.getLandingPageBySlug(slug, lang);
  }

  @Get('domains/:hostname')
  resolveDomain(@Param('hostname') hostname: string) {
    return this.publicService.resolveCustomDomain(hostname);
  }

  @Get('branding/:slug')
  getBranding(@Param('slug') slug: string) {
    return this.publicService.getBrandingBySlug(slug);
  }

  @Post('landing/:slug/scan')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordScan(@Param('slug') slug: string, @Query('qr') qrId?: string) {
    await this.publicService.recordScan(slug, qrId);
  }

  @Post('landing/:slug/leads')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createLead(@Param('slug') slug: string, @Body() dto: CreateLeadDto) {
    await this.publicService.createLead(slug, dto);
  }

  @Post('landing/:slug/review-funnel')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  submitReviewFunnel(@Param('slug') slug: string, @Body() dto: SubmitFunnelDto) {
    return this.publicService.submitReviewFunnel(slug, dto);
  }

  @Post('landing/:slug/review-funnel/draft')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  draftCustomerReview(@Param('slug') slug: string, @Body() dto: DraftCustomerReviewDto) {
    return this.publicService.draftCustomerReview(slug, dto);
  }

  @Post('landing/:slug/payment/claim')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  claimPayment(@Param('slug') slug: string, @Body() dto: ClaimPaymentDto) {
    return this.publicService.claimPayment(slug, dto);
  }

  @Post('landing/:slug/event')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordEvent(@Param('slug') slug: string, @Body() dto: CaptureEventDto) {
    await this.publicService.recordEvent(slug, dto);
  }

  @Post('landing/:slug/testimonials')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async submitTestimonial(@Param('slug') slug: string, @Body() dto: SubmitTestimonialDto) {
    await this.publicService.submitTestimonial(slug, dto);
  }

  @Get('landing/:slug/loyalty')
  lookupLoyaltyCard(@Param('slug') slug: string, @Query('phone') phone: string) {
    return this.publicService.lookupLoyaltyCard(slug, phone);
  }

  /** P9-01: hit directly by a phone camera for a "smart redirect" QR — no
   * JS involved, so this must be a plain server-side redirect. */
  @Get('qr/:id/go')
  @Redirect()
  async goToQrTarget(@Param('id') id: string) {
    return { url: await this.publicService.resolveQrRedirect(id) };
  }

  @Get('landing/:slug/coupons')
  listCoupons(@Param('slug') slug: string) {
    return this.publicService.listCoupons(slug);
  }

  @Get('landing/:slug/booking-slots')
  listBookingSlots(@Param('slug') slug: string) {
    return this.publicService.listBookingSlots(slug);
  }

  @Post('landing/:slug/booking-slots/:id/book')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async bookSlot(@Param('slug') slug: string, @Param('id') id: string, @Body() dto: BookSlotDto) {
    await this.publicService.bookSlot(slug, id, dto);
  }

  @Get('landing/:slug/menu')
  listMenu(@Param('slug') slug: string) {
    return this.publicService.listMenu(slug);
  }

  @Get('landing/:slug/loyalty/:cardId/apple-pass')
  async getApplePass(@Param('slug') slug: string, @Param('cardId') cardId: string, @Res() res: Response) {
    const buffer = await this.publicService.getApplePass(slug, cardId);
    if (!buffer) {
      throw new NotFoundException('Apple Wallet is not configured on this deployment yet.');
    }
    res.set({ 'Content-Type': 'application/vnd.apple.pkpass' }).send(buffer);
  }

  @Get('landing/:slug/loyalty/:cardId/google-wallet-link')
  async getGoogleWalletLink(@Param('slug') slug: string, @Param('cardId') cardId: string) {
    const link = await this.publicService.getGoogleWalletLink(slug, cardId);
    if (!link) {
      throw new NotFoundException('Google Wallet is not configured on this deployment yet.');
    }
    return { link };
  }

  @Post('landing/:slug/orders')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  placeOrder(@Param('slug') slug: string, @Body() dto: PlaceOrderDto) {
    return this.publicService.placeOrder(slug, dto);
  }
}
