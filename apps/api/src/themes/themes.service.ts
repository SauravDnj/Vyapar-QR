import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_THEME_SCHEMA } from '@qrhub/types';

import { PrismaService } from '../prisma/prisma.service';

import type { Prisma } from '@prisma/client';

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
  list(category?: string) {
    return this.prisma.theme.findMany({
      where: { isArchived: false, ...(category ? { category } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  listForAdmin() {
    return this.prisma.theme.findMany({ orderBy: [{ isArchived: 'asc' }, { name: 'asc' }] });
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
