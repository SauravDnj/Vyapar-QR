import { BadRequestException, Body, Controller, Get, Header, Headers, Param, Post, Req, StreamableFile, UseGuards } from '@nestjs/common';


import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

import { BillingService } from './billing.service';
import { CheckoutDto } from './dto/checkout.dto';

import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @Roles('client_admin', 'client_staff')
  listPlans() {
    return this.billingService.listActivePlans();
  }

  @Post('checkout')
  @Roles('client_admin')
  @UseGuards(ClientScopeGuard)
  checkout(@Body() dto: CheckoutDto, @CurrentClientId() clientId: string) {
    return this.billingService.checkout(clientId, dto.planId);
  }

  @Get('invoices')
  @Roles('client_admin', 'client_staff')
  @UseGuards(ClientScopeGuard, PermissionsGuard)
  @RequirePermission('billing')
  listInvoices(@CurrentClientId() clientId: string) {
    return this.billingService.listInvoices(clientId);
  }

  @Get('invoices/:id/pdf')
  @Roles('client_admin', 'client_staff')
  @UseGuards(ClientScopeGuard, PermissionsGuard)
  @RequirePermission('billing')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="invoice.pdf"')
  async invoicePdf(@Param('id') id: string, @CurrentClientId() clientId: string) {
    const buffer = await this.billingService.generateInvoicePdf(clientId, id);
    return new StreamableFile(buffer);
  }

  @Get('subscription')
  @Roles('client_admin', 'client_staff')
  @UseGuards(ClientScopeGuard, PermissionsGuard)
  @RequirePermission('billing')
  getCurrentSubscription(@CurrentClientId() clientId: string) {
    return this.billingService.getCurrentSubscription(clientId);
  }

  @Public()
  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }
    await this.billingService.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
