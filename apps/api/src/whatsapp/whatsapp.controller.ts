import { BadRequestException, Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

import { BroadcastDto } from './dto/broadcast.dto';
import { SendWhatsappMessageDto } from './dto/send-message.dto';
import { UpdateWhatsappSettingsDto } from './dto/update-settings.dto';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard, PermissionsGuard)
@RequirePermission('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly whatsappAiService: WhatsappAiService,
  ) {}

  @Get('settings')
  getSettings(@CurrentClientId() clientId: string) {
    return this.whatsappService.getSettings(clientId);
  }

  @Put('settings')
  @Roles('client_admin')
  updateSettings(@CurrentClientId() clientId: string, @Body() dto: UpdateWhatsappSettingsDto) {
    return this.whatsappService.upsertSettings(clientId, {
      isEnabled: dto.isEnabled,
      aiChatbotEnabled: dto.aiChatbotEnabled,
      systemPromptOverride: dto.systemPromptOverride ?? null,
    });
  }

  @Get('conversations')
  listConversations(@CurrentClientId() clientId: string) {
    return this.whatsappService.listConversations(clientId);
  }

  @Get('conversations/:phone')
  getConversation(@CurrentClientId() clientId: string, @Param('phone') phone: string) {
    return this.whatsappService.getConversation(clientId, phone);
  }

  @Post('send')
  send(@CurrentClientId() clientId: string, @Body() dto: SendWhatsappMessageDto) {
    return this.whatsappService.sendAndRecord(clientId, dto.phone, dto.body);
  }

  @Post('broadcast')
  @Roles('client_admin')
  async broadcast(@CurrentClientId() clientId: string, @Body() dto: BroadcastDto) {
    let message = dto.message;
    if (!message && dto.aiPrompt) {
      const draft = await this.whatsappAiService.draftBroadcastMessage(clientId, dto.aiPrompt);
      if (!draft) {
        throw new BadRequestException('AI drafting is not configured on this deployment — write the message yourself instead.');
      }
      message = draft;
    }
    if (!message) {
      throw new BadRequestException('Provide a message or an AI prompt to draft one.');
    }
    return this.whatsappService.broadcast(clientId, message, dto.status);
  }
}
