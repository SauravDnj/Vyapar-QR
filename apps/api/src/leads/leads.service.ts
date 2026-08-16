import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WhatsappAiService } from '../whatsapp/whatsapp-ai.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

import type { CreateLeadDto } from './dto/create-lead.dto';
import type { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import type { UpdateLeadDto } from './dto/update-lead.dto';
import type { Lead, Prisma } from '@prisma/client';

/** P13-02: how long a `new` lead sits untouched before the daily sweep
 * nudges them once via WhatsApp. */
const FOLLOW_UP_AFTER_MS = 24 * 60 * 60 * 1000;

export interface PaginatedLeads {
  data: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

const CSV_COLUMNS = ['name', 'phone', 'source', 'status', 'notes', 'tags', 'createdAt'] as const;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooksService: WebhooksService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsappService,
    private readonly whatsappAiService: WhatsappAiService,
  ) {}

  async list(clientId: string, query: ListLeadsQueryDto): Promise<PaginatedLeads> {
    const where: Prisma.LeadWhereInput = {
      clientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [{ name: { contains: query.search } }, { phone: { contains: query.search } }],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async update(clientId: string, leadId: string, dto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, clientId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return this.prisma.lead.update({
      where: { id: leadId },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
      },
    });
  }

  async findOneOrThrow(clientId: string, leadId: string): Promise<Lead> {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, clientId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async exportCsv(clientId: string): Promise<string> {
    const leads = await this.prisma.lead.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });

    const rows = leads.map((lead) => {
      const tags = Array.isArray(lead.tags) ? (lead.tags as unknown[]).join('; ') : '';
      const values = [
        lead.name,
        lead.phone,
        lead.source,
        lead.status,
        lead.notes ?? '',
        tags,
        lead.createdAt.toISOString(),
      ];
      return values.map((value) => csvEscape(value)).join(',');
    });

    return [CSV_COLUMNS.join(','), ...rows].join('\n');
  }

  async createFromContactForm(slug: string, dto: CreateLeadDto): Promise<void> {
    if (dto.website) {
      // Honeypot tripped — silent success, no row written.
      return;
    }

    const client = await this.prisma.client.findUnique({
      where: { slug },
      select: { id: true, businessName: true, user: { select: { email: true } } },
    });
    if (!client) {
      return;
    }

    const trimmedMessage = dto.message?.trim();
    const notes = trimmedMessage && trimmedMessage.length > 0 ? trimmedMessage : null;

    const lead = await this.prisma.lead.create({
      data: {
        clientId: client.id,
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        source: 'contact_form',
        notes,
      },
    });

    await this.webhooksService.dispatch(client.id, 'lead.created', {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      source: lead.source,
      createdAt: lead.createdAt.toISOString(),
    });

    const adminAppUrl = this.configService.get<string>('ADMIN_APP_URL') ?? 'http://localhost:3001';
    await this.emailService.sendNewLead(client.user.email, client.businessName, lead.name, lead.phone, notes, `${adminAppUrl}/dashboard/leads`);
  }

  /** P13-02: the daily sweep — nudges every `new` lead that's gone quiet
   * for a client with WhatsApp enabled, once each (guarded by
   * `followUpSentAt`). Never throws per-lead — one bad send shouldn't stop
   * the rest of the sweep, same "log and continue" philosophy as
   * `ReviewsService.syncAllConfiguredClients`. */
  async sendFollowUps(): Promise<{ sent: number }> {
    const cutoff = new Date(Date.now() - FOLLOW_UP_AFTER_MS);
    const leads = await this.prisma.lead.findMany({
      where: {
        status: 'new',
        followUpSentAt: null,
        createdAt: { lte: cutoff },
        client: { whatsappSettings: { isEnabled: true } },
      },
    });

    let sent = 0;
    for (const lead of leads) {
      try {
        const message = await this.whatsappAiService.draftFollowUpMessage(lead.clientId, lead.name);
        const ok = await this.whatsappService.sendAndRecord(lead.clientId, lead.phone, message);
        if (ok) {
          await this.prisma.lead.update({ where: { id: lead.id }, data: { followUpSentAt: new Date() } });
          sent += 1;
        }
      } catch (error) {
        this.logger.error(`Follow-up failed for lead ${lead.id}`, error instanceof Error ? error.stack : undefined);
      }
    }
    return { sent };
  }
}
