import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');

/** Local-disk file storage for dev, behind the same shape an S3/MinIO-backed
 * implementation would have — swapping the body of `save` is all that's
 * needed to move to real object storage later. */
@Injectable()
export class StorageService {
  constructor(private readonly configService: ConfigService) {}

  async save(buffer: Buffer, extension: string): Promise<string> {
    await mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}${extension}`;
    await writeFile(join(UPLOADS_DIR, filename), buffer);

    const apiUrl = this.configService.get<string>('API_PUBLIC_URL') ?? `http://localhost:${process.env.PORT ?? '4100'}`;
    return `${apiUrl}/uploads/${filename}`;
  }

  /** Reads a previously-`save`d file back off disk given the URL `save`
   * returned. Returns `null` for URLs it didn't create (e.g. once this is
   * swapped for real S3/MinIO, old local URLs simply won't resolve). */
  async readByUrl(url: string): Promise<Buffer | null> {
    const apiUrl = this.configService.get<string>('API_PUBLIC_URL') ?? `http://localhost:${process.env.PORT ?? '4100'}`;
    const prefix = `${apiUrl}/uploads/`;
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
