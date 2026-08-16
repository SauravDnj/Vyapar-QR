import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { LandingPageTranslation } from '@prisma/client';
import type { ThemeContent } from '@qrhub/types';

const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

export interface TranslationSummary {
  locale: string;
  content: ThemeContent;
  updatedAt: string;
}

/** P3-04: `LandingPageTranslation` rows are per-locale *overrides* of the
 * default-locale `LandingPage.contentJson` — a translation only needs to
 * fill in the sections/fields the client has actually translated, since
 * the public renderer merges over the default content field-by-field (see
 * `PublicService`), never blanking a section just because one language is
 * incomplete. */
@Injectable()
export class TranslationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(clientId: string): Promise<TranslationSummary[]> {
    const landingPage = await this.getLandingPageOrThrow(clientId);
    const rows = await this.prisma.landingPageTranslation.findMany({
      where: { landingPageId: landingPage.id },
      orderBy: { locale: 'asc' },
    });
    return rows.map((row) => this.toSummary(row));
  }

  async upsert(clientId: string, locale: string, content: Record<string, Record<string, string>>): Promise<TranslationSummary> {
    this.assertValidLocale(locale);
    const landingPage = await this.getLandingPageOrThrow(clientId);

    const row = await this.prisma.landingPageTranslation.upsert({
      where: { landingPageId_locale: { landingPageId: landingPage.id, locale } },
      create: { landingPageId: landingPage.id, locale, contentJson: content },
      update: { contentJson: content },
    });
    return this.toSummary(row);
  }

  async remove(clientId: string, locale: string): Promise<void> {
    const landingPage = await this.getLandingPageOrThrow(clientId);
    await this.prisma.landingPageTranslation.deleteMany({ where: { landingPageId: landingPage.id, locale } });
  }

  /** Used by `PublicService` — no client-scoping needed since the caller
   * already resolved `landingPageId` from a public slug lookup. */
  async listLocales(landingPageId: string): Promise<string[]> {
    const rows = await this.prisma.landingPageTranslation.findMany({
      where: { landingPageId },
      select: { locale: true },
      orderBy: { locale: 'asc' },
    });
    return rows.map((row) => row.locale);
  }

  async getContent(landingPageId: string, locale: string): Promise<ThemeContent | null> {
    const row = await this.prisma.landingPageTranslation.findUnique({
      where: { landingPageId_locale: { landingPageId, locale } },
    });
    return row ? (row.contentJson as unknown as ThemeContent) : null;
  }

  private assertValidLocale(locale: string): void {
    if (!LOCALE_PATTERN.test(locale)) {
      throw new BadRequestException('Use a language code like "en", "hi", or "en-US".');
    }
  }

  private async getLandingPageOrThrow(clientId: string) {
    const landingPage = await this.prisma.landingPage.findUnique({ where: { clientId } });
    if (!landingPage) {
      throw new NotFoundException('Finish onboarding before adding translations.');
    }
    return landingPage;
  }

  private toSummary(row: LandingPageTranslation): TranslationSummary {
    return { locale: row.locale, content: row.contentJson as unknown as ThemeContent, updatedAt: row.updatedAt.toISOString() };
  }
}
