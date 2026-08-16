import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { GroqService } from '../ai/groq.service';
import { PrismaService } from '../prisma/prisma.service';
import { QrService } from '../qr/qr.service';

import type { BusinessInfoDto } from './dto/business-info.dto';
import type { MenuSectionDto } from './dto/menu-section.dto';
import type { SavePaymentMethodsDto } from './dto/payment-methods.dto';
import type { SocialReviewDto } from './dto/social-review.dto';
import type { ThemeContent } from '@qrhub/types';

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'business'
  );
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly qrService: QrService,
    private readonly groqService: GroqService,
  ) {}

  private get landingAppUrl(): string {
    return this.configService.get<string>('LANDING_APP_URL') ?? 'http://localhost:3002';
  }

  /** P13-05: drafts a starter tagline + description from just a business
   * name (+ optional category) — cuts onboarding friction for a client
   * with a blank page in front of them. Purely generative, nothing is
   * saved here; the client edits and saves it themselves via the normal
   * business-info step like any other draft. */
  async draftBusinessCopy(businessName: string, category?: string): Promise<{ tagline: string; description: string } | null> {
    const raw = await this.groqService.chatComplete(
      [
        {
          role: 'system',
          content:
            'You write short starter website copy for small businesses. Respond with exactly two lines, nothing else: line 1 is a punchy one-sentence tagline (under 10 words), line 2 is a warm 2-3 sentence "About us" description. No labels, no markdown, no quotes.',
        },
        {
          role: 'user',
          content: `Business name: ${businessName}${category ? `\nCategory: ${category}` : ''}`,
        },
      ],
      200,
      0.7,
    );
    if (!raw) {
      return null;
    }
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return null;
    }
    const [tagline, ...rest] = lines;
    return { tagline, description: rest.join(' ').trim() };
  }

  async getStatus(userId: string) {
    const client = await this.prisma.client.findUnique({
      where: { userId },
      include: {
        landingPage: true,
        paymentMethods: true,
        socialLinks: true,
        googleReviewConfig: true,
        galleryImages: { orderBy: { displayOrder: 'asc' } },
        locations: { orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!client) {
      return {
        client: null,
        landingPage: null,
        paymentMethods: [],
        socialLinks: [],
        googleReviewConfig: null,
        galleryImages: [],
        locations: [],
        nextStep: 'business' as const,
      };
    }

    let nextStep: 'business' | 'theme' | 'payment' | 'social' | 'done' = 'done';
    if (!client.landingPage?.themeId) {
      nextStep = 'theme';
    } else if (client.paymentMethods.length === 0) {
      nextStep = 'payment';
    } else if (client.socialLinks.length === 0 && !client.googleReviewConfig) {
      nextStep = 'social';
    } else if (client.landingPage.status !== 'published') {
      nextStep = 'done';
    }

    return {
      client: { id: client.id, businessName: client.businessName, slug: client.slug, status: client.status },
      landingPage: client.landingPage,
      paymentMethods: client.paymentMethods,
      socialLinks: client.socialLinks,
      googleReviewConfig: client.googleReviewConfig,
      galleryImages: client.galleryImages,
      locations: client.locations,
      nextStep,
    };
  }

  /** P5-06: gallery photos, capped so one client can't unbounded-grow the
   * public page's payload — plenty for a small-business photo strip. */
  private static readonly MAX_GALLERY_IMAGES = 20;

  async addGalleryImage(clientId: string, imageUrl: string) {
    const count = await this.prisma.galleryImage.count({ where: { clientId } });
    if (count >= OnboardingService.MAX_GALLERY_IMAGES) {
      throw new BadRequestException(`You can only have up to ${String(OnboardingService.MAX_GALLERY_IMAGES)} gallery photos.`);
    }

    return this.prisma.galleryImage.create({
      data: { clientId, imageUrl, displayOrder: count },
    });
  }

  async removeGalleryImage(clientId: string, imageId: string) {
    const image = await this.prisma.galleryImage.findFirst({ where: { id: imageId, clientId } });
    if (!image) {
      throw new NotFoundException('Gallery image not found');
    }
    await this.prisma.galleryImage.delete({ where: { id: image.id } });
  }

  /** P5-08: a client's physical locations/branches, listed on their one
   * landing page. Capped the same way galleries are — a handful of branches
   * is the realistic ceiling for this "one page, not a multi-site chain
   * builder" scope. */
  private static readonly MAX_LOCATIONS = 20;

  async addLocation(clientId: string, dto: { name: string; address: string; phone?: string; hours?: string }) {
    const count = await this.prisma.location.count({ where: { clientId } });
    if (count >= OnboardingService.MAX_LOCATIONS) {
      throw new BadRequestException(`You can only have up to ${String(OnboardingService.MAX_LOCATIONS)} locations.`);
    }

    return this.prisma.location.create({
      data: {
        clientId,
        name: dto.name,
        address: dto.address,
        phone: dto.phone ?? null,
        hours: dto.hours ?? null,
        displayOrder: count,
      },
    });
  }

  async updateLocation(
    clientId: string,
    locationId: string,
    dto: { name?: string; address?: string; phone?: string; hours?: string },
  ) {
    const location = await this.prisma.location.findFirst({ where: { id: locationId, clientId } });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return this.prisma.location.update({
      where: { id: location.id },
      data: {
        name: dto.name ?? location.name,
        address: dto.address ?? location.address,
        phone: dto.phone ?? location.phone,
        hours: dto.hours ?? location.hours,
      },
    });
  }

  async removeLocation(clientId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({ where: { id: locationId, clientId } });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    await this.prisma.location.delete({ where: { id: location.id } });
  }

  /** Saves just the `contact` section (heading + booking link), merged onto
   * existing content_json — same reasoning as `saveMenuSection`. */
  async saveContactSection(clientId: string, dto: { heading?: string; bookingUrl?: string }) {
    const landingPage = await this.prisma.landingPage.findUnique({ where: { clientId } });
    if (!landingPage) {
      throw new NotFoundException('Finish onboarding before editing this section.');
    }

    const existingContent = (landingPage.contentJson as ThemeContent | undefined) ?? {};
    const content: ThemeContent = {
      ...existingContent,
      contact: { heading: dto.heading ?? '', bookingUrl: dto.bookingUrl ?? '' },
    };

    await this.prisma.landingPage.update({
      where: { clientId },
      data: { contentJson: content },
    });

    return { contact: content.contact };
  }

  async saveBusinessInfo(userId: string, dto: BusinessInfoDto) {
    let client = await this.prisma.client.findUnique({ where: { userId }, include: { landingPage: true } });

    if (!client) {
      const slug = await this.generateUniqueSlug(dto.businessName);
      const agency = dto.agencySlug
        ? await this.prisma.agency.findFirst({ where: { slug: dto.agencySlug, status: 'active' }, select: { id: true } })
        : null;
      client = await this.prisma.client.create({
        data: { userId, businessName: dto.businessName, slug, agencyId: agency?.id },
        include: { landingPage: true },
      });
    } else if (client.businessName !== dto.businessName) {
      client = await this.prisma.client.update({
        where: { id: client.id },
        data: { businessName: dto.businessName },
        include: { landingPage: true },
      });
    }

    // Merge onto whatever's already there — a hero/about save must not wipe
    // out other sections (e.g. `menu`) saved independently via their own
    // endpoint (see `saveMenuSection`).
    const existingContent = (client.landingPage?.contentJson as ThemeContent | undefined) ?? {};
    const content: ThemeContent = {
      ...existingContent,
      hero: {
        logoUrl: dto.logoUrl ?? '',
        backgroundImageUrl: dto.backgroundImageUrl ?? '',
        headline: dto.businessName,
        tagline: dto.tagline ?? '',
      },
      about: {
        description: dto.description ?? '',
        address: dto.address ?? '',
        hours: dto.hours ?? '',
        phone: dto.phone ?? '',
      },
    };

    const contentJson = content as unknown as Prisma.InputJsonValue;
    await this.prisma.landingPage.upsert({
      where: { clientId: client.id },
      create: { clientId: client.id, contentJson },
      update: { contentJson },
    });

    return this.getStatus(userId);
  }

  /** Saves just the `menu` section (heading + uploaded file URL), merged
   * onto existing content_json rather than replacing it — same reasoning
   * as `saveBusinessInfo` above. */
  async saveMenuSection(clientId: string, dto: MenuSectionDto) {
    const landingPage = await this.prisma.landingPage.findUnique({ where: { clientId } });
    if (!landingPage) {
      throw new NotFoundException('Finish onboarding before adding a menu.');
    }

    const existingContent = (landingPage.contentJson as ThemeContent | undefined) ?? {};
    const content: ThemeContent = {
      ...existingContent,
      menu: { heading: dto.heading ?? '', fileUrl: dto.fileUrl ?? '' },
    };

    await this.prisma.landingPage.update({
      where: { clientId },
      data: { contentJson: content },
    });

    return { menu: content.menu };
  }

  async selectTheme(clientId: string, themeId: string, accentColor?: string | null) {
    const theme = await this.prisma.theme.findUnique({ where: { id: themeId } });
    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    await this.prisma.client.update({ where: { id: clientId }, data: { themeId } });
    const landingPage = await this.prisma.landingPage.update({
      where: { clientId },
      data: accentColor === undefined ? { themeId } : { themeId, accentColor },
    });

    if (landingPage.status === 'published') {
      const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
      this.revalidateLandingPage(client.slug).catch(() => {
        // Best-effort — the ISR cache will still expire on its own schedule.
      });
    }

    return landingPage;
  }

  async savePaymentMethods(clientId: string, dto: SavePaymentMethodsDto) {
    for (const method of dto.methods) {
      if (!method.qrImageUrl && !method.upiId) {
        throw new BadRequestException('Each payment method needs a QR image or a UPI ID');
      }
    }

    await this.prisma.$transaction([
      this.prisma.paymentMethod.deleteMany({ where: { clientId } }),
      this.prisma.paymentMethod.createMany({
        data: dto.methods.map((method, index) => ({
          clientId,
          type: method.type,
          qrImageUrl: method.qrImageUrl ?? null,
          upiId: method.upiId ?? null,
          displayOrder: index,
        })),
      }),
    ]);

    return this.prisma.paymentMethod.findMany({ where: { clientId }, orderBy: { displayOrder: 'asc' } });
  }

  async saveSocialAndReview(clientId: string, dto: SocialReviewDto) {
    const normalized = dto.socialLinks.map((link, index) => ({
      clientId,
      platform: link.platform,
      value: this.normalizeSocialValue(link.platform, link.value),
      displayOrder: index,
    }));

    await this.prisma.$transaction([
      this.prisma.socialLink.deleteMany({ where: { clientId } }),
      ...(normalized.length > 0 ? [this.prisma.socialLink.createMany({ data: normalized })] : []),
    ]);

    if (dto.reviewLink || dto.sheetId || dto.sheetRange || dto.googlePlaceId) {
      await this.prisma.googleReviewConfig.upsert({
        where: { clientId },
        create: {
          clientId,
          reviewLink: dto.reviewLink ?? null,
          sheetId: dto.sheetId ?? null,
          sheetRange: dto.sheetRange ?? null,
          googlePlaceId: dto.googlePlaceId ?? null,
        },
        update: {
          reviewLink: dto.reviewLink ?? null,
          sheetId: dto.sheetId ?? null,
          sheetRange: dto.sheetRange ?? null,
          googlePlaceId: dto.googlePlaceId ?? null,
        },
      });
    }

    return this.getStatus((await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } })).userId);
  }

  async complete(clientId: string) {
    const client = await this.prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      include: { landingPage: true, paymentMethods: true },
    });

    if (!client.landingPage?.themeId) {
      throw new BadRequestException('Pick a theme before publishing');
    }
    if (client.paymentMethods.length === 0) {
      throw new BadRequestException('Add at least one payment method before publishing');
    }

    await this.prisma.landingPage.update({
      where: { clientId },
      data: { status: 'published', publishedAt: new Date() },
    });

    const landingUrl = `${this.landingAppUrl}/site/${client.slug}`;
    const qrCode = await this.qrService.generateForClient(clientId);

    this.revalidateLandingPage(client.slug).catch(() => {
      // Best-effort — the ISR cache will still expire on its own schedule.
    });

    return { landingUrl, qrImageUrl: qrCode.imageUrl, svgImageUrl: qrCode.svgImageUrl };
  }

  private async revalidateLandingPage(slug: string): Promise<void> {
    const secret = this.configService.get<string>('REVALIDATE_SECRET') ?? 'dev-revalidate-secret';
    await fetch(`${this.landingAppUrl}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, secret }),
    });
  }

  private normalizeSocialValue(platform: 'whatsapp' | 'instagram' | 'facebook', value: string): string {
    const trimmed = value.trim();
    if (platform === 'whatsapp') {
      return trimmed.replace(/\D/g, '');
    }
    if (trimmed.startsWith('http')) {
      return trimmed;
    }
    const handle = trimmed.replace(/^@/, '');
    return platform === 'instagram' ? `https://instagram.com/${handle}` : `https://facebook.com/${handle}`;
  }

  private async generateUniqueSlug(businessName: string): Promise<string> {
    const base = slugify(businessName);
    let candidate = base;
    let suffix = 2;
    while (await this.prisma.client.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${String(suffix)}`;
      suffix += 1;
    }
    return candidate;
  }
}
