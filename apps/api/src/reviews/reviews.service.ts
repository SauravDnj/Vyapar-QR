import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GroqService } from '../ai/groq.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

import { DEFAULT_COLUMN_MAPPING, GoogleSheetsService, type ColumnMapping, type SheetReviewRow } from './google-sheets.service';
import { PlacesApiService } from './places-api.service';

import type { DraftCustomerReviewDto } from './dto/draft-customer-review.dto';
import type { SaveReviewConfigDto } from './dto/save-review-config.dto';
import type { SubmitFunnelDto } from './dto/submit-funnel.dto';
import type { GoogleReviewConfig } from '@prisma/client';

export interface ReviewConfigResult {
  config: GoogleReviewConfig | null;
  sheetsConfigured: boolean;
  whatsappConfigured: boolean;
}

export interface FunnelStats {
  totalResponses: number;
  /** 4–5★ responses, routed to the public Google review link. */
  highRatingCount: number;
  /** 1–3★ responses, kept as private feedback. */
  lowRatingCount: number;
  highRatingPercent: number;
  lowRatingPercent: number;
}

/** Delay between per-client syncs in the sweep, to stay comfortably under
 * the Google Sheets API's default per-minute read quota when one service
 * account is shared across every client's sheet. */
const SYNC_DELAY_MS = 1100;
/** Consecutive sync failures for one client before escalating the log
 * level — there's no SMTP configured in this environment (see other
 * "not started, no credentials" notes), so a clearly-flagged error log is
 * the alerting channel until email is wired up. */
const FAILURE_ALERT_THRESHOLD = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);
  private readonly consecutiveFailures = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly placesApiService: PlacesApiService,
    private readonly webhooksService: WebhooksService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsappService,
    private readonly smsService: SmsService,
    private readonly groqService: GroqService,
    private readonly configService: ConfigService,
  ) {}

  async getConfig(clientId: string): Promise<ReviewConfigResult> {
    const config = await this.prisma.googleReviewConfig.findUnique({ where: { clientId } });
    return { config, sheetsConfigured: this.googleSheetsService.isConfigured, whatsappConfigured: this.whatsappService.isConfigured };
  }

  async saveConfig(clientId: string, dto: SaveReviewConfigDto): Promise<GoogleReviewConfig> {
    const data = {
      sheetId: dto.sheetId ?? null,
      sheetRange: dto.sheetRange ?? null,
      googlePlaceId: dto.googlePlaceId ?? null,
      reviewLink: dto.reviewLink ?? null,
      feedbackWhatsappNumber: dto.feedbackWhatsappNumber ?? null,
      feedbackSheetId: dto.feedbackSheetId ?? null,
      feedbackSheetTab: dto.feedbackSheetTab ?? null,
      columnMapping: dto.columnMapping
        ? {
            reviewerName: dto.columnMapping.reviewerName,
            rating: dto.columnMapping.rating,
            comment: dto.columnMapping.comment,
            reviewDate: dto.columnMapping.reviewDate,
          }
        : undefined,
    };

    return this.prisma.googleReviewConfig.upsert({
      where: { clientId },
      create: { clientId, ...data },
      update: data,
    });
  }

  /** Prefers a live Places API pull when the client has a `googlePlaceId`
   * set and the platform has a Places API key configured — fresher than a
   * manually-maintained sheet. Falls back to the Sheets sync otherwise, so
   * a client with only a sheet keeps working exactly as before. */
  async syncNow(clientId: string): Promise<GoogleReviewConfig> {
    const config = await this.prisma.googleReviewConfig.findUnique({ where: { clientId } });

    if (config?.googlePlaceId && this.placesApiService.isConfigured) {
      const { avgRating, rows } = await this.placesApiService.fetchReviews(config.googlePlaceId);
      return this.writeReviewsToCache(clientId, rows, avgRating);
    }

    if (!this.googleSheetsService.isConfigured) {
      throw new BadRequestException('Neither the Places API nor Google Sheets sync is configured on this deployment yet.');
    }
    if (!config?.sheetId || !config.sheetRange) {
      throw new BadRequestException('Connect a Google Sheet (ID and range) before syncing.');
    }

    const columnMapping = (config.columnMapping as unknown as ColumnMapping | null) ?? DEFAULT_COLUMN_MAPPING;
    const rows = await this.googleSheetsService.fetchRows(config.sheetId, config.sheetRange, columnMapping);
    const avgRating = rows.length > 0 ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : null;
    return this.writeReviewsToCache(clientId, rows, avgRating);
  }

  private async writeReviewsToCache(clientId: string, rows: SheetReviewRow[], avgRating: number | null): Promise<GoogleReviewConfig> {
    await this.prisma.$transaction([
      this.prisma.reviewCache.deleteMany({ where: { clientId } }),
      ...(rows.length > 0
        ? [
            this.prisma.reviewCache.createMany({
              data: rows.map((row) => ({
                clientId,
                reviewerName: row.reviewerName,
                rating: row.rating,
                comment: row.comment,
                reviewDate: row.reviewDate ?? new Date(),
              })),
            }),
          ]
        : []),
    ]);

    const updated = await this.prisma.googleReviewConfig.update({
      where: { clientId },
      data: {
        avgRatingCached: avgRating !== null ? avgRating.toFixed(1) : null,
        lastSyncedAt: new Date(),
      },
    });

    await this.webhooksService.dispatch(clientId, 'review.synced', {
      reviewCount: rows.length,
      avgRating: updated.avgRatingCached?.toString() ?? null,
      syncedAt: updated.lastSyncedAt?.toISOString() ?? null,
    });

    return updated;
  }

  /** Called by the scheduled sweep — logs and skips rather than throwing, so
   * one client's missing/broken sheet doesn't stop the rest of the sweep. */
  async syncAllConfiguredClients(): Promise<{ synced: number; skipped: number }> {
    if (!this.googleSheetsService.isConfigured && !this.placesApiService.isConfigured) {
      this.logger.warn('Review sync skipped — neither Google Sheets nor the Places API is configured.');
      return { synced: 0, skipped: 0 };
    }

    const configs = await this.prisma.googleReviewConfig.findMany({
      where: {
        OR: [
          { sheetId: { not: null }, sheetRange: { not: null } },
          ...(this.placesApiService.isConfigured ? [{ googlePlaceId: { not: null } }] : []),
        ],
      },
      select: { clientId: true },
    });

    let synced = 0;
    let skipped = 0;
    for (const [index, { clientId }] of configs.entries()) {
      try {
        await this.syncNow(clientId);
        synced += 1;
        this.consecutiveFailures.delete(clientId);
      } catch (error) {
        skipped += 1;
        const failureCount = (this.consecutiveFailures.get(clientId) ?? 0) + 1;
        this.consecutiveFailures.set(clientId, failureCount);
        const message = error instanceof Error ? error.message : String(error);

        if (failureCount >= FAILURE_ALERT_THRESHOLD) {
          this.logger.error(`ALERT: review sync has failed ${String(failureCount)} times in a row for client ${clientId}: ${message}`);
        } else {
          this.logger.warn(`Review sync failed for client ${clientId}: ${message}`);
        }
      }

      if (index < configs.length - 1) {
        await sleep(SYNC_DELAY_MS);
      }
    }

    return { synced, skipped };
  }

  async getCachedReviews(clientId: string) {
    return this.prisma.reviewCache.findMany({
      where: { clientId },
      orderBy: { reviewDate: 'desc' },
      take: 20,
    });
  }

  /** P13-01: drafts (and caches) a suggested public reply to a synced
   * review. Doesn't post anywhere itself — there's no direct Google
   * Business posting API wired up — the owner copies/edits it themselves.
   * Regenerating overwrites the cached draft; a fresh review always starts
   * with none. */
  async draftReply(clientId: string, reviewId: string): Promise<{ draft: string | null }> {
    const [review, client] = await Promise.all([
      this.prisma.reviewCache.findFirst({ where: { id: reviewId, clientId } }),
      this.prisma.client.findUnique({ where: { id: clientId }, select: { businessName: true } }),
    ]);
    if (!review || !client) {
      throw new NotFoundException('Review not found');
    }

    const draft = await this.groqService.chatComplete(
      [
        {
          role: 'system',
          content: `You write short, warm, genuine-sounding public replies to customer reviews on behalf of "${client.businessName}". Thank the reviewer by name, reference something specific from their review, and keep it to 1-3 sentences with no markdown. If the review is negative, apologize sincerely and invite them to reach out directly rather than getting defensive.`,
        },
        {
          role: 'user',
          content: `Reviewer: ${review.reviewerName}\nRating: ${String(review.rating)}/5\nReview: ${review.comment ?? '(no comment left)'}`,
        },
      ],
      200,
      0.6,
    );

    await this.prisma.reviewCache.update({ where: { id: reviewId }, data: { aiReplyDraft: draft } });
    return { draft };
  }

  async getFunnelStats(clientId: string): Promise<FunnelStats> {
    const [totalResponses, highRatingCount] = await Promise.all([
      this.prisma.reviewFunnelResponse.count({ where: { clientId } }),
      this.prisma.reviewFunnelResponse.count({ where: { clientId, routedToGoogle: true } }),
    ]);

    const lowRatingCount = totalResponses - highRatingCount;
    const highRatingPercent = totalResponses > 0 ? Math.round((highRatingCount / totalResponses) * 100) : 0;
    const lowRatingPercent = totalResponses > 0 ? 100 - highRatingPercent : 0;

    return { totalResponses, highRatingCount, lowRatingCount, highRatingPercent, lowRatingPercent };
  }

  /** Helps a customer who's already rated 4-5★ write their public Google
   * review — never posts anywhere itself (no API lets any app submit a
   * review on a customer's behalf; only their own logged-in Google account
   * can do that). Grounded in the business's real name and whatever the
   * customer typed themselves, so it doesn't invent specifics they never
   * mentioned — stays warm-but-generic when `notes` is blank. Stateless,
   * nothing written to the database. */
  async draftCustomerReview(slug: string, dto: DraftCustomerReviewDto): Promise<{ draft: string | null }> {
    if (dto.website) {
      // Honeypot tripped — same silent-success convention as every other public form.
      return { draft: null };
    }

    const client = await this.prisma.client.findUnique({ where: { slug }, select: { businessName: true } });
    if (!client) {
      return { draft: null };
    }

    const draft = await this.groqService.chatComplete(
      [
        {
          role: 'system',
          content:
            'You write short, natural-sounding public Google reviews as if written by a real happy customer — 2-4 sentences, no markdown, no hashtags, no exclamation-mark overload. Only mention specific details the customer actually gave you; if they gave none, keep it warm but general rather than inventing specifics (e.g. "great service" is fine, a made-up staff name is not).',
        },
        {
          role: 'user',
          content: `Business: ${client.businessName}\nRating I'm giving: ${String(dto.rating)}/5\nWhat I liked (may be blank): ${dto.notes ?? '(nothing specific mentioned)'}`,
        },
      ],
      200,
      0.7,
    );

    return { draft };
  }

  async submitFunnelResponse(
    slug: string,
    dto: SubmitFunnelDto,
  ): Promise<{ routedToGoogle: boolean; reviewLink: string | null }> {
    if (dto.website) {
      // Honeypot tripped — silent success, no row written.
      return { routedToGoogle: false, reviewLink: null };
    }

    const client = await this.prisma.client.findUnique({
      where: { slug },
      include: { googleReviewConfig: true, user: { select: { email: true } } },
    });
    if (!client) {
      return { routedToGoogle: false, reviewLink: null };
    }

    const routedToGoogle = dto.rating >= 4;
    const feedbackText = routedToGoogle ? null : (dto.feedbackText ?? null);

    await this.prisma.reviewFunnelResponse.create({
      data: { clientId: client.id, ratingGiven: dto.rating, routedToGoogle, feedbackText },
    });

    if (!routedToGoogle) {
      await this.alertOwnerOfLowRating(client.businessName, client.user.email, dto.rating, feedbackText, client.googleReviewConfig?.feedbackWhatsappNumber ?? null);
      await this.logFeedbackToSheet(client.googleReviewConfig, dto.rating, feedbackText);
    }

    return { routedToGoogle, reviewLink: client.googleReviewConfig?.reviewLink ?? null };
  }

  /** Appends private feedback as a new Sheet row so the owner can manage it
   * alongside their other spreadsheets. Best-effort like the WhatsApp
   * alert above — a Sheets outage must never block the customer's
   * submission or hide the email alert that already fired. */
  private async logFeedbackToSheet(
    config: GoogleReviewConfig | null | undefined,
    rating: number,
    feedbackText: string | null,
  ): Promise<void> {
    const sheetId = config?.feedbackSheetId ?? config?.sheetId ?? null;
    const tab = config?.feedbackSheetTab;
    if (!sheetId || !tab || !this.googleSheetsService.isConfigured) {
      return;
    }

    try {
      await this.googleSheetsService.appendFeedbackRow(sheetId, tab, { rating, feedbackText, submittedAt: new Date() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to append feedback to Google Sheet ${sheetId}!${tab}: ${message}`);
    }
  }

  /** P11-01: "Smart Review Filter" — 1–3★ feedback never goes public, but
   * the owner shouldn't have to remember to check the dashboard for it
   * either. Email always fires (works today via this deployment's SMTP —
   * see P1-48); WhatsApp fires too when both the client has set an alert
   * number *and* `WhatsappService.isConfigured` (needs real Meta Cloud API
   * credentials this sandbox doesn't have). Neither channel throws on
   * failure — a notification problem must never break the customer's
   * feedback submission. */
  private async alertOwnerOfLowRating(
    businessName: string,
    ownerEmail: string,
    rating: number,
    feedbackText: string | null,
    whatsappNumber: string | null,
  ): Promise<void> {
    const adminAppUrl = this.configService.get<string>('ADMIN_APP_URL') ?? 'http://localhost:3001';
    const reviewsUrl = `${adminAppUrl}/dashboard/reviews`;

    await this.emailService.sendLowRatingFeedback(ownerEmail, businessName, rating, feedbackText, reviewsUrl);

    if (whatsappNumber) {
      const message = `${businessName}: new ${String(rating)}★ private feedback${feedbackText ? ` — "${feedbackText}"` : ' (no comment left)'}. This was NOT posted publicly. View: ${reviewsUrl}`;
      await this.whatsappService.sendText(whatsappNumber, message);
    }

    if (whatsappNumber && this.smsService.isConfigured) {
      await this.smsService.sendText(whatsappNumber, `${businessName}: new ${String(rating)}★ private feedback received. Not posted publicly. View: ${reviewsUrl}`);
    }
  }
}
