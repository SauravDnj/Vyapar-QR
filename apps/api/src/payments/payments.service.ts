import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

import type { PaymentClaim, PaymentClaimStatus, PaymentMethodType } from '../jsondb';
import type { ClaimPaymentDto } from '../public/dto/claim-payment.dto';

/** Reads inside a sentence: "marked ₹200 as paid via <label>". */
const APP_IN_SENTENCE: Record<PaymentMethodType, string> = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  other: 'a UPI app',
};

/** Reads as a spreadsheet cell, where "a UPI app" would look like a typo. */
const APP_LABEL: Record<PaymentMethodType, string> = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  other: 'Any UPI app',
};

const CSV_COLUMNS = ['date', 'time', 'amount', 'method', 'status', 'customerName', 'customerPhone', 'note'] as const;

export interface PaymentSummary {
  /** Claims only — the owner has confirmed the money for `confirmedCount`. */
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  allTimeTotal: number;
  claimCount: number;
  confirmedCount: number;
  cancelledCount: number;
  /** Totals per app, so a business sees which one customers actually use. */
  byMethod: { method: PaymentMethodType; count: number; total: number }[];
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function amountOf(claim: PaymentClaim): number {
  return claim.amount ?? 0;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly webhooksService: WebhooksService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Records what a customer says they paid.
   *
   * Nothing here is verified — there is no gateway behind a UPI deep link, so
   * the money lands in the business's own app and only they can confirm it.
   * The row is stored as `claimed` and every owner-facing message says so.
   */
  async claim(
    slug: string,
    dto: ClaimPaymentDto,
  ): Promise<{ claimId: string | null; notified: boolean; whatsappUrl: string | null }> {
    if (dto.website) {
      // Honeypot tripped — same silent-success convention as every other public form.
      return { claimId: null, notified: false, whatsappUrl: null };
    }

    const client = await this.prisma.client.findUnique({
      where: { slug },
      include: { googleReviewConfig: true },
    });
    if (!client) {
      return { claimId: null, notified: false, whatsappUrl: null };
    }

    const method = (dto.method ?? 'other') as PaymentMethodType;
    const phone = dto.phone?.trim() ?? '';
    const name = dto.name?.trim() ?? '';

    // A number turns an anonymous payment into a customer the business can
    // actually follow up with, so it goes into the CRM as a lead — but it is
    // asked for after paying and is always optional.
    let leadId: string | null = null;
    if (phone) {
      const existing = await this.prisma.lead.findFirst({ where: { clientId: client.id, phone } });
      if (existing) {
        leadId = existing.id;
      } else {
        const lead = await this.prisma.lead.create({
          data: {
            clientId: client.id,
            name: name || 'Paying customer',
            phone,
            source: 'payment_claim',
          },
        });
        leadId = lead.id;
      }
    }

    const claim = await this.prisma.paymentClaim.create({
      data: {
        clientId: client.id,
        amount: dto.amount ?? null,
        method,
        customerName: name || null,
        customerPhone: phone || null,
        leadId,
      },
    });

    await this.prisma.analyticsEvent.create({
      data: {
        clientId: client.id,
        eventType: 'button_click',
        metaJson: { label: 'payment_claimed', amount: dto.amount ?? null, method },
      },
    });

    await this.webhooksService.dispatch(client.id, 'payment.claimed', {
      id: claim.id,
      amount: dto.amount ?? null,
      method,
      customerPhone: phone || null,
      createdAt: claim.createdAt.toISOString(),
    });

    const whatsappNumber = client.googleReviewConfig?.feedbackWhatsappNumber ?? null;
    if (!whatsappNumber) {
      return { claimId: claim.id, notified: false, whatsappUrl: null };
    }

    const amountText = dto.amount ? `₹${dto.amount.toFixed(2)}` : 'an unstated amount';
    const from = phone ? ` from ${name || 'a customer'} (${phone})` : '';
    const message = `${client.businessName}: a customer marked ${amountText} as PAID via ${APP_IN_SENTENCE[method]}${from}. This is self-reported, not a verified receipt — check your UPI app before treating it as confirmed.`;
    const result = await this.whatsappService.resolveSend(client.id, whatsappNumber, message);

    return { claimId: claim.id, notified: result.sent, whatsappUrl: result.url };
  }

  /** The customer's own undo, straight after claiming — no auth, so it is
   * limited to cancelling a claim that is still `claimed`. */
  async cancelOwnClaim(slug: string, claimId: string): Promise<{ ok: boolean }> {
    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (!client) {
      return { ok: false };
    }
    const claim = await this.prisma.paymentClaim.findFirst({
      where: { id: claimId, clientId: client.id, status: 'claimed' },
    });
    if (!claim) {
      return { ok: false };
    }
    await this.prisma.paymentClaim.update({ where: { id: claim.id }, data: { status: 'cancelled' } });
    return { ok: true };
  }

  /** Optional details the customer adds on the thank-you screen. */
  async attachCustomer(
    slug: string,
    claimId: string,
    input: { name?: string; phone?: string; note?: string },
  ): Promise<{ ok: boolean }> {
    const phone = input.phone?.trim() ?? '';
    const name = input.name?.trim() ?? '';
    const noteText = input.note?.trim() ?? '';
    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (!client) {
      return { ok: false };
    }
    const claim = await this.prisma.paymentClaim.findFirst({ where: { id: claimId, clientId: client.id } });
    if (!claim) {
      return { ok: false };
    }

    let leadId = claim.leadId;
    if (phone && !leadId) {
      const existing = await this.prisma.lead.findFirst({ where: { clientId: client.id, phone } });
      leadId =
        existing?.id ??
        (
          await this.prisma.lead.create({
            data: { clientId: client.id, name: name || 'Paying customer', phone, source: 'payment_claim' },
          })
        ).id;
    }

    await this.prisma.paymentClaim.update({
      where: { id: claim.id },
      data: {
        customerName: name || claim.customerName,
        customerPhone: phone || claim.customerPhone,
        note: noteText === '' ? claim.note : noteText,
        leadId,
      },
    });
    return { ok: true };
  }

  list(clientId: string, status?: PaymentClaimStatus): Promise<PaymentClaim[]> {
    return this.prisma.paymentClaim.findMany({
      where: { clientId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setStatus(clientId: string, claimId: string, status: PaymentClaimStatus): Promise<PaymentClaim> {
    const claim = await this.prisma.paymentClaim.findFirst({ where: { id: claimId, clientId } });
    if (!claim) {
      throw new NotFoundException('Payment not found');
    }
    return this.prisma.paymentClaim.update({
      where: { id: claim.id },
      data: { status, confirmedAt: status === 'confirmed' ? new Date() : null },
    });
  }

  /** Totals for the dashboard. Cancelled claims are excluded everywhere —
   * they are the ones that turned out not to be money. */
  async getSummary(clientId: string): Promise<PaymentSummary> {
    const claims = await this.prisma.paymentClaim.findMany({ where: { clientId } });
    const live = claims.filter((claim) => claim.status !== 'cancelled');

    const now = Date.now();
    const since = (days: number) => now - days * 24 * 60 * 60 * 1000;
    const totalSince = (days: number) =>
      live
        .filter((claim) => claim.createdAt.getTime() >= since(days))
        .reduce((sum, claim) => sum + amountOf(claim), 0);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const byMethod = (['gpay', 'phonepe', 'paytm', 'other'] as PaymentMethodType[])
      .map((method) => {
        const forMethod = live.filter((claim) => claim.method === method);
        return {
          method,
          count: forMethod.length,
          total: forMethod.reduce((sum, claim) => sum + amountOf(claim), 0),
        };
      })
      .filter((row) => row.count > 0);

    return {
      todayTotal: live
        .filter((claim) => claim.createdAt.getTime() >= startOfToday.getTime())
        .reduce((sum, claim) => sum + amountOf(claim), 0),
      weekTotal: totalSince(7),
      monthTotal: totalSince(30),
      allTimeTotal: live.reduce((sum, claim) => sum + amountOf(claim), 0),
      claimCount: claims.filter((claim) => claim.status === 'claimed').length,
      confirmedCount: claims.filter((claim) => claim.status === 'confirmed').length,
      cancelledCount: claims.filter((claim) => claim.status === 'cancelled').length,
      byMethod,
    };
  }

  /**
   * The payments report, as a spreadsheet.
   *
   * Starts with a UTF-8 byte-order mark: without it Excel on Windows opens
   * the file as the system code page, which turns ₹ and any Hindi name into
   * mojibake. Date and time are separate columns so they sort and filter as
   * a spreadsheet expects.
   */
  async exportCsv(clientId: string): Promise<string> {
    const claims = await this.list(clientId);

    const rows = claims.map((claim) => {
      const created = claim.createdAt;
      const values = [
        created.toISOString().slice(0, 10),
        created.toTimeString().slice(0, 5),
        claim.amount === null ? '' : amountOf(claim).toFixed(2),
        APP_LABEL[claim.method],
        claim.status,
        claim.customerName ?? '',
        claim.customerPhone ?? '',
        claim.note ?? '',
      ];
      return values.map((value) => csvEscape(value)).join(',');
    });

    return `\uFEFF${[CSV_COLUMNS.join(','), ...rows].join('\n')}`;
  }

  /** Used by the admin CRM view to show payments against a lead. */
  listForLead(clientId: string, leadId: string): Promise<PaymentClaim[]> {
    return this.prisma.paymentClaim.findMany({
      where: { clientId, leadId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
