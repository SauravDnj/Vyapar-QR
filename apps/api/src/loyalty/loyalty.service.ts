import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { SaveLoyaltyProgramDto } from './dto/save-program.dto';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  getProgram(clientId: string) {
    return this.prisma.loyaltyProgram.findUnique({ where: { clientId } });
  }

  saveProgram(clientId: string, dto: SaveLoyaltyProgramDto) {
    return this.prisma.loyaltyProgram.upsert({
      where: { clientId },
      create: { clientId, stampsRequired: dto.stampsRequired, rewardText: dto.rewardText, isActive: dto.isActive ?? false },
      update: {
        stampsRequired: dto.stampsRequired,
        rewardText: dto.rewardText,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  listCards(clientId: string) {
    return this.prisma.loyaltyCard.findMany({ where: { clientId }, orderBy: { stampCount: 'desc' } });
  }

  async addStamp(clientId: string, phone: string) {
    const program = await this.getProgram(clientId);
    if (!program?.isActive) {
      throw new BadRequestException('Set up and activate your loyalty program first.');
    }

    const normalizedPhone = phone.trim();
    return this.prisma.loyaltyCard.upsert({
      where: { clientId_customerPhone: { clientId, customerPhone: normalizedPhone } },
      create: { clientId, customerPhone: normalizedPhone, stampCount: 1 },
      update: { stampCount: { increment: 1 } },
    });
  }

  async redeem(clientId: string, cardId: string) {
    const [program, card] = await Promise.all([
      this.getProgram(clientId),
      this.prisma.loyaltyCard.findFirst({ where: { id: cardId, clientId } }),
    ]);
    if (!program) {
      throw new BadRequestException('No loyalty program configured.');
    }
    if (!card) {
      throw new NotFoundException('Loyalty card not found');
    }
    if (card.stampCount < program.stampsRequired) {
      throw new BadRequestException('This card does not have enough stamps yet.');
    }

    return this.prisma.loyaltyCard.update({
      where: { id: card.id },
      data: { stampCount: { decrement: program.stampsRequired }, redemptionCount: { increment: 1 } },
    });
  }

  /** Public, phone-only lookup for a customer to check their own progress
   * — no card is created here, only by `addStamp` (staff-initiated). */
  async lookupForCustomer(slug: string, phone: string) {
    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (!client) {
      throw new NotFoundException('Page not found');
    }

    const [program, card] = await Promise.all([
      this.getProgram(client.id),
      this.prisma.loyaltyCard.findUnique({ where: { clientId_customerPhone: { clientId: client.id, customerPhone: phone.trim() } } }),
    ]);

    if (!program?.isActive) {
      return { active: false as const };
    }

    return {
      active: true as const,
      // Only set once a card exists (first stamp from staff) — a wallet
      // pass needs a stable serial number, so the UI can't offer "Add to
      // Wallet" until this is non-null.
      cardId: card?.id ?? null,
      stampsRequired: program.stampsRequired,
      rewardText: program.rewardText,
      stampCount: card?.stampCount ?? 0,
      redemptionCount: card?.redemptionCount ?? 0,
    };
  }

  /** Ownership-scoped lookup by card id — used by the wallet-pass
   * endpoints, which are keyed by card id rather than phone. */
  async findCardOrThrow(clientId: string, cardId: string) {
    const card = await this.prisma.loyaltyCard.findFirst({ where: { id: cardId, clientId } });
    if (!card) {
      throw new NotFoundException('Loyalty card not found');
    }
    return card;
  }
}
