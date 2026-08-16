import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { QrModule } from '../qr/qr.module';

import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [QrModule, AiModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
