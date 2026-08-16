import { ConfigService } from '@nestjs/config';

import type { Provider } from '@nestjs/common';

export const SMS_CONFIG = 'SMS_CONFIG';

export interface SmsConfig {
  authKey: string;
  senderId: string;
}

/** Returns null when MSG91 isn't configured — SmsService handles that by
 * logging instead of sending, same "not configured" pattern as every
 * other integration in this codebase (WhatsApp, Sheets, Razorpay). */
export const smsConfigProvider: Provider = {
  provide: SMS_CONFIG,
  useFactory: (configService: ConfigService): SmsConfig | null => {
    const authKey = configService.get<string>('MSG91_AUTH_KEY');
    const senderId = configService.get<string>('MSG91_SENDER_ID');
    if (!authKey || !senderId) {
      return null;
    }
    return { authKey, senderId };
  },
  inject: [ConfigService],
};
