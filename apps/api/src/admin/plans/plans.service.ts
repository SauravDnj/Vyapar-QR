import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type { CreatePlanDto } from './dto/create-plan.dto';
import type { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.plan.findMany({ orderBy: { price: 'asc' } });
  }

  async findOneOrThrow(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  create(dto: CreatePlanDto) {
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        price: dto.price,
        billingCycle: dto.billingCycle,
        maxThemes: dto.maxThemes,
        customDomainAllowed: dto.customDomainAllowed,
        featuresJson: {
          analytics: dto.featuresJson.analytics,
          customDomain: dto.featuresJson.customDomain,
          whiteLabel: dto.featuresJson.whiteLabel,
          digitalMenu: dto.featuresJson.digitalMenu,
        },
      },
    });
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findOneOrThrow(id);
    return this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name,
        price: dto.price,
        billingCycle: dto.billingCycle,
        maxThemes: dto.maxThemes,
        customDomainAllowed: dto.customDomainAllowed,
        isArchived: dto.isArchived,
        featuresJson: dto.featuresJson
          ? {
              analytics: dto.featuresJson.analytics,
              customDomain: dto.featuresJson.customDomain,
              whiteLabel: dto.featuresJson.whiteLabel,
              digitalMenu: dto.featuresJson.digitalMenu,
            }
          : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    // Plans referenced by subscriptions can't be hard-deleted (FK restrict) —
    // archive instead so history remains intact.
    return this.prisma.plan.update({ where: { id }, data: { isArchived: true } });
  }
}
