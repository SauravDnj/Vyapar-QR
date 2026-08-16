import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EMAIL_TRANSPORT } from './email-transport.provider';
import {
  clientApprovedEmail,
  invoiceReceiptEmail,
  lowRatingFeedbackEmail,
  newLeadEmail,
  newOrderEmail,
  passwordResetEmail,
  staffInviteEmail,
  weeklyDigestEmail,
} from './templates';

import type { NewOrderEmailItem, WeeklyDigestStats } from './templates';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_TRANSPORT) private readonly transport: Transporter | null,
    private readonly configService: ConfigService,
  ) {}

  get isConfigured(): boolean {
    return this.transport !== null;
  }

  async sendClientApproved(to: string, businessName: string, dashboardUrl: string): Promise<void> {
    const { subject, html } = clientApprovedEmail(businessName, dashboardUrl);
    await this.dispatch(to, subject, html);
  }

  async sendInvoiceReceipt(to: string, businessName: string, amount: string, invoiceId: string): Promise<void> {
    const { subject, html } = invoiceReceiptEmail(businessName, amount, invoiceId);
    await this.dispatch(to, subject, html);
  }

  async sendNewLead(to: string, businessName: string, leadName: string, leadPhone: string, notes: string | null, leadsUrl: string): Promise<void> {
    const { subject, html } = newLeadEmail(businessName, leadName, leadPhone, notes, leadsUrl);
    await this.dispatch(to, subject, html);
  }

  async sendLowRatingFeedback(to: string, businessName: string, rating: number, feedbackText: string | null, reviewsUrl: string): Promise<void> {
    const { subject, html } = lowRatingFeedbackEmail(businessName, rating, feedbackText, reviewsUrl);
    await this.dispatch(to, subject, html);
  }

  async sendNewOrder(to: string, businessName: string, orderId: string, items: NewOrderEmailItem[], totalAmount: string, ordersUrl: string): Promise<void> {
    const { subject, html } = newOrderEmail(businessName, orderId, items, totalAmount, ordersUrl);
    await this.dispatch(to, subject, html);
  }

  async sendWeeklyDigest(to: string, businessName: string, stats: WeeklyDigestStats): Promise<void> {
    const { subject, html } = weeklyDigestEmail(businessName, stats);
    await this.dispatch(to, subject, html);
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    const { subject, html } = passwordResetEmail(resetUrl);
    await this.dispatch(to, subject, html, `reset link: ${resetUrl}`);
  }

  async sendStaffInvite(to: string, businessName: string, inviteUrl: string): Promise<void> {
    const { subject, html } = staffInviteEmail(businessName, inviteUrl);
    await this.dispatch(to, subject, html, `invite link: ${inviteUrl}`);
  }

  private async dispatch(to: string, subject: string, html: string, devDetail?: string): Promise<void> {
    if (!this.transport) {
      this.logger.warn(`SMTP not configured — email not sent. To: ${to}, Subject: "${subject}"${devDetail ? ` (${devDetail})` : ''}`);
      return;
    }

    await this.transport.sendMail({
      from: this.configService.get<string>('SMTP_FROM') ?? 'QRHub <no-reply@qrhub.local>',
      to,
      subject,
      html,
    });
  }
}
