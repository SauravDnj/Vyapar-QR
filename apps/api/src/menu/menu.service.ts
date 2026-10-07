import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

import type { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import type { CreateMenuItemDto } from './dto/create-menu-item.dto';
import type { PlaceOrderDto } from './dto/place-order.dto';
import type { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import type { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import type { PlanFeatures } from '@vyaparqr/types';

/** Trimmed text, or null when nothing but whitespace was typed. */
function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/** What the customer's phone gets back: enough to show "Order #12 sent" and
 * to poll for its status. */
export interface PlacedOrder {
  id: string;
  orderNumber: number;
  totalAmount: string;
}

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooksService: WebhooksService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsappService,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
  ) {}

  async createCategory(clientId: string, dto: CreateMenuCategoryDto) {
    const count = await this.prisma.menuCategory.count({ where: { clientId } });
    return this.prisma.menuCategory.create({ data: { clientId, name: dto.name.trim(), displayOrder: count } });
  }

  listCategories(clientId: string) {
    return this.prisma.menuCategory.findMany({
      where: { clientId },
      orderBy: { displayOrder: 'asc' },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async updateCategory(clientId: string, id: string, dto: UpdateMenuCategoryDto) {
    const category = await this.prisma.menuCategory.findFirst({ where: { id, clientId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return this.prisma.menuCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
      },
    });
  }

  async removeCategory(clientId: string, id: string): Promise<void> {
    const category = await this.prisma.menuCategory.findFirst({ where: { id, clientId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    await this.prisma.menuCategory.delete({ where: { id } });
  }

  async createItem(clientId: string, categoryId: string, dto: CreateMenuItemDto) {
    const category = await this.prisma.menuCategory.findFirst({ where: { id: categoryId, clientId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    const count = await this.prisma.menuItem.count({ where: { clientId, categoryId } });
    return this.prisma.menuItem.create({
      data: {
        clientId,
        categoryId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        priceRupees: dto.priceRupees,
        imageUrl: dto.imageUrl ?? null,
        isAvailable: dto.isAvailable ?? true,
        displayOrder: count,
      },
    });
  }

  async updateItem(clientId: string, id: string, dto: UpdateMenuItemDto) {
    const item = await this.prisma.menuItem.findFirst({ where: { id, clientId } });
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    if (dto.categoryId) {
      const category = await this.prisma.menuCategory.findFirst({ where: { id: dto.categoryId, clientId } });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }
    return this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.priceRupees !== undefined ? { priceRupees: dto.priceRupees } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
      },
    });
  }

  async removeItem(clientId: string, id: string): Promise<void> {
    const item = await this.prisma.menuItem.findFirst({ where: { id, clientId } });
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    await this.prisma.menuItem.delete({ where: { id } });
  }

  /** Public landing-page display — categories with only their currently
   * available items; categories that end up with none are dropped rather
   * than shown empty. Returns `[]` (not a 403) when the client isn't
   * entitled, so the section on the public page just doesn't render,
   * rather than erroring out for a customer who has no idea what a plan
   * feature is. */
  async listActiveForPublic(clientId: string) {
    const entitled = await this.isDigitalMenuEntitled(clientId);
    if (!entitled) {
      return [];
    }

    const categories = await this.prisma.menuCategory.findMany({
      where: { clientId },
      orderBy: { displayOrder: 'asc' },
      include: { items: { where: { isAvailable: true }, orderBy: { displayOrder: 'asc' } } },
    });

    return categories
      .filter((category) => category.items.length > 0)
      .map((category) => ({
        id: category.id,
        name: category.name,
        items: category.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          priceRupees: item.priceRupees.toString(),
          imageUrl: item.imageUrl,
        })),
      }));
  }

  /** The security-critical write: never trusts a client-submitted price.
   * Every item is re-fetched by id, scoped to this client and currently
   * available, and `totalAmount` is computed purely from that server-side
   * read — the request body's role is only "which item ids, how many". */
  async placeOrder(slug: string, dto: PlaceOrderDto): Promise<PlacedOrder | null> {
    if (dto.website) {
      // Honeypot tripped — silent success, no row written, no signal back to the bot.
      return null;
    }

    const orderType = dto.orderType ?? null;
    const tableNumber = orderType === 'dine_in' ? blankToNull(dto.tableNumber) : null;
    const deliveryAddress = orderType === 'delivery' ? blankToNull(dto.deliveryAddress) : null;
    if (orderType === 'delivery' && !deliveryAddress) {
      throw new BadRequestException('Enter a delivery address.');
    }

    const client = await this.prisma.client.findUnique({
      where: { slug },
      select: { id: true, businessName: true, user: { select: { email: true } } },
    });
    if (!client) {
      throw new NotFoundException('Page not found');
    }

    const entitled = await this.isDigitalMenuEntitled(client.id);
    if (!entitled) {
      throw new BadRequestException('Ordering is not available on this page.');
    }

    const requestedIds = dto.items.map((item) => item.menuItemId);
    const dbItems = await this.prisma.menuItem.findMany({
      where: { id: { in: requestedIds }, clientId: client.id, isAvailable: true },
    });
    const dbItemsById = new Map(dbItems.map((item) => [item.id, item]));
    if (dbItemsById.size !== new Set(requestedIds).size) {
      throw new BadRequestException('One or more items in your order are no longer available.');
    }

    let totalAmount = 0;
    const itemsJson: { menuItemId: string; name: string; unitPrice: string; quantity: number }[] = [];
    for (const requested of dto.items) {
      const item = dbItemsById.get(requested.menuItemId);
      if (!item) {
        throw new BadRequestException('One or more items in your order are no longer available.');
      }
      totalAmount += item.priceRupees * requested.quantity;
      itemsJson.push({ menuItemId: item.id, name: item.name, unitPrice: item.priceRupees.toString(), quantity: requested.quantity });
    }

    // A count, not a counter row: two orders landing in the same instant can
    // share a number, which is harmless — the uuid stays the real identity.
    const orderNumber = (await this.prisma.order.count({ where: { clientId: client.id } })) + 1;

    const order = await this.prisma.order.create({
      data: {
        clientId: client.id,
        customerName: dto.customerName.trim(),
        customerPhone: dto.customerPhone.trim(),
        itemsJson,
        totalAmount,
        notes: blankToNull(dto.notes),
        orderNumber,
        orderType,
        tableNumber,
        deliveryAddress,
      },
    });

    // The order is saved; from here on nothing may fail the request. A
    // failed alert used to surface as a 500, the customer tapped "Place
    // order" again, and the shop got the same order twice.
    try {
      await this.alertOwner(client, order, itemsJson);
    } catch (error) {
      this.logger.error(`Order ${order.id} saved, but alerting the owner failed`, error instanceof Error ? error.stack : undefined);
    }

    return { id: order.id, orderNumber, totalAmount: order.totalAmount.toString() };
  }

  /** The public status poll behind "Order #12 — being prepared". Scoped by
   * slug as well as id, and returns nothing a stranger could use: the id is
   * an unguessable uuid the customer's phone was just given. */
  async getPublicOrderStatus(slug: string, orderId: string) {
    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true } });
    const order = client && await this.prisma.order.findFirst({
      where: { id: orderId, clientId: client.id },
      select: { orderNumber: true, status: true, totalAmount: true, orderType: true, tableNumber: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return { ...order, totalAmount: order.totalAmount.toString() };
  }

  private async alertOwner(
    client: { id: string; businessName: string; user: { email: string } },
    order: { id: string; customerName: string; totalAmount: { toString(): string }; createdAt: Date; orderNumber: number | null },
    itemsJson: { name: string; quantity: number; unitPrice: string; menuItemId: string }[],
  ): Promise<void> {
    await this.webhooksService.dispatch(client.id, 'order.created', {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      totalAmount: order.totalAmount.toString(),
      createdAt: order.createdAt.toISOString(),
    });

    const adminAppUrl = this.configService.get<string>('ADMIN_APP_URL') ?? 'http://localhost:3001';
    await this.emailService.sendNewOrder(
      client.user.email,
      client.businessName,
      order.id,
      itemsJson,
      order.totalAmount.toString(),
      `${adminAppUrl}/dashboard/orders`,
    );

    const [whatsappSettings, reviewConfig] = await Promise.all([
      this.prisma.whatsappSettings.findUnique({ where: { clientId: client.id } }),
      this.prisma.googleReviewConfig.findUnique({ where: { clientId: client.id }, select: { feedbackWhatsappNumber: true } }),
    ]);
    const ownerPhone = reviewConfig?.feedbackWhatsappNumber ?? null;
    const alertMessage = `New order #${String(order.orderNumber)} from ${order.customerName} (₹${order.totalAmount.toString()}) — ${String(itemsJson.length)} item(s). Check your dashboard to confirm.`;

    if (ownerPhone && whatsappSettings?.isEnabled) {
      await this.whatsappService.sendAndRecord(client.id, ownerPhone, alertMessage);
    }
    if (ownerPhone && this.smsService.isConfigured) {
      await this.smsService.sendText(ownerPhone, alertMessage);
    }
  }

  private async isDigitalMenuEntitled(clientId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { featuresJson: true } } },
    });
    const features = subscription?.plan.featuresJson as unknown as PlanFeatures | undefined;
    return features?.digitalMenu ?? false;
  }
}
