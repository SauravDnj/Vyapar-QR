import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

const WINDOW_DAYS = 14;
const PER_SOURCE_LIMIT = 20;
const TOTAL_LIMIT = 30;
const LOW_RATING_THRESHOLD = 3;

export interface NotificationItem {
  id: string;
  type: 'lead' | 'testimonial' | 'low_rating_feedback' | 'whatsapp_needs_human' | 'order' | 'payment_claimed';
  message: string;
  createdAt: string;
  link: string;
}

/** `metaJson` values are unconstrained JSON; only primitives are meaningful
 * here, and anything else would stringify to '[object Object]'. */
function asText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

interface PaymentClaimRow {
  id: string;
  amount: string | null;
  method: string | null;
  created_at: Date;
}

/** A derived, read-only activity feed — deliberately not a stateful
 * "notifications" table with read/unread tracking (that's a bigger feature
 * than was asked for). Just surfaces recent rows from tables that already
 * exist, merged and sorted by recency. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecent(clientId: string): Promise<NotificationItem[]> {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [leads, testimonials, feedback, whatsappHandoffs, orders, paymentClaims] = await Promise.all([
      this.prisma.lead.findMany({ where: { clientId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: PER_SOURCE_LIMIT }),
      this.prisma.testimonial.findMany({
        where: { clientId, createdAt: { gte: since }, isApproved: false },
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
      }),
      this.prisma.reviewFunnelResponse.findMany({
        where: { clientId, createdAt: { gte: since }, ratingGiven: { lte: LOW_RATING_THRESHOLD } },
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
      }),
      this.prisma.whatsappMessage.findMany({
        where: { clientId, createdAt: { gte: since }, direction: 'inbound', needsHuman: true },
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
      }),
      this.prisma.order.findMany({
        where: { clientId, createdAt: { gte: since }, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: PER_SOURCE_LIMIT,
      }),
      // Payment claims live in `metaJson`, which SQL reached with
      // JSON_EXTRACT. Narrow on the indexed columns, then unpack in memory
      // and apply the per-source limit afterwards.
      this.prisma.analyticsEvent
        .findMany({
          where: { clientId, eventType: 'button_click', createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, metaJson: true, createdAt: true },
        })
        .then((events) =>
          events
            .flatMap((event) => {
              const meta = event.metaJson as Record<string, unknown> | null;
              if (meta?.label !== 'payment_claimed') return [];
              return [
                {
                  id: event.id,
                  amount: asText(meta.amount),
                  method: asText(meta.method),
                  created_at: event.createdAt,
                } satisfies PaymentClaimRow,
              ];
            })
            .slice(0, PER_SOURCE_LIMIT),
        ),
    ]);

    const items: NotificationItem[] = [
      ...leads.map((lead) => ({
        id: `lead-${lead.id}`,
        type: 'lead' as const,
        message: `New lead: ${lead.name}`,
        createdAt: lead.createdAt.toISOString(),
        link: '/dashboard/leads',
      })),
      ...testimonials.map((testimonial) => ({
        id: `testimonial-${testimonial.id}`,
        type: 'testimonial' as const,
        message: `New testimonial from ${testimonial.authorName} awaiting approval`,
        createdAt: testimonial.createdAt.toISOString(),
        link: '/dashboard/testimonials',
      })),
      ...feedback.map((response) => ({
        id: `feedback-${response.id}`,
        type: 'low_rating_feedback' as const,
        message: `Low rating received (${String(response.ratingGiven)}★)`,
        createdAt: response.createdAt.toISOString(),
        link: '/dashboard/reviews',
      })),
      ...whatsappHandoffs.map((message) => ({
        id: `whatsapp-${message.id}`,
        type: 'whatsapp_needs_human' as const,
        message: `WhatsApp: a customer needs a human reply (+${message.phone})`,
        createdAt: message.createdAt.toISOString(),
        link: '/dashboard/whatsapp',
      })),
      ...orders.map((order) => ({
        id: `order-${order.id}`,
        type: 'order' as const,
        message: `New order from ${order.customerName} (₹${order.totalAmount.toString()})`,
        createdAt: order.createdAt.toISOString(),
        link: '/dashboard/orders',
      })),
      ...paymentClaims.map((claim) => ({
        id: `payment-claim-${claim.id}`,
        type: 'payment_claimed' as const,
        message: `Customer marked ₹${claim.amount ?? '?'} as paid${claim.method ? ` via ${claim.method}` : ''} (self-reported, not verified)`,
        createdAt: claim.created_at.toISOString(),
        link: '/dashboard/analytics',
      })),
    ];

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, TOTAL_LIMIT);
  }
}
