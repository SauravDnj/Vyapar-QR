import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

import { toDateKey } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const QR_PIXEL_WIDTH = 512;
const POSTER_QR_SIZE = 320;
const PRINT_SHEET_COLUMNS = 2;
const PRINT_SHEET_QR_SIZE = 180;
const PRINT_SHEET_MARGIN = 40;
const MAX_BULK_CODES = 50;
const SCAN_TREND_DAYS = 30;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export interface QrStyle {
  foregroundColor?: string | null;
  backgroundColor?: string | null;
  logoEnabled?: boolean;
}

export interface SmartRedirectSettings {
  /** Empty string clears it back to a plain landing-page QR. */
  redirectUrl?: string;
  /** ISO date string; empty string clears it. */
  expiresAt?: string;
  /** `0` (or omitted-then-cleared) removes the limit. */
  maxScans?: number;
}

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  private get landingAppUrl(): string {
    return this.configService.get<string>('LANDING_APP_URL') ?? 'http://localhost:3002';
  }

  private get apiPublicUrl(): string {
    return this.configService.get<string>('API_PUBLIC_URL') ?? `http://localhost:${process.env.PORT ?? '4100'}`;
  }

  /** The URL to embed in a QR image — a plain landing-page link, unless a
   * smart redirect is configured, in which case it points at our own
   * `/public/qr/:id/go` handler so a scan can be logged and checked
   * against expiry/scan-limit before sending the visitor on. */
  private buildEncodedUrl(qrId: string, slug: string, redirectUrl: string | null | undefined): string {
    return redirectUrl ? `${this.apiPublicUrl}/public/qr/${qrId}/go` : `${this.landingAppUrl}/site/${slug}?src=qr&qr=${qrId}`;
  }

  getForClient(clientId: string) {
    return this.prisma.qrCode.findFirst({ where: { clientId, type: 'master' } });
  }

  /**
   * P8-01: builds PNG+SVG buffers for a QR code, honoring custom
   * foreground/background colors on both, and splicing the client's own
   * hero logo into the SVG only when `logoEnabled` — center-image PNG
   * compositing needs a native image library (sharp) which this workspace
   * has disabled (see `pnpm-workspace.yaml`'s `allowBuilds`). A logo needs
   * a higher error-correction level so the code stays scannable despite
   * the center obstruction.
   */
  private async buildQrImages(targetUrl: string, style: QrStyle, logoUrl: string | null) {
    const dark = style.foregroundColor && HEX_COLOR_PATTERN.test(style.foregroundColor) ? style.foregroundColor : '#000000';
    const light = style.backgroundColor && HEX_COLOR_PATTERN.test(style.backgroundColor) ? style.backgroundColor : '#ffffff';
    const useLogo = Boolean(style.logoEnabled && logoUrl);
    const errorCorrectionLevel = useLogo ? 'H' : 'M';

    let imageUrl: string | null = null;
    let svgImageUrl: string | null = null;
    try {
      const pngBuffer = await QRCode.toBuffer(targetUrl, { type: 'png', width: QR_PIXEL_WIDTH, color: { dark, light }, errorCorrectionLevel });
      imageUrl = await this.storageService.save(pngBuffer, '.png');

      let svgString = await QRCode.toString(targetUrl, { type: 'svg', width: QR_PIXEL_WIDTH, color: { dark, light }, errorCorrectionLevel });
      if (useLogo && logoUrl) {
        const logoBlock = `<rect x="41%" y="41%" width="18%" height="18%" fill="${light}"/><image href="${logoUrl}" x="42.5%" y="42.5%" width="15%" height="15%" preserveAspectRatio="xMidYMid slice"/>`;
        svgString = svgString.replace('</svg>', `${logoBlock}</svg>`);
      }
      svgImageUrl = await this.storageService.save(Buffer.from(svgString, 'utf8'), '.svg');
    } catch (error) {
      this.logger.error('QR code generation failed', error instanceof Error ? error.stack : undefined);
    }

    return { imageUrl, svgImageUrl };
  }

  private async resolveLogoUrl(clientId: string): Promise<string | null> {
    const landingPage = await this.prisma.landingPage.findUnique({ where: { clientId }, select: { contentJson: true } });
    const content = landingPage?.contentJson as { hero?: { logoUrl?: string } } | undefined;
    return content?.hero?.logoUrl ?? null;
  }

  /** (Re)generates the client's master QR code — PNG and SVG, pointing at
   * their landing page with `?src=qr` so scans are attributable. `style`,
   * when omitted, reuses whatever styling was already saved on the row. */
  async generateForClient(clientId: string, style?: QrStyle) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const existing = await this.getForClient(clientId);
    const resolvedStyle: QrStyle = {
      foregroundColor: style?.foregroundColor !== undefined ? style.foregroundColor : existing?.foregroundColor,
      backgroundColor: style?.backgroundColor !== undefined ? style.backgroundColor : existing?.backgroundColor,
      logoEnabled: style?.logoEnabled ?? existing?.logoEnabled,
    };

    const targetUrl = `${this.landingAppUrl}/site/${client.slug}?src=qr`;
    const logoUrl = resolvedStyle.logoEnabled ? await this.resolveLogoUrl(clientId) : null;
    const { imageUrl, svgImageUrl } = await this.buildQrImages(targetUrl, resolvedStyle, logoUrl);

    const data = {
      targetUrl,
      imageUrl,
      svgImageUrl,
      foregroundColor: resolvedStyle.foregroundColor ?? null,
      backgroundColor: resolvedStyle.backgroundColor ?? null,
      logoEnabled: resolvedStyle.logoEnabled ?? false,
    };

    if (existing) {
      return this.prisma.qrCode.update({ where: { id: existing.id }, data });
    }

    return this.prisma.qrCode.create({ data: { clientId, type: 'master', ...data } });
  }

  /** Renders a print-ready A4 poster (business name, QR, target URL) as a
   * PDF buffer. `pdfkit` writes to a stream; buffered here since NestJS's
   * `StreamableFile` is happy to wrap a `Buffer` directly for the response. */
  async generatePosterPdf(clientId: string): Promise<Buffer> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const qrCode = await this.getForClient(clientId);
    if (!qrCode?.imageUrl) {
      throw new BadRequestException('Generate a QR code before downloading a poster.');
    }

    const qrBuffer = await this.storageService.readByUrl(qrCode.imageUrl);
    if (!qrBuffer) {
      throw new BadRequestException('QR image could not be read from storage.');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);

      doc.fontSize(28).font('Helvetica-Bold').text(client.businessName, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).font('Helvetica').text('Scan to Pay / Review Us', { align: 'center' });
      doc.moveDown(2);

      const x = (doc.page.width - POSTER_QR_SIZE) / 2;
      doc.image(qrBuffer, x, doc.y, { width: POSTER_QR_SIZE, height: POSTER_QR_SIZE });
      doc.y += POSTER_QR_SIZE + 24;

      doc.fontSize(11).fillColor('#666666').text(qrCode.targetUrl, { align: 'center' });

      doc.end();
    });
  }

  /** `qrId`, when present, identifies which specific QR was scanned (a
   * `promo`/location QR, not the master one) — see `ScanTracker`. Scoped to
   * this client so a guessed/foreign id can't increment someone else's QR.
   * P9-02: tags the analytics row with `meta.qrId` so `getScanTrend` can
   * later break scans down per QR code. */
  async recordScan(slug: string, qrId?: string): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (!client) {
      return;
    }

    const qrCode = qrId
      ? await this.prisma.qrCode.findFirst({ where: { id: qrId, clientId: client.id } })
      : await this.getForClient(client.id);

    const metaJson = qrCode ? ({ qrId: qrCode.id } as Prisma.InputJsonValue) : undefined;
    await this.prisma.$transaction([
      ...(qrCode ? [this.prisma.qrCode.update({ where: { id: qrCode.id }, data: { scanCount: { increment: 1 } } })] : []),
      this.prisma.analyticsEvent.create({ data: { clientId: client.id, eventType: 'qr_scan', metaJson } }),
    ]);
  }

  /** P9-01: resolves a `/public/qr/:id/go` hit — validates the code hasn't
   * expired or hit its scan cap, records the scan (tagged the same way
   * `recordScan` tags direct landing-page scans), and returns where to
   * send the visitor. An expired/exhausted code fails open to the plain
   * landing page rather than showing an error — it doesn't record a scan
   * or apply the custom redirect in that case. */
  async resolveRedirect(id: string): Promise<string> {
    const qrCode = await this.prisma.qrCode.findUnique({ where: { id }, include: { client: { select: { slug: true } } } });
    if (!qrCode) {
      throw new NotFoundException('QR code not found');
    }

    const fallbackUrl = `${this.landingAppUrl}/site/${qrCode.client.slug}?src=qr&qr=${qrCode.id}`;
    const expired =
      (qrCode.expiresAt !== null && qrCode.expiresAt < new Date()) ||
      (qrCode.maxScans !== null && qrCode.scanCount >= qrCode.maxScans);
    if (expired) {
      return fallbackUrl;
    }

    await this.prisma.$transaction([
      this.prisma.qrCode.update({ where: { id: qrCode.id }, data: { scanCount: { increment: 1 } } }),
      this.prisma.analyticsEvent.create({
        data: { clientId: qrCode.clientId, eventType: 'qr_scan', metaJson: { qrId: qrCode.id } },
      }),
    ]);

    return qrCode.redirectUrl ?? fallbackUrl;
  }

  /** P9-02: zero-filled daily scan counts for one QR code over the last
   * `SCAN_TREND_DAYS` days — same raw-SQL `JSON_EXTRACT` pattern
   * `AnalyticsService.countWhatsappClicks` already uses for filtering by a
   * `metaJson` field, bucketed with the same `toDateKey` helper
   * `AnalyticsService.getTimeseries` uses. Scans recorded before this
   * feature shipped aren't tagged with `qrId` and won't appear here. */
  async getScanTrend(clientId: string, id: string): Promise<{ date: string; count: number }[]> {
    const qrCode = await this.prisma.qrCode.findFirst({ where: { id, clientId } });
    if (!qrCode) {
      throw new NotFoundException('QR code not found');
    }

    const since = new Date(Date.now() - SCAN_TREND_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.$queryRaw<{ day: Date; total: bigint }[]>(
      Prisma.sql`
        SELECT DATE(created_at) AS day, COUNT(*) AS total
        FROM analytics_events
        WHERE client_id = ${clientId}
          AND event_type = 'qr_scan'
          AND created_at >= ${since}
          AND meta_json->>'qrId' = ${id}
        GROUP BY DATE(created_at)
      `,
    );

    const buckets = new Map<string, number>();
    for (let offset = SCAN_TREND_DAYS - 1; offset >= 0; offset -= 1) {
      buckets.set(toDateKey(new Date(Date.now() - offset * 24 * 60 * 60 * 1000)), 0);
    }
    for (const row of rows) {
      const key = toDateKey(row.day);
      if (buckets.has(key)) {
        buckets.set(key, Number(row.total));
      }
    }
    return [...buckets.entries()].map(([date, count]) => ({ date, count }));
  }

  /** Promo/location QR codes only — the one `master` QR has its own
   * dedicated `GET /qr` endpoint. */
  listForClient(clientId: string) {
    return this.prisma.qrCode.findMany({ where: { clientId, type: 'promo' }, orderBy: { createdAt: 'asc' } });
  }

  /** P5-07: a `promo` QR — e.g. "Table 5" or "10% off flyer" — separate
   * from the client's one `master` QR, pointing at the same landing page
   * but tagged with its own id so scans attribute to it, not the master.
   * P8-01: inherits the client's master QR styling by default so a whole
   * set of codes matches, but can be restyled independently afterward. */
  async createAdditional(clientId: string, label: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const master = await this.getForClient(clientId);
    const style: QrStyle = {
      foregroundColor: master?.foregroundColor,
      backgroundColor: master?.backgroundColor,
      logoEnabled: master?.logoEnabled,
    };

    const created = await this.prisma.qrCode.create({
      data: {
        clientId,
        type: 'promo',
        label,
        targetUrl: '',
        foregroundColor: style.foregroundColor ?? null,
        backgroundColor: style.backgroundColor ?? null,
        logoEnabled: style.logoEnabled ?? false,
      },
    });

    const targetUrl = this.buildEncodedUrl(created.id, client.slug, null);
    const logoUrl = style.logoEnabled ? await this.resolveLogoUrl(clientId) : null;
    const { imageUrl, svgImageUrl } = await this.buildQrImages(targetUrl, style, logoUrl);

    return this.prisma.qrCode.update({
      where: { id: created.id },
      data: { targetUrl, imageUrl, svgImageUrl },
    });
  }

  /** P9-03: creates several labeled promo QR codes in one call (e.g. one
   * per table/location) — same generation path as `createAdditional`, just
   * looped, capped at `MAX_BULK_CODES` to keep a single request bounded. */
  async createBulk(clientId: string, labels: string[]) {
    const trimmed = labels
      .map((label) => label.trim())
      .filter((label) => label.length > 0)
      .slice(0, MAX_BULK_CODES);
    if (trimmed.length === 0) {
      throw new BadRequestException('Provide at least one label.');
    }

    const created: Awaited<ReturnType<typeof this.createAdditional>>[] = [];
    for (const label of trimmed) {
      created.push(await this.createAdditional(clientId, label));
    }
    return created;
  }

  /** P9-01: configures (or clears) a promo QR's smart-redirect behavior —
   * a custom destination, an expiry date, and/or a scan cap. Regenerates
   * the QR image since the encoded URL itself changes between a plain
   * landing-page link and our own `/public/qr/:id/go` handler. */
  async setRedirectSettings(clientId: string, id: string, settings: SmartRedirectSettings) {
    const [qrCode, client] = await Promise.all([
      this.prisma.qrCode.findFirst({ where: { id, clientId, type: 'promo' } }),
      this.prisma.client.findUnique({ where: { id: clientId }, select: { slug: true } }),
    ]);
    if (!qrCode || !client) {
      throw new NotFoundException('QR code not found');
    }

    let redirectUrl = qrCode.redirectUrl;
    if (settings.redirectUrl !== undefined) {
      const trimmed = settings.redirectUrl.trim();
      if (trimmed === '') {
        redirectUrl = null;
      } else if (!/^https?:\/\//i.test(trimmed)) {
        throw new BadRequestException('Redirect URL must start with http:// or https://');
      } else {
        redirectUrl = trimmed;
      }
    }

    let expiresAt = qrCode.expiresAt;
    if (settings.expiresAt !== undefined) {
      if (settings.expiresAt.trim() === '') {
        expiresAt = null;
      } else {
        const parsed = new Date(settings.expiresAt);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException('Invalid expiry date.');
        }
        expiresAt = parsed;
      }
    }

    const maxScans = settings.maxScans !== undefined ? (settings.maxScans > 0 ? settings.maxScans : null) : qrCode.maxScans;

    const targetUrl = this.buildEncodedUrl(qrCode.id, client.slug, redirectUrl);
    const style: QrStyle = { foregroundColor: qrCode.foregroundColor, backgroundColor: qrCode.backgroundColor, logoEnabled: qrCode.logoEnabled };
    const logoUrl = style.logoEnabled ? await this.resolveLogoUrl(clientId) : null;
    const { imageUrl, svgImageUrl } = await this.buildQrImages(targetUrl, style, logoUrl);

    return this.prisma.qrCode.update({
      where: { id: qrCode.id },
      data: { redirectUrl, expiresAt, maxScans, targetUrl, imageUrl, svgImageUrl },
    });
  }

  /** P9-03: a single printable A4 sheet with every promo QR code (label +
   * image) laid out in a grid, for batch printing instead of downloading
   * each code one by one. */
  async generatePrintSheet(clientId: string): Promise<Buffer> {
    const qrCodes = await this.listForClient(clientId);
    if (qrCodes.length === 0) {
      throw new BadRequestException('Create at least one promo QR code first.');
    }

    const items: { label: string; buffer: Buffer }[] = [];
    for (const qr of qrCodes) {
      if (!qr.imageUrl) continue;
      const buffer = await this.storageService.readByUrl(qr.imageUrl);
      if (buffer) {
        items.push({ label: qr.label ?? 'QR code', buffer });
      }
    }
    if (items.length === 0) {
      throw new BadRequestException('No QR code images available to print.');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: PRINT_SHEET_MARGIN });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);

      const cellWidth = (doc.page.width - PRINT_SHEET_MARGIN * 2) / PRINT_SHEET_COLUMNS;
      const cellHeight = PRINT_SHEET_QR_SIZE + 50;
      const rowsPerPage = Math.floor((doc.page.height - PRINT_SHEET_MARGIN * 2) / cellHeight);
      const perPage = PRINT_SHEET_COLUMNS * rowsPerPage;

      items.forEach((item, index) => {
        const posOnPage = index % perPage;
        if (index > 0 && posOnPage === 0) {
          doc.addPage();
        }
        const col = posOnPage % PRINT_SHEET_COLUMNS;
        const row = Math.floor(posOnPage / PRINT_SHEET_COLUMNS);
        const x = PRINT_SHEET_MARGIN + col * cellWidth;
        const y = PRINT_SHEET_MARGIN + row * cellHeight;

        doc.image(item.buffer, x + (cellWidth - PRINT_SHEET_QR_SIZE) / 2, y, { width: PRINT_SHEET_QR_SIZE, height: PRINT_SHEET_QR_SIZE });
        doc.fontSize(11).font('Helvetica-Bold').text(item.label, x, y + PRINT_SHEET_QR_SIZE + 6, { width: cellWidth, align: 'center' });
      });

      doc.end();
    });
  }

  /** P8-01: restyle an existing promo QR independently of the master. */
  async restyleAdditional(clientId: string, id: string, style: QrStyle) {
    const qrCode = await this.prisma.qrCode.findFirst({ where: { id, clientId, type: 'promo' } });
    if (!qrCode) {
      throw new NotFoundException('QR code not found');
    }

    const resolvedStyle: QrStyle = {
      foregroundColor: style.foregroundColor !== undefined ? style.foregroundColor : qrCode.foregroundColor,
      backgroundColor: style.backgroundColor !== undefined ? style.backgroundColor : qrCode.backgroundColor,
      logoEnabled: style.logoEnabled ?? qrCode.logoEnabled,
    };
    const logoUrl = resolvedStyle.logoEnabled ? await this.resolveLogoUrl(clientId) : null;
    const { imageUrl, svgImageUrl } = await this.buildQrImages(qrCode.targetUrl, resolvedStyle, logoUrl);

    return this.prisma.qrCode.update({
      where: { id: qrCode.id },
      data: {
        imageUrl,
        svgImageUrl,
        foregroundColor: resolvedStyle.foregroundColor ?? null,
        backgroundColor: resolvedStyle.backgroundColor ?? null,
        logoEnabled: resolvedStyle.logoEnabled ?? false,
      },
    });
  }

  async deleteAdditional(clientId: string, id: string) {
    const qrCode = await this.prisma.qrCode.findFirst({ where: { id, clientId, type: 'promo' } });
    if (!qrCode) {
      throw new NotFoundException('QR code not found');
    }
    await this.prisma.qrCode.delete({ where: { id: qrCode.id } });
  }
}
