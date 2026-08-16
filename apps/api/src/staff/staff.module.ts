import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { EmailModule } from '../email/email.module';

import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [JwtModule.register({}), EmailModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
