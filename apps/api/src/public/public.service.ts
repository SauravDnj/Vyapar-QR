import { Injectable, NotFoundException } from '@nestjs/common';

import { AnalyticsService } from '../analytics/analytics.service';
import { BookingsService } from '../bookings/bookings.service';
import { CouponsService } from '../coupons/coupons.service';
import { DomainsService } from '../domains/domains.service';
import { LeadsService } from '../leads/leads.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { QrService } from '../qr/qr.service';
import { ReviewsService } from '../reviews/reviews.service';
import { TestimonialsService } from '../testimonials/testimonials.service';
import { TranslationsService } from '../translations/translations.service';
import { WalletService } from '../wallet/wallet.service';

import type { CaptureEventDto } from '../analytics/dto/capture-event.dto';
import type { BookSlotDto } from '../bookings/dto/book-slot.dto';
import type { CreateLeadDto } from '../leads/dto/create-lead.dto';
import type { PlaceOrderDto } from '../menu/dto/place-order.dto';
import type { DraftCustomerReviewDto } from '../reviews/dto/draft-customer-review.dto';
import type { SubmitFunnelDto } from '../reviews/dto/submit-funnel.dto';
import type { SubmitTestimonialDto } from '../testimonials/dto/submit-testimonial.dto';
import type { PlanFeatures, ThemeContent } from '@qrhub/types';

const CACHED_REVIEWS_LIMIT = 6;

export type PublicLandingPageResult =
  | { status: 'suspended'; businessName: string }
  | {
      status: 'published';
      businessName: string;
      themeName: string;
      seoMeta: unknown;
      content: ThemeContent;
      paymentMethods: { id: string; type: string; qrImageUrl: string | null; upiId: string | null; displayOrder: number }[];
      socialLinks: { id: string; platform: string; value: string; displayOrder: number }[];
      reviewConfig: { reviewLink: string | null; avgRatingCached: string | null } | null;
      reviews: { id: string; reviewerName: string; rating: number; comment: string | null; reviewDate: string }[];
      hideBranding: boolean;
      availableLocales: string[];
      activeLocale: string | null;
      accentColor: string | null;
      galleryImages: { id: string; imageUrl: string; displayOrder: number }[];
      locations: { id: string; name: string; address: string; phone: string | null; hours: string | null; displayOrder: number }[];
      testimonials: { id: string; authorName: string; quote: string; rating: number | null }[];
      loyaltyActive: boolean;
    };

/** Overlays a translation on the default-locale content, field by field —
 * a translation missing a field (or a whole section) falls back to the
 * default rather than rendering blank. */
function mergeContent(base: ThemeContent, override: ThemeContent): ThemeContent {
  const merged: ThemeContent = { ...base };
  for (const key of Object.keys(override) as (keyof ThemeContent)[]) {
    merged[key] = { ...(base[key] ?? {}), ...(override[key] ?? {}) };
  }
  return merged;
}

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qrService: QrService,
    private readonly leadsService: LeadsService,
    private readonly reviewsService: ReviewsService,
    private readonly analyticsService: AnalyticsService,
    private readonly domainsService: DomainsService,
    private readonly translationsService: TranslationsService,
    private readonly testimonialsService: TestimonialsService,
    private readonly loyaltyService: LoyaltyService,
    private readonly couponsService: CouponsService,
    private readonly bookingsService: BookingsService,
    private readonly menuService: MenuService,
    private readonly walletService: WalletService,
  ) {}

  resolveCustomDomain(hostname: string): Promise<{ slug: string }> {
    return this.domainsService.resolveHostname(hostname);
  }

  /** P4-03 — powers the branded per-client login page. Only clients on a
   * `whiteLabel`-enabled plan get their business name/logo back; everyone
   * else gets `whiteLabelEnabled: false` so the frontend falls back to the
   * generic QRHub login rather than showing a half-branded page. */
  async getBrandingBySlug(slug: string): Promise<{ businessName: string; logoUrl: string | null; whiteLabelEnabled: boolean }> {
    const client = await this.prisma.client.findUnique({
      where: { slug },
      include: {
        landingPage: true,
        subscriptions: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: { select: { featuresJson: true } } },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Page not found');
    }

    const whiteLabelEnabled = this.resolveHideBranding(client.subscriptions[0]);
    if (!whiteLabelEnabled) {
      return { businessName: client.businessName, logoUrl: null, whiteLabelEnabled: false };
    }

    const content = client.landingPage?.contentJson as ThemeContent | undefined;
    const logoUrl = (content?.hero?.logoUrl) ?? null;
    return { businessName: client.businessName, logoUrl, whiteLabelEnabled: true };
  }

  recordScan(slug: string, qrId?: string): Promise<void> {
    return this.qrService.recordScan(slug, qrId);
  }

  recordEvent(slug: string, dto: CaptureEventDto): Promise<void> {
    return this.analyticsService.recordEvent(slug, dto);
  }

  createLead(slug: string, dto: CreateLeadDto): Promise<void> {
    return this.leadsService.createFromContactForm(slug, dto);
  }

  submitReviewFunnel(slug: string, dto: SubmitFunnelDto) {
    return this.reviewsService.submitFunnelResponse(slug, dto);
  }

  draftCustomerReview(slug: string, dto: DraftCustomerReviewDto) {
    return this.reviewsService.draftCustomerReview(slug, dto);
  }

  submitTestimonial(slug: string, dto: SubmitTestimonialDto): Promise<void> {
    return this.testimonialsService.submit(slug, dto);
  }

  lookupLoyaltyCard(slug: string, phone: string) {
    return this.loyaltyService.lookupForCustomer(slug, phone);
  }

  async getApplePass(slug: string, cardId: string): Promise<Buffer | null> {
    const { client, card, program } = await this.resolveLoyaltyPassData(slug, cardId);
    return this.walletService.generateApplePass({
      cardId: card.id,
      businessName: client.businessName,
      stampCount: card.stampCount,
      stampsRequired: program.stampsRequired,
      rewardText: program.rewardText,
    });
  }

  async getGoogleWalletLink(slug: string, cardId: string): Promise<string | null> {
    const { client, card, program } = await this.resolveLoyaltyPassData(slug, cardId);
    return this.walletService.generateGoogleWalletLink({
      cardId: card.id,
      businessName: client.businessName,
      stampCount: card.stampCount,
      stampsRequired: program.stampsRequired,
      rewardText: program.rewardText,
    });
  }

  private async resolveLoyaltyPassData(slug: string, cardId: string) {
    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true, businessName: true } });
    if (!client) {
      throw new NotFoundException('Page not found');
    }
    const [card, program] = await Promise.all([this.loyaltyService.findCardOrThrow(client.id, cardId), this.loyaltyService.getProgram(client.id)]);
    if (!program) {
      throw new NotFoundException('No loyalty program configured');
    }
    return { client, card, program };
  }

  resolveQrRedirect(id: string): Promise<string> {
    return this.qrService.resolveRedirect(id);
  }

  async listCoupons(slug: string) {
    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (!client) {
      return [];
    }
    return this.couponsService.listActiveForPublic(client.id);
  }

  listBookingSlots(slug: string) {
    return this.bookingsService.listOpenForPublic(slug);
  }

  bookSlot(slug: string, slotId: string, dto: BookSlotDto): Promise<void> {
    return this.bookingsService.book(slug, slotId, dto);
  }

  async listMenu(slug: string) {
    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (!client) {
      return [];
    }
    return this.menuService.listActiveForPublic(client.id);
  }

  placeOrder(slug: string, dto: PlaceOrderDto): Promise<void> {
    return this.menuService.placeOrder(slug, dto);
  }

  async getLandingPageBySlug(slug: string, locale?: string): Promise<PublicLandingPageResult> {
    const client = await this.prisma.client.findUnique({
      where: { slug },
      include: {
        landingPage: { include: { theme: true } },
        paymentMethods: true,
        socialLinks: true,
        googleReviewConfig: true,
        reviewsCache: { orderBy: { reviewDate: 'desc' }, take: CACHED_REVIEWS_LIMIT },
        galleryImages: { orderBy: { displayOrder: 'asc' } },
        locations: { orderBy: { displayOrder: 'asc' } },
        testimonials: { where: { isApproved: true }, orderBy: { displayOrder: 'asc' } },
        loyaltyProgram: true,
        subscriptions: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: { select: { featuresJson: true } } },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Page not found');
    }

    if (client.status === 'suspended') {
      return { status: 'suspended', businessName: client.businessName };
    }

    if (client.landingPage?.status !== 'published' || !client.landingPage.theme) {
      throw new NotFoundException('Page not found');
    }

    const availableLocales = await this.translationsService.listLocales(client.landingPage.id);
    const activeLocale = locale && availableLocales.includes(locale) ? locale : null;
    const defaultContent = client.landingPage.contentJson as ThemeContent;
    const translatedContent = activeLocale ? await this.translationsService.getContent(client.landingPage.id, activeLocale) : null;

    return {
      status: 'published',
      businessName: client.businessName,
      themeName: client.landingPage.theme.name,
      seoMeta: client.landingPage.seoMeta,
      content: translatedContent ? mergeContent(defaultContent, translatedContent) : defaultContent,
      availableLocales,
      activeLocale,
      paymentMethods: client.paymentMethods
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((m) => ({ id: m.id, type: m.type, qrImageUrl: m.qrImageUrl, upiId: m.upiId, displayOrder: m.displayOrder })),
      socialLinks: client.socialLinks
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((s) => ({ id: s.id, platform: s.platform, value: s.value, displayOrder: s.displayOrder })),
      reviewConfig: client.googleReviewConfig
        ? {
            reviewLink: client.googleReviewConfig.reviewLink,
            avgRatingCached: client.googleReviewConfig.avgRatingCached?.toString() ?? null,
          }
        : null,
      reviews: client.reviewsCache.map((review) => ({
        id: review.id,
        reviewerName: review.reviewerName,
        rating: review.rating,
        comment: review.comment,
        reviewDate: review.reviewDate.toISOString(),
      })),
      hideBranding: this.resolveHideBranding(client.subscriptions[0]),
      accentColor: client.landingPage.accentColor,
      galleryImages: client.galleryImages.map((g) => ({ id: g.id, imageUrl: g.imageUrl, displayOrder: g.displayOrder })),
      locations: client.locations.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address,
        phone: l.phone,
        hours: l.hours,
        displayOrder: l.displayOrder,
      })),
      testimonials: client.testimonials.map((t) => ({ id: t.id, authorName: t.authorName, quote: t.quote, rating: t.rating })),
      loyaltyActive: client.loyaltyProgram?.isActive ?? false,
    };
  }

  private resolveHideBranding(subscription?: { plan: { featuresJson: unknown } }): boolean {
    const features = subscription?.plan.featuresJson as PlanFeatures | undefined;
    return features?.whiteLabel ?? false;
  }
}
