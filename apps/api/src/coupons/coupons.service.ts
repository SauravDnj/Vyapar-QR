import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateCouponDto } from './dto/create-coupon.dto';
import type { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(clientId: string, dto: CreateCouponDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.coupon.findUnique({ where: { clientId_code: { clientId, code } } });
    if (existing) {
      throw new ConflictException('A coupon with this code already exists.');
    }

    return this.prisma.coupon.create({
      data: {
        clientId,
        code,
        description: dto.description.trim(),
        discountText: dto.discountText.trim(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxRedemptions: dto.maxRedemptions ?? null,
      },
    });
  }

  list(clientId: string) {
    return this.prisma.coupon.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
  }

  async update(clientId: string, id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, clientId } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return this.prisma.coupon.update({ where: { id }, data: { ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) } });
  }

  async remove(clientId: string, id: string): Promise<void> {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, clientId } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    await this.prisma.coupon.delete({ where: { id } });
  }

  /** Staff-verified redemption (like a loyalty stamp, not self-serve) —
   * the customer shows the code, staff types it in. */
  async redeem(clientId: string, code: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { clientId_code: { clientId, code: code.trim().toUpperCase() } } });
    if (!coupon) {
      throw new NotFoundException('No coupon with that code.');
    }
    if (!coupon.isActive) {
      throw new BadRequestException('This coupon is inactive.');
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('This coupon has expired.');
    }
    if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new BadRequestException('This coupon has already been fully redeemed.');
    }

    return this.prisma.coupon.update({ where: { id: coupon.id }, data: { redemptionCount: { increment: 1 } } });
  }

  /** Public landing-page display — only coupons that are currently
   * actually usable. */
  async listActiveForPublic(clientId: string) {
    const coupons = await this.prisma.coupon.findMany({
      where: { clientId, isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
    });
    return coupons
      .filter((coupon) => coupon.maxRedemptions === null || coupon.redemptionCount < coupon.maxRedemptions)
      .map((coupon) => ({ code: coupon.code, description: coupon.description, discountText: coupon.discountText }));
  }
}
