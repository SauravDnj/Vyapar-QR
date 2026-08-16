import { Inject, Injectable, Logger } from '@nestjs/common';

import { SMS_CONFIG, type SmsConfig } from './sms-config.provider';

/** MSG91's simple transactional "sendhttp" endpoint — no pre-created
 * template needed, unlike their newer flow-based v5 API, which fits this
 * use case (arbitrary owner-alert text) better than requiring the client
 * to set up a template in the MSG91 dashboard first. */
const MSG91_SEND_URL = 'https://api.msg91.com/api/sendhttp.php';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(@Inject(SMS_CONFIG) private readonly config: SmsConfig | null) {}

  get isConfigured(): boolean {
    return this.config !== null;
  }

  /** Never throws — an SMS-alert failure must never break the caller's
   * primary flow (order placement, feedback submission), same contract as
   * `WhatsappService.sendText`. */
  async sendText(to: string, message: string): Promise<boolean> {
    if (!this.config) {
      this.logger.warn(`SMS not configured — message not sent. To: ${to}`);
      return false;
    }

    const digitsOnly = to.replace(/\D/g, '');
    const params = new URLSearchParams({
      authkey: this.config.authKey,
      mobiles: digitsOnly,
      message,
      sender: this.config.senderId,
      route: '4',
      country: '91',
    });

    try {
      const response = await fetch(`${MSG91_SEND_URL}?${params.toString()}`);
      if (!response.ok) {
        this.logger.warn(`MSG91 send failed with status ${String(response.status)} for ${to}`);
        return false;
      }
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`MSG91 send threw for ${to}: ${errorMessage}`);
      return false;
    }
  }
}
