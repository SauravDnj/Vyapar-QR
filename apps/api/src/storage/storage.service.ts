import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { loadBlobSdk } from '../jsondb/drivers/blob-sdk';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');

/**
 * File storage for logos, payment-QR images and generated QR codes, behind a
 * `save(buffer, ext) -> url` / `readByUrl(url)` shape.
 *
 * Two backends, chosen by `STORAGE_DRIVER` (default: Vercel Blob when running
 * on Vercel, local disk otherwise):
 *
 *   `local` — writes under `uploads/`, served back by `/uploads/*`. Fine for
 *             dev and for a VPS with a persistent disk.
 *   `blob`  — Vercel Blob. Required on Vercel: the serverless filesystem is
 *             read-only apart from `/tmp`, which is per-instance and wiped, so
 *             a locally-written upload would 404 on the very next request.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'local' | 'blob';

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>('STORAGE_DRIVER');
    this.driver =
      (configured as 'local' | 'blob' | undefined) ??
      (process.env.VERCEL ? 'blob' : 'local');
  }

  private get apiUrl(): string {
    return (
      this.configService.get<string>('API_PUBLIC_URL') ??
      `http://localhost:${process.env.PORT ?? '4100'}`
    );
  }

  async save(buffer: Buffer, extension: string): Promise<string> {
    const filename = `${randomUUID()}${extension}`;

    if (this.driver === 'blob') {
      const { put } = loadBlobSdk();
      const { url } = await put(`uploads/${filename}`, buffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
      });
      return url;
    }

    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(join(UPLOADS_DIR, filename), buffer);
    return `${this.apiUrl}/uploads/${filename}`;
  }

  /**
   * Reads a previously-`save`d file back given the URL `save` returned.
   * Returns `null` for URLs this service didn't create.
   */
  async readByUrl(url: string): Promise<Buffer | null> {
    if (this.driver === 'blob') {
      // Blob URLs are absolute and public; fetch rather than hit the filesystem.
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return null;
        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        this.logger.warn(`Failed to read blob ${url}: ${String(error)}`);
        return null;
      }
    }

    const prefix = `${this.apiUrl}/uploads/`;
    if (!url.startsWith(prefix)) {
      return null;
    }
    try {
      return await readFile(join(UPLOADS_DIR, url.slice(prefix.length)));
    } catch {
      return null;
    }
  }
}
