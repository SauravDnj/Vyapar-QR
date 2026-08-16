import { resolveTxt } from 'node:dns/promises';

import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { VERCEL_DOMAINS_CONFIG, type VercelDomainsConfig } from './vercel-domains.provider';

export interface VerificationRecord {
  host: string;
  type: 'TXT';
  value: string;
}

export interface DomainStatus {
  customDomain: string | null;
  verified: boolean;
  verificationRecord: VerificationRecord | null;
  /** How to point the domain at the deployment once ownership is verified.
   * Standard Vercel guidance: apex domains use an A record, subdomains use
   * a CNAME — both trigger Vercel's automatic SSL provisioning once the
   * domain is registered on the project (see `registerOnVercel`). */
  dnsTarget: { apexA: string; subdomainCname: string } | null;
}

const VERCEL_APEX_A_RECORD = '76.76.21.21';
const VERCEL_CNAME_TARGET = 'cname.vercel-dns.com';

/** P3-01: lets a client point their own domain at their landing page.
 * Ownership is proven with a DNS TXT record (no email/manual review
 * needed) before the domain is actually used for routing — see
 * `verify()` and `PublicService.resolveCustomDomain`, which the
 * `apps/landing` middleware calls on every request to an unrecognized host.
 *
 * SSL is provisioned by Vercel automatically (not certbot/Nginx — the
 * platform's `apps/landing` deploys to Vercel, per docs/DEPLOYMENT.md),
 * once the domain is both (a) registered on the Vercel project via
 * `registerOnVercel` and (b) actually pointed at Vercel by the client's own
 * DNS. Registration is best-effort and never blocks our own ownership
 * verification — same "not configured -> log and skip" pattern as
 * Razorpay/Sheets/SMTP. */
@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VERCEL_DOMAINS_CONFIG) private readonly vercelConfig: VercelDomainsConfig | null,
  ) {}

  async getStatus(clientId: string): Promise<DomainStatus> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { customDomain: true, customDomainVerifiedAt: true },
    });

    return {
      customDomain: client?.customDomain ?? null,
      verified: client?.customDomainVerifiedAt != null,
      verificationRecord: client?.customDomain ? this.verificationRecordFor(clientId) : null,
      dnsTarget: client?.customDomain ? { apexA: VERCEL_APEX_A_RECORD, subdomainCname: VERCEL_CNAME_TARGET } : null,
    };
  }

  async setDomain(clientId: string, rawDomain: string): Promise<DomainStatus> {
    const domain = rawDomain.trim().toLowerCase();

    try {
      await this.prisma.client.update({
        where: { id: clientId },
        data: { customDomain: domain, customDomainVerifiedAt: null },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That domain is already in use by another account.');
      }
      throw error;
    }

    return this.getStatus(clientId);
  }

  async verify(clientId: string): Promise<{ verified: boolean; message?: string }> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { customDomain: true },
    });
    if (!client?.customDomain) {
      throw new BadRequestException('Set a custom domain before verifying it.');
    }

    const record = this.verificationRecordFor(clientId);
    const lookupHost = `${record.host}.${client.customDomain}`;

    let rows: string[][];
    try {
      rows = await resolveTxt(lookupHost);
    } catch {
      return { verified: false, message: `Couldn't find a TXT record at ${lookupHost} yet — DNS changes can take a while to propagate.` };
    }

    const found = rows.some((row) => row.join('').trim() === record.value);
    if (!found) {
      return { verified: false, message: `Found a TXT record at ${lookupHost}, but the value doesn't match yet.` };
    }

    await this.prisma.client.update({ where: { id: clientId }, data: { customDomainVerifiedAt: new Date() } });
    await this.registerOnVercel(client.customDomain);
    return { verified: true };
  }

  /** Registers the now-ownership-verified domain on the Vercel project so
   * Vercel starts provisioning SSL for it as soon as the client's DNS
   * points at Vercel. Best-effort: failures are logged, not thrown — our
   * own TXT-based ownership check already succeeded and is what actually
   * gates `resolveHostname`, so a Vercel API hiccup shouldn't block that. */
  private async registerOnVercel(domain: string): Promise<void> {
    if (!this.vercelConfig) {
      this.logger.warn(`Vercel API not configured — skipping automatic domain registration for ${domain}. Add it manually in the Vercel dashboard, or set VERCEL_API_TOKEN/VERCEL_LANDING_PROJECT_ID.`);
      return;
    }

    const { token, projectId, teamId } = this.vercelConfig;
    const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    const url = `https://api.vercel.com/v10/projects/${projectId}/domains${query}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: domain }),
      });

      if (response.ok) {
        this.logger.log(`Registered ${domain} on the Vercel project — SSL will provision automatically once DNS points at Vercel.`);
        return;
      }

      const body: unknown = await response.json().catch(() => null);
      const message =
        body && typeof body === 'object' && 'error' in body
          ? JSON.stringify((body).error)
          : response.statusText;
      // Vercel returns 409 if the domain is already registered on this
      // project (e.g. a retry after a transient failure) — not a real error.
      if (response.status === 409) {
        this.logger.log(`${domain} is already registered on the Vercel project.`);
        return;
      }
      this.logger.warn(`Vercel domain registration for ${domain} failed (${String(response.status)}): ${message}`);
    } catch (error) {
      this.logger.warn(`Vercel domain registration for ${domain} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Resolves a visiting hostname to a client slug — called by
   * `apps/landing`'s middleware on every request to a host it doesn't
   * recognize as the platform's own. Only verified, active clients route. */
  async resolveHostname(hostname: string): Promise<{ slug: string }> {
    const client = await this.prisma.client.findFirst({
      where: { customDomain: hostname.toLowerCase(), customDomainVerifiedAt: { not: null }, status: 'active' },
      select: { slug: true },
    });
    if (!client) {
      throw new NotFoundException('Domain not mapped');
    }
    return client;
  }

  private verificationRecordFor(clientId: string): VerificationRecord {
    return { host: '_qrhub-verify', type: 'TXT', value: `qrhub-verify=${clientId}` };
  }
}
