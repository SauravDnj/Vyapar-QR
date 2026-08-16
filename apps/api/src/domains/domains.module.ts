import { Module } from '@nestjs/common';

import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { vercelDomainsProvider } from './vercel-domains.provider';

@Module({
  controllers: [DomainsController],
  providers: [DomainsService, vercelDomainsProvider],
  exports: [DomainsService],
})
export class DomainsModule {}
