import { Module } from '@nestjs/common';

import { groqConfigProvider } from './groq-config.provider';
import { GroqService } from './groq.service';

@Module({
  providers: [groqConfigProvider, GroqService],
  exports: [GroqService],
})
export class AiModule {}
