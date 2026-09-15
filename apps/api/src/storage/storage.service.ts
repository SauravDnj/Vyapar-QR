import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { loadBlobSdk } from '../jsondb/drivers/blob-sdk';
import { UpstashRest } from '../jsondb/drivers/upstash-rest';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');

/** Upload filenames are always `<uuid><ext>`; anything else is not ours. */
const UPLOAD_FILENAME = /^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i;

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

export interface StoredFile {
  body: Buffer;
  contentType: string;
}

type StorageDriver = 'local' | 'blob' | 'redis';

/**
 * File storage for logos, payment-QR images and generated QR codes, behind a
 * `save(buffer, ext) -> url` / `readByUrl(url)` shape.
 *
 * Three backends, chosen by `STORAGE_DRIVER` (default on Vercel: Redis when
 * Upstash is configured, else Blob; local disk everywhere else):
 *
 *   `local` — writes under `uploads/`, served back by `/uploads/*`. Fine for
 *             dev and for a VPS with a persistent disk.
 *   `redis` — Upstash Redis, one key per file, served back by
 *             `UploadsController` at `/uploads/:filename`. The Vercel default.
 *   `blob`  — Vercel Blob. Legacy: it shares the Hobby operation allowance the
 *             database exhausted, and a blocked store 403s every file.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;
  private redisClient?: UpstashRest;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>('STORAGE_DRIVER');
    this.driver =
      (configured as StorageDriver | undefined) ??
      (process.env.VERCEL ? (UpstashRest.isConfigured() ? 'redis' : 'blob') : 'local');
  }

  private get redis(): UpstashRest {
    this.redisClient ??= UpstashRest.fromEnv();
    return this.redisClient;
  }

  private static redisKey(filename: string): string {
    return `upload:${filename}`;
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

    if (this.driver === 'redis') {
      // Base64 because the REST API carries JSON; the filename is a fresh
      // uuid, so a key is written once and never overwritten.
      await this.redis.command(['SET', StorageService.redisKey(filename), buffer.toString('base64')]);
      return `${this.apiUrl}/uploads/${filename}`;
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
    const filename = url.slice(prefix.length);

    if (this.driver === 'redis') {
      return (await this.read(filename))?.body ?? null;
    }

    try {
      return await readFile(join(UPLOADS_DIR, filename));
    } catch {
      return null;
    }
  }

  /**
   * Serves a file saved by the `redis` driver. Returns `null` for anything
   * that isn't one — including every request under the other drivers, whose
   * files are served by the static handler or by Blob itself.
   */
  async read(filename: string): Promise<StoredFile | null> {
    if (this.driver !== 'redis' || !UPLOAD_FILENAME.test(filename)) return null;

    const encoded = await this.redis.command<string | null>([
      'GET',
      StorageService.redisKey(filename),
    ]);
    if (encoded === null) return null;

    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    return {
      body: Buffer.from(encoded, 'base64'),
      contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
    };
  }
}
