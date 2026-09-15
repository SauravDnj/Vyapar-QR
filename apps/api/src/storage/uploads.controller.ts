import { extname } from 'node:path';

import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../common/decorators/public.decorator';

import { StorageService } from './storage.service';

import type { Express, Response } from 'express';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = /^image\/(png|jpe?g|webp|svg\+xml)$/;
const ALLOWED_DOCUMENT_MIME = /^(image\/(png|jpe?g|webp)|application\/pdf)$/;

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Serves files stored by the `redis` storage driver. Public, like the Blob
   * URLs it replaces: landing pages embed these images for anonymous visitors.
   * Unthrottled because one page load fetches several at once.
   */
  @Public()
  @SkipThrottle()
  @Get(':filename')
  async serve(@Param('filename') filename: string, @Res() res: Response) {
    const file = await this.storageService.read(filename);
    if (!file) throw new NotFoundException();

    res.set({
      'Content-Type': file.contentType,
      // Filenames are fresh uuids and never overwritten, so this is safe.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // An uploaded SVG is served from the API's own origin; this stops any
      // script inside it from running if the file is opened directly.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    });
    res.send(file.body);
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_UPLOAD_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    if (!ALLOWED_MIME.test(file.mimetype)) {
      throw new BadRequestException('Only PNG, JPEG, WEBP, or SVG images are allowed');
    }

    const url = await this.storageService.save(file.buffer, extname(file.originalname) || '.png');
    return { url };
  }

  /** P4-05: menu/brochure uploads — an image or a PDF. `DocumentViewer`
   * (`packages/ui`) decides how to render whichever one comes back purely
   * from the URL's extension, so the saved file must keep a real `.pdf`
   * extension when that's what was uploaded (never coerced to `.png`). */
  @Post('document')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_DOCUMENT_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    if (!ALLOWED_DOCUMENT_MIME.test(file.mimetype)) {
      throw new BadRequestException('Only PNG, JPEG, WEBP images or a PDF are allowed');
    }

    const ext = file.mimetype === 'application/pdf' ? '.pdf' : extname(file.originalname) || '.png';
    const url = await this.storageService.save(file.buffer, ext);
    return { url };
  }
}
