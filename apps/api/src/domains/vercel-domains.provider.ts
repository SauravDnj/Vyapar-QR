import { ConfigService } from '@nestjs/config';

import type { Provider } from '@nestjs/common';

export const VERCEL_DOMAINS_CONFIG = 'VERCEL_DOMAINS_CONFIG';

export interface VercelDomainsConfig {
  token: string;
  projectId: string;
  teamId?: string;
}

/** Returns null when Vercel isn't configured — `DomainsService` handles
 * that by skipping SSL/domain registration rather than crashing, same
 * "not configured -> log and skip" pattern as `razorpayProvider` and
 * `GOOGLE_SHEETS_CLIENT`. `apps/landing` is deployed on Vercel (see
 * docs/DEPLOYMENT.md), so — unlike a self-hosted Nginx target — SSL for a
 * client's custom domain isn't provisioned via certbot; it's provisioned
 * by Vercel automatically once the domain is registered on the project
 * via this API and the client's DNS points at Vercel. */
export const vercelDomainsProvider: Provider = {
  provide: VERCEL_DOMAINS_CONFIG,
  useFactory: (configService: ConfigService): VercelDomainsConfig | null => {
    const token = configService.get<string>('VERCEL_API_TOKEN');
    const projectId = configService.get<string>('VERCEL_LANDING_PROJECT_ID');
    if (!token || !projectId) {
      return null;
    }
    const teamId = configService.get<string>('VERCEL_TEAM_ID');
    return { token, projectId, teamId: teamId === '' ? undefined : teamId };
  },
  inject: [ConfigService],
};
