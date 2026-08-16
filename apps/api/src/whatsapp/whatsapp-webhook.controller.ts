import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Public } from '../common/decorators/public.decorator';

import { WhatsappService } from './whatsapp.service';

import type { Response } from 'express';

interface MetaWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        messages?: { from?: string; type?: string; text?: { body?: string } }[];
      };
    }[];
  }[];
}

/** Public endpoints Meta's Cloud API calls directly — the `GET` handshake
 * verifies this deployment owns the webhook URL, the `POST` delivers
 * inbound messages on the shared number. Neither is behind auth, so both
 * validate against `WHATSAPP_WEBHOOK_VERIFY_TOKEN` / just log-and-ignore
 * anything malformed rather than trusting the request shape. */
@Controller('whatsapp/webhook')
@Public()
export class WhatsappWebhookController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') verifyToken: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() res: Response,
  ) {
    const expectedToken = this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && expectedToken && verifyToken === expectedToken) {
      res.status(HttpStatus.OK).send(challenge);
      return;
    }
    throw new BadRequestException('Invalid webhook verification request');
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  receive(@Body() payload: MetaWebhookPayload) {
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = message?.from;
    const body = message?.text?.body;

    if (message?.type === 'text' && from && body) {
      // Fire-and-forget — Meta expects a fast 200 ack, not a wait for the
      // AI reply to generate and send.
      this.whatsappService.handleInbound(from, body).catch(() => {
        // handleInbound already logs internally; nothing more to do here.
      });
    }

    return { received: true };
  }
}
