import { extname } from 'node:path';

import { BadRequestException, Controller, ParseFilePipeBuilder, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { StorageService } from './storage.service';

import type { Express } from 'express';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = /^image\/(png|jpe?g|webp|svg\+xml)$/;
const ALLOWED_DOCUMENT_MIME = /^(image\/(png|jpe?g|webp)|application\/pdf)$/;

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storageService: StorageService) {}

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
