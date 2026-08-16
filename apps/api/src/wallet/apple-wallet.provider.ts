import { ConfigService } from '@nestjs/config';

import type { Provider } from '@nestjs/common';

export const APPLE_WALLET_CONFIG = 'APPLE_WALLET_CONFIG';

export interface AppleWalletConfig {
  teamIdentifier: string;
  passTypeIdentifier: string;
  wwdr: string;
  signerCert: string;
  signerKey: string;
  signerKeyPassphrase?: string;
}

/** Returns null when any required Apple Developer credential is missing —
 * WalletService handles that by returning null/404 rather than throwing,
 * same "not configured" pattern as every other integration provider in
 * this codebase. Needs a paid Apple Developer Program membership plus a
 * Pass Type ID certificate + the WWDR intermediate certificate, none of
 * which have a free/sandboxed equivalent — genuinely blocked without the
 * real credentials, tracked in docs/PROGRESS.md. */
export const appleWalletConfigProvider: Provider = {
  provide: APPLE_WALLET_CONFIG,
  useFactory: (configService: ConfigService): AppleWalletConfig | null => {
    const teamIdentifier = configService.get<string>('APPLE_TEAM_ID');
    const passTypeIdentifier = configService.get<string>('APPLE_PASS_TYPE_ID');
    const wwdr = configService.get<string>('APPLE_WWDR_CERT');
    const signerCert = configService.get<string>('APPLE_SIGNING_CERT');
    const signerKey = configService.get<string>('APPLE_SIGNING_KEY');
    const signerKeyPassphrase = configService.get<string>('APPLE_CERT_PASSWORD');
    if (!teamIdentifier || !passTypeIdentifier || !wwdr || !signerCert || !signerKey) {
      return null;
    }
    return {
      teamIdentifier,
      passTypeIdentifier,
      wwdr: wwdr.replace(/\\n/g, '\n'),
      signerCert: signerCert.replace(/\\n/g, '\n'),
      signerKey: signerKey.replace(/\\n/g, '\n'),
      signerKeyPassphrase,
    };
  },
  inject: [ConfigService],
};
