import { Module } from '@nestjs/common';

import { appleWalletConfigProvider } from './apple-wallet.provider';
import { googleWalletConfigProvider } from './google-wallet.provider';
import { WalletService } from './wallet.service';

@Module({
  providers: [appleWalletConfigProvider, googleWalletConfigProvider, WalletService],
  exports: [WalletService],
})
export class WalletModule {}
