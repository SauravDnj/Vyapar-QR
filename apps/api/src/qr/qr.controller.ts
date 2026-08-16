import { Body, Controller, Delete, Get, Header, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { QrService } from './qr.service';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

class CreateAdditionalQrDto {
  @IsString()
  @MinLength(1)
  label!: string;
}

class BulkCreateQrDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  labels!: string[];
}

class QrStyleDto {
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'foregroundColor must be a hex color like #0e7c66' })
  foregroundColor?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'backgroundColor must be a hex color like #ffffff' })
  backgroundColor?: string;

  @IsOptional()
  @IsBoolean()
  logoEnabled?: boolean;
}

class SmartRedirectDto {
  /** Empty string clears it. */
  @IsOptional()
  @IsString()
  redirectUrl?: string;

  /** ISO date string; empty string clears it. */
  @IsOptional()
  @IsString()
  expiresAt?: string;

  /** `0` clears the scan cap. */
  @IsOptional()
  @IsInt()
  @Min(0)
  maxScans?: number;
}

@Controller('qr')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard)
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get()
  get(@CurrentClientId() clientId: string) {
    return this.qrService.getForClient(clientId);
  }

  @Post('regenerate')
  @Roles('client_admin')
  regenerate(@CurrentClientId() clientId: string, @Body() dto: QrStyleDto = {}) {
    return this.qrService.generateForClient(clientId, dto);
  }

  @Get('poster')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="poster.pdf"')
  async poster(@CurrentClientId() clientId: string) {
    const buffer = await this.qrService.generatePosterPdf(clientId);
    return new StreamableFile(buffer);
  }

  /** P9-02: works for either the master QR or a promo QR — ownership is
   * checked by `clientId` alone, not `type`. */
  @Get(':id/trend')
  getScanTrend(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.qrService.getScanTrend(clientId, id);
  }

  /** P5-07: promo/location QR codes, listed alongside (but separate from)
   * the one master QR returned by `GET /qr`. */
  @Get('additional')
  listAdditional(@CurrentClientId() clientId: string) {
    return this.qrService.listForClient(clientId);
  }

  @Post('additional')
  @Roles('client_admin')
  createAdditional(@CurrentClientId() clientId: string, @Body() dto: CreateAdditionalQrDto) {
    return this.qrService.createAdditional(clientId, dto.label);
  }

  /** P9-03: create several labeled promo QR codes in one call. */
  @Post('additional/bulk')
  @Roles('client_admin')
  createBulk(@CurrentClientId() clientId: string, @Body() dto: BulkCreateQrDto) {
    return this.qrService.createBulk(clientId, dto.labels);
  }

  /** P9-03: a single printable A4 sheet with every promo QR code. */
  @Get('additional/sheet')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="qr-codes.pdf"')
  async printSheet(@CurrentClientId() clientId: string) {
    const buffer = await this.qrService.generatePrintSheet(clientId);
    return new StreamableFile(buffer);
  }

  @Post('additional/:id/style')
  @Roles('client_admin')
  restyleAdditional(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: QrStyleDto = {}) {
    return this.qrService.restyleAdditional(clientId, id, dto);
  }

  /** P9-01: configure/clear a custom redirect target, expiry, and/or scan
   * cap on a promo QR — the "smart redirect" upgrade. */
  @Post('additional/:id/redirect')
  @Roles('client_admin')
  setRedirectSettings(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: SmartRedirectDto = {}) {
    return this.qrService.setRedirectSettings(clientId, id, dto);
  }

  @Delete('additional/:id')
  @Roles('client_admin')
  removeAdditional(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.qrService.deleteAdditional(clientId, id);
  }
}
