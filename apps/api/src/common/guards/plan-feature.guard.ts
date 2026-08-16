import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature.decorator';

import type { PlanFeatures } from '@qrhub/types';
import type { Request } from 'express';

/** Runs after `ClientScopeGuard` — reads `request.clientId` (never trusts
 * request input), resolves the client's active subscription's plan, and
 * checks the required flag in `Plan.featuresJson`. No active subscription
 * is treated as no access. */
@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<keyof PlanFeatures | undefined>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { clientId?: string }>();
    const clientId = request.clientId;
    if (!clientId) {
      throw new ForbiddenException('Client access only');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { featuresJson: true } } },
    });

    const features = subscription?.plan.featuresJson as unknown as PlanFeatures | undefined;
    if (!features?.[requiredFeature]) {
      throw new ForbiddenException('Upgrade your plan to access this feature.');
    }

    return true;
  }
}
