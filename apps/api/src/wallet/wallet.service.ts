import { createSign } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { PKPass } from 'passkit-generator';

import { APPLE_WALLET_CONFIG, type AppleWalletConfig } from './apple-wallet.provider';
import { GOOGLE_WALLET_CONFIG, type GoogleWalletConfig } from './google-wallet.provider';

/** 1×1 transparent PNG — a placeholder for the icon/logo images Apple's
 * pass format requires to be present in the bundle. A real deployment
 * would generate these from the client's own uploaded logo; swapping that
 * in is a follow-up, not a blocker for this pass working structurally. */
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

interface LoyaltyPassData {
  cardId: string;
  businessName: string;
  stampCount: number;
  stampsRequired: number;
  rewardText: string;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @Inject(APPLE_WALLET_CONFIG) private readonly appleConfig: AppleWalletConfig | null,
    @Inject(GOOGLE_WALLET_CONFIG) private readonly googleConfig: GoogleWalletConfig | null,
  ) {}

  get isAppleConfigured(): boolean {
    return this.appleConfig !== null;
  }

  get isGoogleConfigured(): boolean {
    return this.googleConfig !== null;
  }

  generateApplePass(data: LoyaltyPassData): Buffer | null {
    if (!this.appleConfig) {
      return null;
    }

    const passJson = {
      formatVersion: 1,
      serialNumber: data.cardId,
      passTypeIdentifier: this.appleConfig.passTypeIdentifier,
      teamIdentifier: this.appleConfig.teamIdentifier,
      organizationName: data.businessName,
      description: `${data.businessName} loyalty card`,
      storeCard: {
        primaryFields: [{ key: 'stamps', label: 'Stamps', value: `${String(data.stampCount)} / ${String(data.stampsRequired)}` }],
        secondaryFields: [{ key: 'reward', label: 'Reward', value: data.rewardText }],
      },
      barcodes: [{ message: data.cardId, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1' }],
    };

    try {
      const pass = new PKPass(
        {
          'pass.json': Buffer.from(JSON.stringify(passJson)),
          'icon.png': PLACEHOLDER_PNG,
          'logo.png': PLACEHOLDER_PNG,
        },
        {
          wwdr: this.appleConfig.wwdr,
          signerCert: this.appleConfig.signerCert,
          signerKey: this.appleConfig.signerKey,
          signerKeyPassphrase: this.appleConfig.signerKeyPassphrase,
        },
      );
      return pass.getAsBuffer();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to build Apple Wallet pass for card ${data.cardId}: ${message}`);
      return null;
    }
  }

  /** Builds a "Save to Google Wallet" link — a signed JWT carrying the
   * generic-pass object inline, which Google Wallet accepts without a
   * separate class/object pre-registration call for a simple loyalty
   * card like this. */
  generateGoogleWalletLink(data: LoyaltyPassData): string | null {
    if (!this.googleConfig) {
      return null;
    }

    const objectId = `${this.googleConfig.issuerId}.${data.cardId}`;
    const genericObject = {
      id: objectId,
      classId: `${this.googleConfig.issuerId}.loyalty_card`,
      genericType: 'GENERIC_TYPE_UNSPECIFIED',
      cardTitle: { defaultValue: { language: 'en', value: data.businessName } },
      header: { defaultValue: { language: 'en', value: 'Loyalty card' } },
      textModulesData: [
        { header: 'Stamps', body: `${String(data.stampCount)} / ${String(data.stampsRequired)}` },
        { header: 'Reward', body: data.rewardText },
      ],
      barcode: { type: 'QR_CODE', value: data.cardId },
    };

    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: this.googleConfig.serviceAccountEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      payload: { genericObjects: [genericObject] },
    };

    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
    const signature = createSign('RSA-SHA256').update(signingInput).sign(this.googleConfig.privateKey);
    const jwt = `${signingInput}.${base64Url(signature)}`;

    return `https://pay.google.com/gp/v/save/${jwt}`;
  }
}
