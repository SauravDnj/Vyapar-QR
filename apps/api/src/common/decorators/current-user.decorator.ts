import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import type { Request } from 'express';


export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
  const request = ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>();
  return request.user;
});
