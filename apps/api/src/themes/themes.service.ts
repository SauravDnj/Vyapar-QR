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
  return themes
    .filter((theme) => CATALOG_ORDER.has(theme.name))
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
    const themes = await this.prisma.theme.findMany({
      where: { isArchived: false, ...(category ? { category } : {}) },
      orderBy: { name: 'asc' },
    });
    return inCatalogOrder(themes);
  }

  async listForAdmin() {
    const themes = await this.prisma.theme.findMany({ orderBy: [{ isArchived: 'asc' }, { name: 'asc' }] });
    return inCatalogOrder(themes);
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
