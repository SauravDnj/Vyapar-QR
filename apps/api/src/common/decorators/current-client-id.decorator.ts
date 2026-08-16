import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { Request } from 'express';

export const CurrentClientId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { clientId: string }>();
  return request.clientId;
});
