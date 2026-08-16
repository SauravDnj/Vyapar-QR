import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgencyService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) {
      throw new NotFoundException('Agency not found');
    }
    return agency;
  }

  async getStats(agencyId: string) {
    const [totalClients, activeClients] = await this.prisma.$transaction([
      this.prisma.client.count({ where: { agencyId } }),
      this.prisma.client.count({ where: { agencyId, status: 'active' } }),
    ]);
    return { totalClients, activeClients };
  }

  listClients(agencyId: string) {
    return this.prisma.client.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        businessName: true,
        slug: true,
        status: true,
        createdAt: true,
        user: { select: { email: true } },
        subscriptions: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { plan: { select: { name: true } } },
        },
      },
    });
  }
}
