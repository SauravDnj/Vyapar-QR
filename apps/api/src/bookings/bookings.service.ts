import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

import type { BookSlotDto } from './dto/book-slot.dto';
import type { CreateBulkSlotsDto } from './dto/create-bulk-slots.dto';
import type { CreateSlotDto } from './dto/create-slot.dto';

const DEFAULT_DURATION_MINUTES = 30;
const MAX_BULK_SLOTS = 100;
const PUBLIC_WINDOW_DAYS = 30;
/** P13-03: send a reminder once a booking is this close (and hasn't had
 * one sent yet) — the sweep itself runs every 15 minutes, so this window
 * just needs to be comfortably wider than that interval. */
const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  createSlot(clientId: string, dto: CreateSlotDto) {
    return this.prisma.bookingSlot.create({
      data: { clientId, startsAt: new Date(dto.startsAt), durationMinutes: dto.durationMinutes ?? DEFAULT_DURATION_MINUTES },
    });
  }

  /** e.g. "9am–5pm every 30 minutes" → one open slot row per interval. */
  async createBulkSlots(clientId: string, dto: CreateBulkSlotsDto) {
    const start = new Date(`${dto.date}T${dto.startTime}:00`);
    const end = new Date(`${dto.date}T${dto.endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('End time must be after start time.');
    }

    const intervalMs = dto.intervalMinutes * 60_000;
    const starts: Date[] = [];
    for (let t = start.getTime(); t + intervalMs <= end.getTime(); t += intervalMs) {
      starts.push(new Date(t));
    }
    if (starts.length === 0) {
      throw new BadRequestException('No slots fit in that time range.');
    }
    if (starts.length > MAX_BULK_SLOTS) {
      throw new BadRequestException(`Too many slots at once — max ${String(MAX_BULK_SLOTS)}.`);
    }

    await this.prisma.bookingSlot.createMany({
      data: starts.map((startsAt) => ({ clientId, startsAt, durationMinutes: dto.intervalMinutes })),
    });
    return this.prisma.bookingSlot.findMany({ where: { clientId, startsAt: { gte: start, lt: end } }, orderBy: { startsAt: 'asc' } });
  }

  /** Everything upcoming — open and booked — for the dashboard. */
  listUpcoming(clientId: string) {
    return this.prisma.bookingSlot.findMany({
      where: { clientId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
    });
  }

  async deleteSlot(clientId: string, id: string): Promise<void> {
    const slot = await this.prisma.bookingSlot.findFirst({ where: { id, clientId } });
    if (!slot) {
      throw new NotFoundException('Slot not found');
    }
    if (slot.isBooked) {
      throw new BadRequestException('Cannot delete a slot that has already been booked.');
    }
    await this.prisma.bookingSlot.delete({ where: { id } });
  }

  /** Public — open, upcoming slots only, for the landing page widget. */
  async listOpenForPublic(slug: string) {
    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (!client) {
      return [];
    }
    const until = new Date(Date.now() + PUBLIC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    return this.prisma.bookingSlot.findMany({
      where: { clientId: client.id, isBooked: false, startsAt: { gte: new Date(), lte: until } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, durationMinutes: true },
    });
  }

  /** Public — books directly into the slot row; an atomic conditional
   * update (`isBooked: false` in the `where`) so two customers racing for
   * the same slot can't both win it. */
  async book(slug: string, slotId: string, dto: BookSlotDto): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (!client) {
      throw new NotFoundException('Page not found');
    }

    const result = await this.prisma.bookingSlot.updateMany({
      where: { id: slotId, clientId: client.id, isBooked: false },
      data: { isBooked: true, customerName: dto.name.trim(), customerPhone: dto.phone.trim(), notes: dto.notes?.trim() ?? null },
    });
    if (result.count === 0) {
      throw new BadRequestException('This slot is no longer available.');
    }
  }

  /** P13-03: the frequent sweep — WhatsApp-reminds every booked, upcoming
   * slot inside `REMINDER_WINDOW_MS` that hasn't had one sent yet, for
   * clients with WhatsApp enabled. Never throws per-slot, same "log and
   * continue" philosophy as the other sweeps in this codebase. */
  async sendReminders(): Promise<{ sent: number }> {
    const now = new Date();
    const until = new Date(now.getTime() + REMINDER_WINDOW_MS);
    const slots = await this.prisma.bookingSlot.findMany({
      where: {
        isBooked: true,
        reminderSentAt: null,
        startsAt: { gte: now, lte: until },
        customerPhone: { not: null },
        client: { whatsappSettings: { isEnabled: true } },
      },
      include: { client: { select: { businessName: true } } },
    });

    let sent = 0;
    for (const slot of slots) {
      if (!slot.customerPhone) continue;
      try {
        const when = slot.startsAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        const message = `Reminder: your appointment with ${slot.client.businessName} is coming up on ${when}.${slot.customerName ? ` See you soon, ${slot.customerName}!` : ''}`;
        const ok = await this.whatsappService.sendAndRecord(slot.clientId, slot.customerPhone, message);
        if (ok) {
          await this.prisma.bookingSlot.update({ where: { id: slot.id }, data: { reminderSentAt: new Date() } });
          sent += 1;
        }
      } catch (error) {
        this.logger.error(`Booking reminder failed for slot ${slot.id}`, error instanceof Error ? error.stack : undefined);
      }
    }
    return { sent };
  }
}
