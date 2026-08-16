import { BadRequestException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import Razorpay from 'razorpay';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';

import { RAZORPAY_CLIENT } from './razorpay.provider';

import type { RazorpayWebhookPayload } from './types/webhook-payload.interface';

const MONTHLY_TOTAL_COUNT = 120; // ~10 years of monthly cycles
const YEARLY_TOTAL_COUNT = 20; // ~20 years of yearly cycles

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    @Inject(RAZORPAY_CLIENT) private readonly razorpay: Razorpay | null,
    private readonly webhooksService: WebhooksService,
  ) {}

  listActivePlans() {
    return this.prisma.plan.findMany({
      where: { isArchived: false },
      orderBy: { price: 'asc' },
      select: {
        id: true,
        name: true,
        price: true,
        billingCycle: true,
        maxThemes: true,
        customDomainAllowed: true,
        isArchived: true,
      },
    });
  }

  async checkout(clientId: string, planId: string) {
    if (!this.razorpay) {
      throw new BadRequestException('Billing is not configured on this deployment yet.');
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || plan.isArchived) {
      throw new NotFoundException('Plan not found');
    }
    if (!plan.razorpayPlanId) {
      throw new BadRequestException('This plan is not linked to a Razorpay plan yet.');
    }

    const razorpaySubscription = await this.razorpay.subscriptions.create({
      plan_id: plan.razorpayPlanId,
      total_count: plan.billingCycle === 'yearly' ? YEARLY_TOTAL_COUNT : MONTHLY_TOTAL_COUNT,
      customer_notify: true,
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        clientId,
        planId,
        status: 'pending',
        gatewaySubscriptionId: razorpaySubscription.id,
      },
    });

    return {
      subscriptionId: subscription.id,
      razorpaySubscriptionId: razorpaySubscription.id,
      razorpayKeyId: this.configService.get<string>('RAZORPAY_KEY_ID'),
      checkoutUrl: razorpaySubscription.short_url,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!this.razorpay || !webhookSecret) {
      throw new BadRequestException('Billing is not configured on this deployment yet.');
    }
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const isValid = Razorpay.validateWebhookSignature(rawBody.toString(), signature, webhookSecret);
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString()) as RazorpayWebhookPayload;
    this.logger.log(`Razorpay webhook received: ${event.event}`);

    switch (event.event) {
      case 'subscription.activated':
        await this.onSubscriptionActivated(event);
        break;
      case 'subscription.charged':
        await this.onSubscriptionCharged(event);
        break;
      case 'subscription.cancelled':
        await this.onSubscriptionCancelled(event);
        break;
      case 'payment.failed':
        await this.onPaymentFailed(event);
        break;
      default:
        this.logger.debug(`Unhandled webhook event: ${event.event}`);
    }
  }

  async listInvoices(clientId: string) {
    return this.prisma.invoice.findMany({ where: { clientId }, orderBy: { issuedAt: 'desc' } });
  }

  /** Renders a simple receipt-style PDF for one invoice. `pdfkit` writes to a
   * stream; buffered here the same way `QrService.generatePosterPdf` does,
   * since NestJS's `StreamableFile` is happy to wrap a `Buffer` directly. */
  async generateInvoicePdf(clientId: string, invoiceId: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, clientId },
      include: { client: true, subscription: { include: { plan: true } } },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);

      doc.fontSize(22).font('Helvetica-Bold').text('Invoice');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica').fillColor('#666666').text(`Invoice ID: ${invoice.id}`);
      doc.text(`Issued: ${invoice.issuedAt.toLocaleDateString()}`);
      doc.text(`Status: ${invoice.status}`);
      doc.moveDown(1);

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text('Billed to');
      doc.fontSize(11).font('Helvetica').fillColor('#666666').text(invoice.client.businessName);
      doc.moveDown(1);

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text('Plan');
      doc.fontSize(11).font('Helvetica').fillColor('#666666').text(invoice.subscription.plan.name);
      doc.moveDown(1);

      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text(`Amount: Rs. ${invoice.amount.toString()}`);

      doc.end();
    });
  }

  async getCurrentSubscription(clientId: string) {
    return this.prisma.subscription.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
  }

  /** Daily sweep: suspend clients whose subscription has been past due for
   * longer than the grace period. */
  async suspendOverdueClients(gracePeriodDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - gracePeriodDays * 24 * 60 * 60 * 1000);

    const overdue = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['past_due', 'pending'] },
        currentPeriodEnd: { lt: cutoff },
      },
      select: { clientId: true },
    });

    if (overdue.length === 0) {
      return 0;
    }

    const clientIds = [...new Set(overdue.map((s) => s.clientId))];
    const result = await this.prisma.client.updateMany({
      where: { id: { in: clientIds }, status: { not: 'suspended' } },
      data: { status: 'suspended' },
    });

    this.logger.warn(`Suspended ${String(result.count)} client(s) for non-payment past the grace period`);
    return result.count;
  }

  private async findSubscriptionByGatewayId(gatewaySubscriptionId: string) {
    return this.prisma.subscription.findFirst({ where: { gatewaySubscriptionId } });
  }

  private async onSubscriptionActivated(event: RazorpayWebhookPayload): Promise<void> {
    const entity = event.payload.subscription?.entity;
    if (!entity) return;

    const subscription = await this.findSubscriptionByGatewayId(entity.id);
    if (!subscription) return;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'active',
        currentPeriodEnd: entity.current_end ? new Date(entity.current_end * 1000) : undefined,
      },
    });
    await this.prisma.client.update({ where: { id: subscription.clientId }, data: { status: 'active' } });
    await this.webhooksService.dispatch(subscription.clientId, 'subscription.updated', {
      subscriptionId: subscription.id,
      status: 'active',
    });
  }

  private async onSubscriptionCharged(event: RazorpayWebhookPayload): Promise<void> {
    const subEntity = event.payload.subscription?.entity;
    const paymentEntity = event.payload.payment?.entity;
    if (!subEntity || !paymentEntity) return;

    const subscription = await this.findSubscriptionByGatewayId(subEntity.id);
    if (!subscription) return;

    const existingInvoice = await this.prisma.invoice.findFirst({ where: { gatewayRef: paymentEntity.id } });
    if (!existingInvoice) {
      const amount = paymentEntity.amount / 100;
      const invoice = await this.prisma.invoice.create({
        data: {
          clientId: subscription.clientId,
          subscriptionId: subscription.id,
          amount,
          status: 'paid',
          gatewayRef: paymentEntity.id,
        },
      });

      const client = await this.prisma.client.findUnique({ where: { id: subscription.clientId }, include: { user: true } });
      if (client) {
        await this.emailService.sendInvoiceReceipt(client.user.email, client.businessName, amount.toFixed(2), invoice.id);
      }
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'active',
        currentPeriodEnd: subEntity.current_end ? new Date(subEntity.current_end * 1000) : undefined,
      },
    });
    await this.prisma.client.update({ where: { id: subscription.clientId }, data: { status: 'active' } });
    await this.webhooksService.dispatch(subscription.clientId, 'subscription.updated', {
      subscriptionId: subscription.id,
      status: 'active',
    });
  }

  private async onSubscriptionCancelled(event: RazorpayWebhookPayload): Promise<void> {
    const entity = event.payload.subscription?.entity;
    if (!entity) return;

    const subscription = await this.findSubscriptionByGatewayId(entity.id);
    if (!subscription) return;

    await this.prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'cancelled' } });
    await this.webhooksService.dispatch(subscription.clientId, 'subscription.updated', {
      subscriptionId: subscription.id,
      status: 'cancelled',
    });
  }

  private async onPaymentFailed(event: RazorpayWebhookPayload): Promise<void> {
    const paymentEntity = event.payload.payment?.entity;
    if (!paymentEntity) return;

    const existingInvoice = await this.prisma.invoice.findFirst({ where: { gatewayRef: paymentEntity.id } });
    if (existingInvoice) return;

    // Razorpay's payment.failed payload doesn't include the subscription id
    // directly for all payment methods, so this is best-effort: log for
    // manual reconciliation rather than guessing which subscription it belongs to.
    this.logger.error(`Payment failed: ${paymentEntity.id} — amount ${String(paymentEntity.amount / 100)}`);
  }
}
