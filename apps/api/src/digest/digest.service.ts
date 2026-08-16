import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GroqService } from '../ai/groq.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

const DIGEST_WINDOW_DAYS = 7;

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly groqService: GroqService,
    private readonly whatsappService: WhatsappService,
  ) {}

  /** Runs for every published client — used by both the weekly scheduled
   * sweep and the manual "Send me a test digest" button, so both paths are
   * exercised by the same code and stay in sync. */
  async sendForClient(clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { user: { select: { email: true } }, whatsappSettings: true },
    });
    if (!client) {
      return;
    }

    const since = new Date(Date.now() - DIGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [summary, newLeads, newTestimonials] = await Promise.all([
      this.analyticsService.getSummary(clientId),
      this.prisma.lead.count({ where: { clientId, createdAt: { gte: since } } }),
      this.prisma.testimonial.count({ where: { clientId, createdAt: { gte: since } } }),
    ]);

    const aiSummary = await this.draftAiSummary(client.businessName, summary.pageViews, summary.qrScans, newLeads, newTestimonials);

    const adminAppUrl = this.configService.get<string>('ADMIN_APP_URL') ?? 'http://localhost:3001';
    const dashboardUrl = `${adminAppUrl}/dashboard`;
    await this.emailService.sendWeeklyDigest(client.user.email, client.businessName, {
      pageViews: summary.pageViews,
      qrScans: summary.qrScans,
      newLeads,
      newTestimonials,
      dashboardUrl,
      aiSummary,
    });

    if (client.whatsappSettings?.isEnabled) {
      const ownerPhone = await this.getOwnerWhatsappNumber(clientId);
      if (ownerPhone) {
        const whatsappMessage =
          aiSummary ??
          `Your week on QRHub: ${String(summary.pageViews)} page views, ${String(summary.qrScans)} QR scans, ${String(newLeads)} new leads, ${String(newTestimonials)} new testimonials. ${dashboardUrl}`;
        await this.whatsappService.sendAndRecord(clientId, ownerPhone, whatsappMessage);
      }
    }
  }

  /** Reuses whichever number the client already gave for low-rating
   * alerts (P11-01) as the "send digests to the owner" number too, rather
   * than adding yet another phone-number field for the same person. */
  private async getOwnerWhatsappNumber(clientId: string): Promise<string | null> {
    const config = await this.prisma.googleReviewConfig.findUnique({
      where: { clientId },
      select: { feedbackWhatsappNumber: true },
    });
    return config?.feedbackWhatsappNumber ?? null;
  }

  /** P13-06: null (falls back to numbers-only) when Groq isn't
   * configured or the summary comes back empty. */
  private async draftAiSummary(
    businessName: string,
    pageViews: number,
    qrScans: number,
    newLeads: number,
    newTestimonials: number,
  ): Promise<string | null> {
    return this.groqService.chatComplete(
      [
        {
          role: 'system',
          content: "You write one short, encouraging sentence summarizing a small business's weekly stats in plain English. No markdown, no bullet points.",
        },
        {
          role: 'user',
          content: `${businessName} this week: ${String(pageViews)} page views, ${String(qrScans)} QR scans, ${String(newLeads)} new leads, ${String(newTestimonials)} new testimonials.`,
        },
      ],
      100,
      0.6,
    );
  }

  /** Every client with a published page — a client mid-onboarding with no
   * live page yet has nothing worth digesting. */
  async sendToAllPublishedClients(): Promise<{ sent: number }> {
    const clients = await this.prisma.client.findMany({
      where: { status: 'active', landingPage: { status: 'published' } },
      select: { id: true },
    });

    let sent = 0;
    for (const client of clients) {
      try {
        await this.sendForClient(client.id);
        sent += 1;
      } catch (error) {
        this.logger.error(`Weekly digest failed for client ${client.id}`, error instanceof Error ? error.stack : undefined);
      }
    }
    return { sent };
  }
}
