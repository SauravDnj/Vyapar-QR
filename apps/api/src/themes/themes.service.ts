import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_THEME_SCHEMA, SCREEN_THEMES } from '@vyaparqr/types';

import { PrismaService } from '../prisma/prisma.service';

import type { Prisma } from '../jsondb';

const CATALOG_ORDER = new Map(SCREEN_THEMES.map((theme, index) => [theme.name, index]));

/**
 * Keeps only the themes the renderer actually has a design for, in catalog
 * order (the default first).
 *
 * A theme row can outlive its design: the retired 121-theme catalog is still
 * in databases that haven't had `db:sync-themes` run against them, and a
 * Super Admin can create a row for a name no component matches. Such a theme
 * renders as the default anyway, so offering it would let someone pick a name
 * that doesn't describe what their page looks like. Filtering here means the
 * picker is right even before the rows are deleted.
 */
function inCatalogOrder<T extends { name: string }>(themes: T[]): T[] {
  const seen = new Set<string>();
  return themes
    .filter((theme) => {
      if (!CATALOG_ORDER.has(theme.name) || seen.has(theme.name)) {
        return false;
      }
      seen.add(theme.name);
      return true;
    })
    .sort((a, b) => (CATALOG_ORDER.get(a.name) ?? 0) - (CATALOG_ORDER.get(b.name) ?? 0));
}

export interface CreateThemeInput {
  name: string;
  category: string;
  previewImageUrl?: string;
  isPremium: boolean;
}

export interface UpdateThemeInput {
  name?: string;
  category?: string;
  previewImageUrl?: string;
  isPremium?: boolean;
  isArchived?: boolean;
}

@Injectable()
export class ThemesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public/client-facing listing — archived themes never appear here, only
   * in the Super Admin catalog (see `listForAdmin`). */
  async list(category?: string) {
    const read = () =>
      this.prisma.theme.findMany({
        where: { isArchived: false, ...(category ? { category } : {}) },
        orderBy: { name: 'asc' },
      });

    let themes = inCatalogOrder(await read());
    if (themes.length === 0 && !category) {
      await this.ensureCatalog();
      themes = inCatalogOrder(await read());
    }
    return themes;
  }

  async listForAdmin() {
    const read = () => this.prisma.theme.findMany({ orderBy: [{ isArchived: 'asc' }, { name: 'asc' }] });

    let themes = inCatalogOrder(await read());
    if (themes.length === 0) {
      await this.ensureCatalog();
      themes = inCatalogOrder(await read());
    }
    return themes;
  }

  /**
   * Creates any catalog theme the database is missing.
   *
   * A deploy ships a new catalog to a database that still holds the old one,
   * and the listings above hide every row the renderer has no design for — so
   * between the deploy and someone running `db:sync-themes`, the picker would
   * be empty and nobody could finish onboarding. This fills that gap on the
   * first listing that comes back empty.
   *
   * It only ever creates. Deleting the retired rows stays a deliberate,
   * operator-run step (`db:sync-themes`), because that also moves live pages
   * between themes. Duplicates from two instances racing here are harmless:
   * the listings de-duplicate by name, and the sync collapses them.
   */
  private async ensureCatalog() {
    for (const theme of SCREEN_THEMES) {
      const existing = await this.prisma.theme.findFirst({ where: { name: theme.name } });
      if (existing) {
        continue;
      }
      await this.prisma.theme.create({
        data: {
          name: theme.name,
          category: theme.category,
          schemaJson: DEFAULT_THEME_SCHEMA as unknown as Prisma.InputJsonValue,
          isPremium: false,
        },
      });
    }
  }

  async findOneOrThrow(id: string) {
    const theme = await this.prisma.theme.findUnique({ where: { id } });
    if (!theme) {
      throw new NotFoundException('Theme not found');
    }
    return theme;
  }

  create(input: CreateThemeInput) {
    return this.prisma.theme.create({
      data: {
        name: input.name,
        category: input.category,
        previewImageUrl: input.previewImageUrl,
        isPremium: input.isPremium,
        schemaJson: DEFAULT_THEME_SCHEMA as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, input: UpdateThemeInput) {
    await this.findOneOrThrow(id);
    return this.prisma.theme.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        previewImageUrl: input.previewImageUrl,
        isPremium: input.isPremium,
        isArchived: input.isArchived,
      },
    });
  }
}
