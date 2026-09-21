import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

import type { Plan, Subscription } from '../../jsondb';

export type SubscriptionWithPlan = Subscription & { plan: Plan };

export interface ClientPlanState {
  /** The subscription deciding what this client can use right now, if any. */
  current: SubscriptionWithPlan | null;
  /** Every subscription the client has had, newest first. */
  history: SubscriptionWithPlan[];
}

/**
 * Plans are assigned by the Super Admin, not bought.
 *
 * Until now the only way a client got a plan was paying for one through
 * Razorpay checkout — there was no way for the platform to give a client a
 * plan, move them to another, or take one away. This is that control.
 *
 * Every feature gate (PlanFeatureGuard, and the landing page's white-label
 * check) already resolves "the client's newest `active` subscription" and
 * reads its plan's flags, so assigning a plan is simply making that the
 * newest active subscription. Nothing downstream needed to change.
 *
 * History is kept rather than edited in place: switching cancels the current
 * subscription and starts a new one, so "who was on which plan, when" stays
 * answerable, and every change lands in the audit log with who made it.
 */
@Injectable()
export class ClientPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async get(clientId: string): Promise<ClientPlanState> {
    await this.findClientOrThrow(clientId);
    const history = await this.historyOf(clientId);
    return { current: history.find((sub) => sub.status === 'active') ?? null, history };
  }

  /**
   * Gives a client a plan, or moves them from the one they have.
   *
   * Every subscription that is still open — active, but also a `pending` or
   * `past_due` one left over from an abandoned Razorpay checkout — is closed
   * first. That second part is not tidiness: the daily overdue sweep suspends
   * any client holding a `pending`/`past_due` subscription past its period
   * end, so leaving one in place would let that job take a client offline
   * the day after the Super Admin had given them a plan.
   */
  async assign(clientId: string, planId: string, actorId: string): Promise<ClientPlanState> {
    await this.findClientOrThrow(clientId);
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    if (plan.isArchived) {
      // Archived plans are kept for the clients already on them; they are not
      // offered to anyone new.
      throw new BadRequestException(`"${plan.name}" is archived. Unarchive it to assign it.`);
    }

    const history = await this.historyOf(clientId);
    const previous = history.find((sub) => sub.status === 'active') ?? null;
    if (previous?.planId === planId) {
      throw new BadRequestException(`This client is already on "${plan.name}".`);
    }

    await this.prisma.subscription.updateMany({
      where: { clientId, status: { in: ['active', 'pending', 'past_due'] } },
      data: { status: 'cancelled' },
    });
    await this.prisma.subscription.create({
      data: {
        clientId,
        planId,
        status: 'active',
        // Assigned, not billed: no gateway subscription behind it, and no
        // period end for the overdue sweep to act on.
        gatewaySubscriptionId: null,
        currentPeriodEnd: null,
      },
    });

    await this.auditLog.record({
      actorId,
      action: previous ? 'plan.switched' : 'plan.assigned',
      entity: 'Client',
      entityId: clientId,
      meta: previous
        ? { from: previous.plan.name, fromPlanId: previous.planId, to: plan.name, toPlanId: planId }
        : { to: plan.name, toPlanId: planId },
    });

    return this.get(clientId);
  }

  /** Turns the client's plan off: every plan feature is refused from the next
   * request. Their landing page stays up — taking it down is what suspending
   * the client is for, and the two are deliberately separate controls. */
  async deactivate(clientId: string, actorId: string): Promise<ClientPlanState> {
    await this.findClientOrThrow(clientId);
    const history = await this.historyOf(clientId);
    const current = history.find((sub) => sub.status === 'active');
    if (!current) {
      throw new BadRequestException('This client has no active plan to deactivate.');
    }

    await this.prisma.subscription.update({ where: { id: current.id }, data: { status: 'cancelled' } });
    await this.auditLog.record({
      actorId,
      action: 'plan.deactivated',
      entity: 'Client',
      entityId: clientId,
      meta: { plan: current.plan.name, planId: current.planId },
    });
    return this.get(clientId);
  }

  /** Turns the client's most recent plan back on. */
  async activate(clientId: string, actorId: string): Promise<ClientPlanState> {
    await this.findClientOrThrow(clientId);
    const history = await this.historyOf(clientId);
    if (history.some((sub) => sub.status === 'active')) {
      throw new BadRequestException('This client already has an active plan.');
    }
    // at(0), not [0]: an empty history is real, and at() types it as such.
    const latest = history.at(0);
    if (!latest) {
      throw new BadRequestException('This client has never had a plan. Assign one instead.');
    }
    if (latest.plan.isArchived) {
      throw new BadRequestException(`"${latest.plan.name}" has since been archived. Assign a current plan instead.`);
    }

    await this.prisma.subscription.update({ where: { id: latest.id }, data: { status: 'active' } });
    await this.auditLog.record({
      actorId,
      action: 'plan.activated',
      entity: 'Client',
      entityId: clientId,
      meta: { plan: latest.plan.name, planId: latest.planId },
    });
    return this.get(clientId);
  }

  /** The current plan for each of the given clients — one query, for the
   * clients table, rather than one per row. */
  async currentFor(clientIds: string[]): Promise<Map<string, SubscriptionWithPlan>> {
    const current = new Map<string, SubscriptionWithPlan>();
    if (clientIds.length === 0) return current;

    const active = (await this.prisma.subscription.findMany({
      where: { clientId: { in: clientIds }, status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    })) as SubscriptionWithPlan[];
    for (const sub of active) {
      if (!current.has(sub.clientId)) current.set(sub.clientId, sub);
    }
    return current;
  }

  private async historyOf(clientId: string): Promise<SubscriptionWithPlan[]> {
    return (await this.prisma.subscription.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    }));
  }

  private async findClientOrThrow(clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
  }
}
