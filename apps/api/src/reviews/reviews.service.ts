import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';

import { GroqService } from '../ai/groq.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

import { blankToNull, buildGoogleReviewUrl, isGoogleLink, resolveGoogleLink, writeReviewUrl } from './google-review-link';
import { DEFAULT_COLUMN_MAPPING, GoogleSheetsService, type ColumnMapping, type SheetReviewRow } from './google-sheets.service';
import { PlacesApiService } from './places-api.service';
import { buildReviewMessages, cleanGeneratedReview, composeReviewWithoutAi } from './review-writer';

import type { GoogleReviewConfig, ReviewFunnelResponse } from '../jsondb';
import type { DraftCustomerReviewDto } from './dto/draft-customer-review.dto';
import type { ReviewHandoffDto } from './dto/review-handoff.dto';
import type { SaveReviewConfigDto } from './dto/save-review-config.dto';
import type { SubmitFunnelDto } from './dto/submit-funnel.dto';

export interface ReviewConfigResult {
  config: GoogleReviewConfig | null;
  sheetsConfigured: boolean;
  whatsappConfigured: boolean;
  /** Groq key set — review drafts are AI-written; otherwise a template polish. */
  aiConfigured: boolean;
  /** Places key set — a share link's business is matched to a Place ID. */
  placesConfigured: boolean;
  /** Where the page's review button actually sends a customer right now. */
  effectiveReviewUrl: string | null;
}

export interface ReviewLinkCheck {
  valid: boolean;
  message: string;
  finalUrl: string | null;
  businessName: string | null;
  placeId: string | null;
  address: string | null;
  /** What customers will be sent to: the review box when a Place ID is known,
   * otherwise the business profile the link opens. */
  reviewUrl: string | null;
}

export interface ReviewShareKit {
  /** Our own review page — rating gate, then the writer. */
  reviewPageUrl: string;
  /** Where that page sends a happy customer; null until a link is saved. */
  googleUrl: string | null;
  whatsappMessage: string;
  whatsappShareUrl: string;
  /** PNG data URL of the review page's QR, for printing at the counter. */
  qrDataUrl: string | null;
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
    return {
      config,
      sheetsConfigured: this.googleSheetsService.isConfigured,
      whatsappConfigured: this.whatsappService.isConfigured,
      aiConfigured: this.groqService.isConfigured,
      placesConfigured: this.placesApiService.isConfigured,
      effectiveReviewUrl: buildGoogleReviewUrl({ reviewLink: config?.reviewLink, googlePlaceId: config?.googlePlaceId }),
    };
  }

  /**
   * Checks a pasted Google Business link before it's saved: follows a
   * share.google / maps.app.goo.gl short link to where it really goes, reads
   * the business name out of it, and — when a Places key is configured —
   * matches that name to a Place ID so the button can open the review box
   * itself rather than the profile.
   */
  async checkReviewLink(url: string): Promise<ReviewLinkCheck> {
    const empty = { finalUrl: null, businessName: null, placeId: null, address: null, reviewUrl: null };
    if (!isGoogleLink(url)) {
      return {
        valid: false,
        message: 'That isn’t a Google link. Paste the link from your Google Business Profile’s Share button (it starts with https://share.google/ or https://maps.app.goo.gl/).',
        ...empty,
      };
    }

    let resolved: Awaited<ReturnType<typeof resolveGoogleLink>>;
    try {
      resolved = await resolveGoogleLink(url);
    } catch (error) {
      this.logger.warn(`Could not resolve Google link ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: true, message: 'Couldn’t reach Google to check this link, but it looks like a Google link. You can still save it.', ...empty, finalUrl: url, reviewUrl: url };
    }

    let placeId = resolved.placeId;
    let address: string | null = null;
    let businessName = resolved.businessName;
    if (!placeId && businessName && this.placesApiService.isConfigured) {
      const place = await this.placesApiService.findPlace(businessName).catch(() => null);
      if (place) {
        placeId = place.placeId;
        address = place.address;
        businessName = place.name ?? businessName;
      }
    }

    return {
      valid: true,
      message: placeId
        ? 'Link works — customers will go straight to the “Write a review” box.'
        : businessName
          ? 'Link works — customers will open your Google Business Profile and tap “Write a review”.'
          : 'Link works.',
      finalUrl: resolved.finalUrl,
      businessName,
      placeId,
      address,
      reviewUrl: placeId ? writeReviewUrl(placeId) : url.trim(),
    };
  }

  async saveConfig(clientId: string, dto: SaveReviewConfigDto): Promise<GoogleReviewConfig> {
    const reviewLink = blankToNull(dto.reviewLink);
    if (reviewLink && !isGoogleLink(reviewLink)) {
      throw new BadRequestException('The Google review link must be a Google link, e.g. https://share.google/… or https://maps.app.goo.gl/…');
    }

    // A share link carries only the business name; look up its Place ID once
    // at save time (when a Places key exists) rather than on every page view.
    let googlePlaceId = blankToNull(dto.googlePlaceId);
    if (!googlePlaceId && reviewLink) {
      const existing = await this.prisma.googleReviewConfig.findUnique({ where: { clientId } });
      if (existing?.reviewLink !== reviewLink || !existing.googlePlaceId) {
        googlePlaceId = await this.checkReviewLink(reviewLink)
          .then((check) => check.placeId)
          .catch(() => null);
      } else {
        googlePlaceId = existing.googlePlaceId;
      }
    }

    const data = {
      sheetId: dto.sheetId ?? null,
      sheetRange: dto.sheetRange ?? null,
      googlePlaceId,
      reviewLink,
      feedbackWhatsappNumber: dto.feedbackWhatsappNumber ?? null,
      feedbackSheetId: dto.feedbackSheetId ?? null,
      feedbackSheetTab: dto.feedbackSheetTab ?? null,
      seoKeywords: blankToNull(dto.seoKeywords),
      localityHint: blankToNull(dto.localityHint),
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
   * can do that). Grounded in the business's real name and the customer's
   * own words and picked highlights — see review-writer.ts for the rules.
   * Without a Groq key (or when the call fails) the customer still gets a
   * template-polished review rather than an error. Nothing is stored here;
   * the text is recorded only if they take it to Google (`recordHandoff`). */
  async draftCustomerReview(
    slug: string,
    dto: DraftCustomerReviewDto,
  ): Promise<{ draft: string | null; source: 'ai' | 'template' | null }> {
    if (dto.website) {
      // Honeypot tripped — same silent-success convention as every other public form.
      return { draft: null, source: null };
    }

    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true, businessName: true } });
    if (!client) {
      return { draft: null, source: null };
    }

    return this.writeDraft(client.id, client.businessName, dto);
  }

  /**
   * Writes one draft for a client, with their own SEO settings folded in.
   *
   * Shared by the public funnel and the admin preview so a business sees
   * exactly what its customers will be offered — a preview written by
   * different code would be a demo, not a check.
   */
  private async writeDraft(
    clientId: string,
    businessName: string,
    dto: DraftCustomerReviewDto,
  ): Promise<{ draft: string | null; source: 'ai' | 'template' | null }> {
    const [config, landingPage] = await Promise.all([
      this.prisma.googleReviewConfig.findUnique({ where: { clientId } }),
      this.prisma.landingPage.findUnique({ where: { clientId }, select: { contentJson: true } }),
    ]);

    const input = {
      businessName,
      rating: dto.rating,
      notes: dto.notes,
      highlights: dto.highlights,
      variant: dto.variant,
      locality: blankToNull(config?.localityHint) ?? localityFromAddress(landingPage?.contentJson),
      keywords: splitKeywords(config?.seoKeywords),
    };

    const generated = await this.groqService.chatComplete(buildReviewMessages(input), 220, dto.variant ? 0.95 : 0.7);
    const draft = generated ? cleanGeneratedReview(generated) : '';
    if (draft) {
      return { draft, source: 'ai' };
    }

    return { draft: composeReviewWithoutAi(input), source: 'template' };
  }

  /** The same writer the customer gets, run from the dashboard so a business
   * can read a sample before sending the link to anyone. */
  async previewDraft(clientId: string, dto: DraftCustomerReviewDto) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { businessName: true } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return this.writeDraft(clientId, client.businessName, dto);
  }

  /**
   * Everything a business needs to ask for a review: the link, a QR for the
   * counter, and a WhatsApp message with the link already in it.
   *
   * The link points at our own review page rather than straight at Google.
   * That is the whole product: the customer rates first, a poor rating stays
   * private, and a good one gets help writing something worth posting. A raw
   * Google link throws all of that away.
   */
  async getShareKit(clientId: string): Promise<ReviewShareKit> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { slug: true, businessName: true, googleReviewConfig: true },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const landingAppUrl = this.configService.get<string>('LANDING_APP_URL') ?? 'http://localhost:3002';
    const reviewPageUrl = `${landingAppUrl.replace(/\/$/, '')}/site/${client.slug}/review`;
    const message = `Hi! Thanks for visiting ${client.businessName}. Could you take 30 seconds to rate us? We'll even help you write it: ${reviewPageUrl}`;

    let qrDataUrl: string | null = null;
    try {
      qrDataUrl = await QRCode.toDataURL(reviewPageUrl, { width: 512, margin: 1, errorCorrectionLevel: 'M' });
    } catch (error) {
      // A missing QR is a degraded card, not a failed request.
      this.logger.warn(`Review QR generation failed: ${String(error)}`);
    }

    return {
      reviewPageUrl,
      googleUrl: buildGoogleReviewUrl({
        reviewLink: client.googleReviewConfig?.reviewLink,
        googlePlaceId: client.googleReviewConfig?.googlePlaceId,
      }),
      whatsappMessage: message,
      whatsappShareUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
      qrDataUrl,
    };
  }

  async submitFunnelResponse(
    slug: string,
    dto: SubmitFunnelDto,
  ): Promise<{ routedToGoogle: boolean; reviewLink: string | null; responseId: string | null }> {
    if (dto.website) {
      // Honeypot tripped — silent success, no row written.
      return { routedToGoogle: false, reviewLink: null, responseId: null };
    }

    const client = await this.prisma.client.findUnique({
      where: { slug },
      include: { googleReviewConfig: true, user: { select: { email: true } } },
    });
    if (!client) {
      return { routedToGoogle: false, reviewLink: null, responseId: null };
    }

    const routedToGoogle = dto.rating >= 4;
    const feedbackText = routedToGoogle ? null : (dto.feedbackText ?? null);

    const response = await this.prisma.reviewFunnelResponse.create({
      data: { clientId: client.id, ratingGiven: dto.rating, routedToGoogle, feedbackText },
    });

    if (!routedToGoogle) {
      await this.alertOwnerOfLowRating(client.businessName, client.user.email, dto.rating, feedbackText, client.googleReviewConfig?.feedbackWhatsappNumber ?? null);
      await this.logToSheet(client.googleReviewConfig, { rating: dto.rating, text: feedbackText, type: 'Private feedback', customerNotes: null });
    }

    return {
      routedToGoogle,
      // Derived rather than read straight off the config: a client who set a
      // Place ID but never pasted a review URL previously got `null` here, so
      // a happy customer was routed to Google and then sent nowhere.
      reviewLink: buildGoogleReviewUrl({
        reviewLink: client.googleReviewConfig?.reviewLink,
        googlePlaceId: client.googleReviewConfig?.googlePlaceId,
      }),
      responseId: response.id,
    };
  }

  /** A 4-5★ customer tapped "Post on Google". Records the review they took
   * with them against their rating, and appends it to the owner's sheet.
   * Only fills in a response once, so a double tap doesn't double-log. */
  async recordHandoff(slug: string, dto: ReviewHandoffDto): Promise<{ ok: true }> {
    if (dto.website) {
      return { ok: true };
    }

    const client = await this.prisma.client.findUnique({ where: { slug }, include: { googleReviewConfig: true } });
    if (!client) {
      return { ok: true };
    }

    const response = await this.prisma.reviewFunnelResponse.findUnique({ where: { id: dto.responseId } });
    if (response?.clientId !== client.id || !response.routedToGoogle || response.handedOffAt) {
      return { ok: true };
    }

    const reviewText = blankToNull(dto.reviewText);
    const customerNotes = blankToNull(dto.customerNotes);
    const aiDrafted = Boolean(dto.aiDrafted && reviewText);
    await this.prisma.reviewFunnelResponse.update({
      where: { id: response.id },
      data: { reviewText, customerNotes, aiDrafted, handedOffAt: new Date() },
    });

    await this.logToSheet(client.googleReviewConfig, {
      rating: response.ratingGiven,
      text: reviewText,
      type: aiDrafted ? 'Google review (AI-written)' : 'Google review',
      customerNotes,
    });
    return { ok: true };
  }

  /** The owner's view of what customers did in the funnel — newest first. */
  async listFunnelResponses(clientId: string): Promise<ReviewFunnelResponse[]> {
    return this.prisma.reviewFunnelResponse.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Appends one funnel event — private feedback or a review taken to
   * Google — as a new Sheet row so the owner can manage them alongside their
   * other spreadsheets. Best-effort like the WhatsApp alert — a Sheets outage
   * must never block the customer's submission. */
  private async logToSheet(
    config: GoogleReviewConfig | null | undefined,
    row: { rating: number; text: string | null; type: string; customerNotes: string | null },
  ): Promise<void> {
    const sheetId = config?.feedbackSheetId ?? config?.sheetId ?? null;
    const tab = config?.feedbackSheetTab;
    if (!sheetId || !tab || !this.googleSheetsService.isConfigured) {
      return;
    }

    try {
      await this.googleSheetsService.appendFeedbackRow(sheetId, tab, { ...row, submittedAt: new Date() });
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

/** Splits the client's comma-separated services into keywords. */
function splitKeywords(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 1)
    .slice(0, 8);
}

/**
 * The locality to name in a review, taken from the landing page's address
 * when the client hasn't set one: the last two comma-separated parts, minus
 * anything that looks like a PIN code — "12 MG Road, Jayanagar, Bengaluru
 * 560011" becomes "Jayanagar, Bengaluru". A street number in a review reads
 * like an address, an area reads like a person.
 */
function localityFromAddress(contentJson: unknown): string | undefined {
  const content = contentJson as { about?: { address?: string } } | null | undefined;
  const address = content?.about?.address?.trim();
  if (!address) {
    return undefined;
  }

  const parts = address
    .split(',')
    .map((part) => part.replace(/\b\d{6}\b/g, '').trim())
    .filter((part) => part.length > 1 && !/^\d+$/.test(part));

  return parts.slice(-2).join(', ') || undefined;
}
