import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/** The signals a scan actually carries. Everything here is optional. */
export interface ScanSignals {
  userAgent?: string;
  referrer?: string;
  /** Edge geo headers, city-level. Absent when running outside Vercel. */
  city?: string;
  region?: string;
  country?: string;
  /** Which QR code was scanned, when the scan came through `/qr/:id/go`. */
  qrId?: string;
}

export const VISITOR_COOKIE = 'qrhub_vid';
/** Two years — long enough that a returning regular is recognised. */
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 730;

/**
 * Turns QR scans into CRM records.
 *
 * A scan gives no personal data — no name, phone or email — so this does not
 * pretend to identify anyone. It records what a scan genuinely carries (when,
 * which code, device class, referrer, city-level location) against an
 * anonymous cookie id, so repeat scans from one phone collapse into a single
 * visitor rather than a pile of duplicate rows.
 *
 * The payoff comes later: `attachLead` links that visitor to a `Lead` the
 * moment they identify themselves — contact form, payment claim, WhatsApp
 * message — at which point the business can see the whole visit history behind
 * a name, including how many times they scanned before getting in touch.
 */
@Injectable()
export class VisitorsService {
  private readonly logger = new Logger(VisitorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Coarse device classification. Deliberately not fingerprinting. */
  private static parseUserAgent(userAgent?: string): {
    device: string | null;
    os: string | null;
    browser: string | null;
  } {
    if (!userAgent) return { device: null, os: null, browser: null };
    const ua = userAgent.toLowerCase();

    const os = ua.includes('android')
      ? 'Android'
      : /iphone|ipad|ipod/.test(ua)
        ? 'iOS'
        : ua.includes('windows')
          ? 'Windows'
          : ua.includes('mac os')
            ? 'macOS'
            : ua.includes('linux')
              ? 'Linux'
              : null;

    const browser = ua.includes('edg/')
      ? 'Edge'
      : ua.includes('chrome') && !ua.includes('chromium')
        ? 'Chrome'
        : ua.includes('firefox')
          ? 'Firefox'
          : ua.includes('safari') && !ua.includes('chrome')
            ? 'Safari'
            : null;

    const device = /mobile|android|iphone|ipod/.test(ua)
      ? 'Mobile'
      : /ipad|tablet/.test(ua)
        ? 'Tablet'
        : 'Desktop';

    return { device, os, browser };
  }

  /**
   * Records a scan against a visitor, creating one on first sight.
   *
   * Returns the cookie value to set, so a device that arrives without one
   * gets recognised next time. Never throws: a analytics-shaped failure must
   * not stop a customer reaching the page they scanned.
   */
  async recordScan(
    clientId: string,
    visitorKey: string | undefined,
    signals: ScanSignals,
  ): Promise<string> {
    const key = visitorKey ?? randomUUID();

    try {
      const { device, os, browser } = VisitorsService.parseUserAgent(signals.userAgent);
      const existing = await this.prisma.visitor.findFirst({
        where: { clientId, visitorKey: key },
      });

      if (existing) {
        await this.prisma.visitor.update({
          where: { id: existing.id },
          data: {
            scanCount: { increment: 1 },
            // Refresh the situational fields — someone can scan the counter QR
            // today and the poster QR tomorrow, from a different place.
            lastQrId: signals.qrId ?? existing.lastQrId,
            city: signals.city ?? existing.city,
            region: signals.region ?? existing.region,
            country: signals.country ?? existing.country,
            referrer: signals.referrer ?? existing.referrer,
          },
        });
      } else {
        await this.prisma.visitor.create({
          data: {
            clientId,
            visitorKey: key,
            device,
            os,
            browser,
            referrer: signals.referrer ?? null,
            city: signals.city ?? null,
            region: signals.region ?? null,
            country: signals.country ?? null,
            lastQrId: signals.qrId ?? null,
          },
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to record visitor for client ${clientId}: ${String(error)}`);
    }

    return key;
  }

  /**
   * Links a visitor to the lead they just became.
   *
   * Called whenever someone identifies themselves. Best-effort by design — a
   * contact form must still succeed if the visitor cookie was blocked or the
   * scan was never recorded.
   */
  async attachLead(
    clientId: string,
    visitorKey: string | undefined,
    leadId: string,
  ): Promise<void> {
    if (!visitorKey) return;
    try {
      const visitor = await this.prisma.visitor.findFirst({
        where: { clientId, visitorKey },
      });
      if (visitor && !visitor.leadId) {
        await this.prisma.visitor.update({ where: { id: visitor.id }, data: { leadId } });
      }
    } catch (error) {
      this.logger.warn(`Failed to attach lead ${leadId} to a visitor: ${String(error)}`);
    }
  }

  /** CRM listing: visitors newest-active first, with their lead when known. */
  async list(
    clientId: string,
    query: { page?: number; pageSize?: number; identifiedOnly?: boolean },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where = {
      clientId,
      ...(query.identifiedOnly ? { leadId: { not: null } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.visitor.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { lead: true },
      }),
      this.prisma.visitor.count({ where }),
    ]);

    return {
      data: rows.map((visitor) => ({
        id: visitor.id,
        scanCount: visitor.scanCount,
        firstSeenAt: visitor.firstSeenAt,
        lastSeenAt: visitor.lastSeenAt,
        device: visitor.device,
        os: visitor.os,
        browser: visitor.browser,
        referrer: visitor.referrer,
        location: [visitor.city, visitor.region, visitor.country].filter(Boolean).join(', ') || null,
        lastQrId: visitor.lastQrId,
        lead: visitor.lead
          ? { id: visitor.lead.id, name: visitor.lead.name, phone: visitor.lead.phone, status: visitor.lead.status }
          : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Headline numbers for the CRM screen. */
  async stats(clientId: string) {
    const [totalVisitors, identified, scans] = await Promise.all([
      this.prisma.visitor.count({ where: { clientId } }),
      this.prisma.visitor.count({ where: { clientId, leadId: { not: null } } }),
      this.prisma.visitor.findMany({ where: { clientId }, select: { scanCount: true } }),
    ]);

    const totalScans = scans.reduce((sum, v) => sum + v.scanCount, 0);
    const returning = scans.filter((v) => v.scanCount > 1).length;

    return {
      totalVisitors,
      totalScans,
      returningVisitors: returning,
      identified,
      /** Share of scanners who went on to identify themselves. */
      conversionRate: totalVisitors > 0 ? Math.round((identified / totalVisitors) * 100) : 0,
    };
  }
}
