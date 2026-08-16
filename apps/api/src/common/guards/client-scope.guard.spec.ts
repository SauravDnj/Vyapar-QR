import { PrismaService } from '../../prisma/prisma.service';

import { ClientScopeGuard } from './client-scope.guard';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import type { ExecutionContext } from '@nestjs/common';

function createContext(user: JwtPayload | undefined) {
  const request: { user?: JwtPayload; clientId?: string } = { user };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('ClientScopeGuard', () => {
  function makeGuard(clientFindUniqueResult: unknown, staffFindFirstResult: unknown = null) {
    const prisma = {
      client: { findUnique: jest.fn().mockResolvedValue(clientFindUniqueResult) },
      clientStaffMember: { findFirst: jest.fn().mockResolvedValue(staffFindFirstResult) },
    };
    const guard = new ClientScopeGuard(prisma as unknown as PrismaService);
    return { guard, prisma };
  }

  it('denies a super_admin (client access only)', async () => {
    const { guard } = makeGuard(null);
    const { context } = createContext({ sub: 'u1', email: 'a@b.com', role: 'super_admin' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 });
  });

  it('denies an unauthenticated request', async () => {
    const { guard } = makeGuard(null);
    const { context } = createContext(undefined);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 });
  });

  it('denies a client_admin with no Client row of their own', async () => {
    const { guard } = makeGuard(null);
    const { context } = createContext({ sub: 'u1', email: 'a@b.com', role: 'client_admin' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 });
  });

  it('allows a client_admin and attaches their own client_id server-side, never trusting request input', async () => {
    const { guard, prisma } = makeGuard({ id: 'client-1' });
    const { context, request } = createContext({ sub: 'u1', email: 'a@b.com', role: 'client_admin' });

    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(request.clientId).toBe('client-1');
    expect(prisma.client.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
  });

  it('denies client_staff with no active ClientStaffMember row (P4-01)', async () => {
    const { guard } = makeGuard(null, null);
    const { context } = createContext({ sub: 'u2', email: 'staff@b.com', role: 'client_staff' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 });
  });

  it('allows client_staff via an active ClientStaffMember row, never touching the Client table (P4-01)', async () => {
    const { guard, prisma } = makeGuard(null, { clientId: 'client-2' });
    const { context, request } = createContext({ sub: 'u2', email: 'staff@b.com', role: 'client_staff' });

    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(request.clientId).toBe('client-2');
    expect(prisma.clientStaffMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u2', status: 'active' } }),
    );
    expect(prisma.client.findUnique).not.toHaveBeenCalled();
  });
});
