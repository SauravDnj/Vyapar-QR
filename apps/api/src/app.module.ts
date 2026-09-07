import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AdminModule } from './admin/admin.module';
import { AgencyModule } from './agency/agency.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { BookingsModule } from './bookings/bookings.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CouponsModule } from './coupons/coupons.module';
import { DigestModule } from './digest/digest.module';
import { DomainsModule } from './domains/domains.module';
import { bullRootImports, createThrottlerStorage } from './jobs/jobs.config';
import { JobsModule } from './jobs/jobs.module';
import { LeadsModule } from './leads/leads.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { MenuModule } from './menu/menu.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicModule } from './public/public.module';
import { QrModule } from './qr/qr.module';
import { ReviewsModule } from './reviews/reviews.module';
import { StorageModule } from './storage/storage.module';
import { TestimonialsModule } from './testimonials/testimonials.module';
import { ThemesModule } from './themes/themes.module';
import { TranslationsModule } from './translations/translations.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
      // Redis-backed where a REDIS_URL exists, in-memory otherwise (Vercel).
      storage: createThrottlerStorage(),
    }),
    // Empty when Redis is absent — the recurring sweeps then run via Vercel
    // Cron against JobsModule's HTTP endpoints instead of a BullMQ scheduler.
    ...bullRootImports(),
    PrismaModule,
    AuditLogModule,
    AuthModule,
    AdminModule,
    BillingModule,
    StorageModule,
    ThemesModule,
    QrModule,
    OnboardingModule,
    LeadsModule,
    ReviewsModule,
    AnalyticsModule,
    DomainsModule,
    TranslationsModule,
    WebhooksModule,
    TestimonialsModule,
    LoyaltyModule,
    CouponsModule,
    BookingsModule,
    MenuModule,
    OrdersModule,
    NotificationsModule,
    DigestModule,
    WhatsappModule,
    PublicModule,
    AgencyModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Order matters: JwtAuthGuard must populate request.user before RolesGuard reads it.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
