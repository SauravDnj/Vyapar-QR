import { SCREEN_THEMES } from '@vyaparqr/types';

import { ThemesService } from './themes.service';

import type { PrismaService } from '../prisma/prisma.service';

/**
 * A theme row can outlive its design — the retired 121-theme catalog is still
 * in any database that hasn't had `db:sync-themes` run against it. Those rows
 * must not be offered, or a client picks a name whose design no longer exists.
 */
describe('ThemesService listings', () => {
  const rows = [
    { id: '1', name: 'Ember', category: 'Restaurant', isArchived: false },
    { id: '2', name: 'Ivory', category: 'Classic', isArchived: false },
    { id: '3', name: 'Minimal', category: 'General', isArchived: false },
    { id: '4', name: 'Zevar', category: 'Jewellery', isArchived: false },
  ];

  const prisma = { theme: { findMany: jest.fn().mockResolvedValue(rows) } } as unknown as PrismaService;
  const service = new ThemesService(prisma);

  it('offers only themes the renderer has a design for', async () => {
    expect((await service.list()).map((theme) => theme.name)).toEqual(['Zevar']);
  });

  it('hides retired themes from the Super Admin catalog too', async () => {
    const names = (await service.listForAdmin()).map((theme) => theme.name);
    expect(names).not.toContain('Ember');
    expect(names).not.toContain('Minimal');
    expect(names).not.toContain('Ivory');
  });

  it('lists the default theme first', async () => {
    expect((await service.list())[0]?.name).toBe(SCREEN_THEMES[0]?.name);
  });
});
