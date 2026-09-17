import 'dotenv/config';

import { DEFAULT_THEME_NAME, DEFAULT_THEME_SCHEMA, SCREEN_THEMES } from '@vyaparqr/types';

import { JsonDbClient } from '../src/jsondb';

import type { Prisma } from '../src/jsondb';

const themeSchemaJson = DEFAULT_THEME_SCHEMA as unknown as Prisma.InputJsonValue;

/**
 * Makes the theme table match `SCREEN_THEMES` exactly.
 *
 * Creates any missing catalog theme, then retires everything else. A page is
 * only served while its theme row exists (see `getLandingPageBySlug`), so
 * every landing page and client pointing at a retired theme is moved onto
 * the default *before* that theme is deleted — never the other way round, or
 * live pages would 404 in between.
 *
 * Safe to run repeatedly: a second run finds nothing to move or delete.
 */
export async function syncThemes(prisma: JsonDbClient) {
  const keep = new Set(SCREEN_THEMES.map((theme) => theme.name));

  for (const theme of SCREEN_THEMES) {
    const existing = await prisma.theme.findFirst({ where: { name: theme.name } });
    if (existing) {
      await prisma.theme.update({
        where: { id: existing.id },
        data: { category: theme.category, schemaJson: themeSchemaJson, isArchived: false },
      });
    } else {
      await prisma.theme.create({
        data: { name: theme.name, category: theme.category, schemaJson: themeSchemaJson, isPremium: false },
      });
    }
  }

  const fallback = await prisma.theme.findFirst({ where: { name: DEFAULT_THEME_NAME } });
  if (!fallback) {
    throw new Error(`Default theme "${DEFAULT_THEME_NAME}" is missing after sync`);
  }

  const retired = (await prisma.theme.findMany({})).filter((theme) => !keep.has(theme.name));
  const retiredIds = retired.map((theme) => theme.id);

  let pagesMoved = 0;
  let clientsMoved = 0;
  if (retiredIds.length > 0) {
    pagesMoved = (
      await prisma.landingPage.updateMany({ where: { themeId: { in: retiredIds } }, data: { themeId: fallback.id } })
    ).count;
    clientsMoved = (
      await prisma.client.updateMany({ where: { themeId: { in: retiredIds } }, data: { themeId: fallback.id } })
    ).count;
    await prisma.theme.deleteMany({ where: { id: { in: retiredIds } } });
  }

  return { kept: [...keep], removed: retired.length, pagesMoved, clientsMoved };
}

if (require.main === module) {
  const prisma = new JsonDbClient();
  syncThemes(prisma)
    .then((result) => {
      console.log(`Storage driver: ${prisma.store.driverName}`);
      console.log(`Themes kept: ${result.kept.join(', ')}`);
      console.log(`Old themes removed: ${String(result.removed)}`);
      console.log(`Landing pages moved to ${DEFAULT_THEME_NAME}: ${String(result.pagesMoved)}`);
      console.log(`Clients moved to ${DEFAULT_THEME_NAME}: ${String(result.clientsMoved)}`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
