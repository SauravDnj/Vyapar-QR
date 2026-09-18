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

  it('shows a catalog theme once even if it was created twice', async () => {
    const withDuplicate = {
      theme: { findMany: jest.fn().mockResolvedValue([...rows, { id: '5', name: 'Zevar', isArchived: false }]) },
    } as unknown as PrismaService;

    expect((await new ThemesService(withDuplicate).list()).map((theme) => theme.name)).toEqual(['Zevar']);
  });

  /** Between a deploy and someone running `db:sync-themes`, the database holds
   * only retired themes — every one of which is filtered out. Without this the
   * picker is empty and nobody can finish onboarding. */
  it('creates the catalog when the database has only retired themes', async () => {
    const retiredOnly = [{ id: '1', name: 'Minimal', category: 'General', isArchived: false }];
    const created: { name: string }[] = [];
    const stale = {
      theme: {
        findMany: jest
          .fn()
          .mockImplementationOnce(() => Promise.resolve(retiredOnly))
          .mockImplementation(() => Promise.resolve([...retiredOnly, ...created])),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: { data: { name: string } }) => {
          created.push(data);
          return Promise.resolve(data);
        }),
      },
    } as unknown as PrismaService;

    const names = (await new ThemesService(stale).list()).map((theme) => theme.name);
    expect(names).toEqual(SCREEN_THEMES.map((theme) => theme.name));
    expect(created.map((theme) => theme.name)).toEqual(SCREEN_THEMES.map((theme) => theme.name));
  });

  it('never deletes the retired rows itself — that stays an operator step', async () => {
    const remove = jest.fn();
    const stale = {
      theme: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        delete: remove,
        deleteMany: remove,
      },
    } as unknown as PrismaService;

    await new ThemesService(stale).list();
    expect(remove).not.toHaveBeenCalled();
  });
});
