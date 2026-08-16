import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { Request } from 'express';

export const CurrentAgencyId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { agencyId: string }>();
  return request.agencyId;
});
