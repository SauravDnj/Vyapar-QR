import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { Order, Prisma } from '../jsondb';
import type { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import type { OrderStatusValue } from './dto/update-order-status.dto';

export interface PaginatedOrders {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(clientId: string, query: ListOrdersQueryDto): Promise<PaginatedOrders> {
    const where: Prisma.OrderWhereInput = {
      clientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [{ customerName: { contains: query.search } }, { customerPhone: { contains: query.search } }],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * What the admin's new-order alert polls. Small on purpose — it runs every
   * few seconds on every open dashboard tab: how many orders are waiting, and
   * any placed after `since` (the newest one the tab has already seen).
   */
  async live(clientId: string, since: Date | null) {
    const [pendingCount, newOrders] = await Promise.all([
      this.prisma.order.count({ where: { clientId, status: 'pending' } }),
      since
        ? this.prisma.order.findMany({
            where: { clientId, createdAt: { gt: since } },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
    ]);
    return { pendingCount, newOrders, serverTime: new Date().toISOString() };
  }

  async findOneOrThrow(clientId: string, orderId: string): Promise<Order> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, clientId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async updateStatus(clientId: string, orderId: string, status: OrderStatusValue): Promise<Order> {
    await this.findOneOrThrow(clientId, orderId);
    return this.prisma.order.update({ where: { id: orderId }, data: { status } });
  }
}
