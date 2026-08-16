import { ConfigService } from '@nestjs/config';

import type { Provider } from '@nestjs/common';

export const GOOGLE_WALLET_CONFIG = 'GOOGLE_WALLET_CONFIG';

export interface GoogleWalletConfig {
  issuerId: string;
  serviceAccountEmail: string;
  privateKey: string;
}

/** Deliberately separate service-account env vars from
 * `GOOGLE_SERVICE_ACCOUNT_*` (used by Sheets sync) even if the same GCP
 * project issues both — the Wallet API needs the
 * `wallet_object.issuer` scope granted to this specific account, which is
 * a distinct grant from Sheets access. Returns null when unconfigured,
 * same pattern as every other integration provider in this codebase. */
export const googleWalletConfigProvider: Provider = {
  provide: GOOGLE_WALLET_CONFIG,
  useFactory: (configService: ConfigService): GoogleWalletConfig | null => {
    const issuerId = configService.get<string>('GOOGLE_WALLET_ISSUER_ID');
    const serviceAccountEmail = configService.get<string>('GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL');
    const privateKey = configService.get<string>('GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY');
    if (!issuerId || !serviceAccountEmail || !privateKey) {
      return null;
    }
    return { issuerId, serviceAccountEmail, privateKey: privateKey.replace(/\\n/g, '\n') };
  },
  inject: [ConfigService],
};
