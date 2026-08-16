import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { EmailModule } from '../email/email.module';
import { ThemesModule } from '../themes/themes.module';

import { AgenciesController } from './agencies/agencies.controller';
import { AgenciesService } from './agencies/agencies.service';
import { AdminAnalyticsController } from './analytics/admin-analytics.controller';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AuditLogController } from './audit-log/audit-log.controller';
import { ClientsController } from './clients/clients.controller';
import { ClientsService } from './clients/clients.service';
import { ImpersonateController } from './impersonate/impersonate.controller';
import { ImpersonateService } from './impersonate/impersonate.service';
import { PlansController } from './plans/plans.controller';
import { PlansService } from './plans/plans.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { SettingsController } from './settings/settings.controller';
import { SettingsService } from './settings/settings.service';
import { AdminThemesController } from './themes/admin-themes.controller';

@Module({
  imports: [JwtModule.register({}), EmailModule, ThemesModule],
  controllers: [
    ClientsController,
    PlansController,
    SettingsController,
    ImpersonateController,
    ReportsController,
    AdminAnalyticsController,
    AuditLogController,
    AdminThemesController,
    AgenciesController,
  ],
  providers: [ClientsService, PlansService, SettingsService, ImpersonateService, ReportsService, AdminAnalyticsService, AgenciesService],
})
export class AdminModule {}
