import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type { Prisma } from '../../jsondb';


const REVENUE_MONTHS = 6;

export interface RevenueMonth {
  month: string;
  revenue: number;
}

export interface BillingReport {
  mrr: number;
  activeClients: number;
  suspendedClients: number;
  /** Subscriptions that ended (user-cancelled or lapsed), distinct from
   * `suspendedClients` (suspended for non-payment by the grace-period sweep). */
  churnedSubscriptions: number;
  revenueByMonth: RevenueMonth[];
}

interface RevenueRow {
  month: string;
  total: Prisma.Decimal   | string | null;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBillingReport(): Promise<BillingReport> {
    const [activeSubscriptions, activeClients, suspendedClients, churnedSubscriptions, revenueByMonth] =
      await Promise.all([
        this.prisma.subscription.findMany({
          where: { status: 'active' },
          select: { plan: { select: { price: true, billingCycle: true } } },
        }),
        this.prisma.client.count({ where: { status: 'active' } }),
        this.prisma.client.count({ where: { status: 'suspended' } }),
        this.prisma.subscription.count({ where: { status: { in: ['cancelled', 'expired'] } } }),
        this.getRevenueByMonth(),
      ]);

    const mrr = activeSubscriptions.reduce((sum, subscription) => {
      const price = subscription.plan.price;
      return sum + (subscription.plan.billingCycle === 'yearly' ? price / 12 : price);
    }, 0);

    return {
      mrr: Math.round(mrr * 100) / 100,
      activeClients,
      suspendedClients,
      churnedSubscriptions,
      revenueByMonth,
    };
  }

  private async getRevenueByMonth(): Promise<RevenueMonth[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - (REVENUE_MONTHS - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const invoices = await this.prisma.invoice.findMany({
      where: { status: 'paid', issuedAt: { gte: since } },
      select: { issuedAt: true, amount: true },
    });

    // Replaces `GROUP BY DATE_FORMAT(issued_at, '%Y-%m')`.
    const monthlyTotals = new Map<string, number>();
    for (const invoice of invoices) {
      const issued = new Date(invoice.issuedAt);
      const month = `${String(issued.getFullYear())}-${String(issued.getMonth() + 1).padStart(2, '0')}`;
      monthlyTotals.set(month, (monthlyTotals.get(month) ?? 0) + invoice.amount);
    }
    const rows: RevenueRow[] = [...monthlyTotals]
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const buckets = new Map<string, number>();
    for (let offset = REVENUE_MONTHS - 1; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - offset);
      const key = `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, 0);
    }
    for (const row of rows) {
      if (buckets.has(row.month)) {
        buckets.set(row.month, Number(row.total ?? 0));
      }
    }

    return [...buckets.entries()].map(([month, revenue]) => ({ month, revenue }));
  }
}
