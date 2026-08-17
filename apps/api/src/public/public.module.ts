import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CouponsModule } from '../coupons/coupons.module';
import { DomainsModule } from '../domains/domains.module';
import { LeadsModule } from '../leads/leads.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { MenuModule } from '../menu/menu.module';
import { QrModule } from '../qr/qr.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { TestimonialsModule } from '../testimonials/testimonials.module';
import { TranslationsModule } from '../translations/translations.module';
import { WalletModule } from '../wallet/wallet.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [
    QrModule,
    LeadsModule,
    ReviewsModule,
    AnalyticsModule,
    DomainsModule,
    TranslationsModule,
    TestimonialsModule,
    LoyaltyModule,
    CouponsModule,
    BookingsModule,
    MenuModule,
    WalletModule,
    WhatsappModule,
  ],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
