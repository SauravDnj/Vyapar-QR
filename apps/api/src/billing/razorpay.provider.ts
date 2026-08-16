import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';

import type { Provider } from '@nestjs/common';

export const RAZORPAY_CLIENT = 'RAZORPAY_CLIENT';

/** Returns null when Razorpay isn't configured — billing endpoints handle
 * that by returning a clear "not configured" error rather than crashing. */
export const razorpayProvider: Provider = {
  provide: RAZORPAY_CLIENT,
  useFactory: (configService: ConfigService): Razorpay | null => {
    const keyId = configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = configService.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      return null;
    }
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  },
  inject: [ConfigService],
};
