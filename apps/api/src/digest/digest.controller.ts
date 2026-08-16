import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { DigestService } from './digest.service';

@Controller('digest')
@Roles('client_admin')
@UseGuards(ClientScopeGuard)
export class DigestController {
  constructor(private readonly digestService: DigestService) {}

  /** Lets a client trigger their own digest on demand — both to see what
   * it looks like and as a real, testable path in an environment where the
   * weekly cron itself can't be observed firing. */
  @Post('send-test')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendTest(@CurrentClientId() clientId: string) {
    await this.digestService.sendForClient(clientId);
  }
}
