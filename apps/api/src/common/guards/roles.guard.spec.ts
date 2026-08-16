import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import type { ExecutionContext } from '@nestjs/common';

function createContext(user: JwtPayload | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(requiredRoles: string[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows the request through when the route has no @Roles() decorator', () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });

  it('allows a user whose role is in the required list', () => {
    const guard = makeGuard(['client_admin', 'client_staff']);
    const context = createContext({ sub: 'u1', email: 'a@b.com', role: 'client_admin' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies a user whose role is not in the required list', () => {
    const guard = makeGuard(['super_admin']);
    const context = createContext({ sub: 'u1', email: 'a@b.com', role: 'client_admin' });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies when there is no authenticated user at all', () => {
    const guard = makeGuard(['client_admin']);
    expect(guard.canActivate(createContext(undefined))).toBe(false);
  });
});
