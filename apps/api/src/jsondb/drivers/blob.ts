import { loadBlobSdk } from './blob-sdk';

import type { JsonDbDriver } from './types';

/**
 * Stores the same one-JSON-file-per-model layout in Vercel Blob.
 *
 * Vercel's serverless filesystem is read-only apart from `/tmp`, which is
 * per-instance and wiped between invocations — so a plain file on disk cannot
 * be the write store there. Blob keeps the JSON-file model intact while
 * actually persisting, and is available on Vercel's free tier.
 *
 * `@vercel/blob` is imported lazily so local/VPS deploys that never select
 * this driver don't need the dependency resolved at boot.
 */
export class VercelBlobDriver implements JsonDbDriver {
  readonly name = 'blob';

  /** Blob URLs are content-addressed; cache the mapping to avoid re-listing. */
  private urls = new Map<string, string>();

  constructor(
    private readonly prefix = 'jsondb',
    private readonly token = process.env.BLOB_READ_WRITE_TOKEN,
  ) {}

  private key(collection: string): string {
    return `${this.prefix}/${collection}.json`;
  }

  private async resolveUrl(collection: string): Promise<string | null> {
    const cached = this.urls.get(collection);
    if (cached) return cached;
    const { list } = loadBlobSdk();
    const { blobs } = await list({ prefix: this.key(collection), token: this.token });
    const hit = blobs.find((b) => b.pathname === this.key(collection));
    if (!hit) return null;
    this.urls.set(collection, hit.url);
    return hit.url;
  }

  async read(collection: string): Promise<unknown[] | null> {
    const url = await this.resolveUrl(collection);
    if (!url) return null;
    // `cache: 'no-store'` matters: Blob sits behind a CDN, and a stale read
    // after a write would silently resurrect deleted rows.
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Blob read failed for ${collection}: ${String(res.status)}`);
    }
    return (await res.json()) as unknown[];
  }

  async write(collection: string, rows: unknown[]): Promise<void> {
    const { put } = loadBlobSdk();
    const result = await put(this.key(collection), JSON.stringify(rows, null, 2), {
      access: 'public',
      token: this.token,
      contentType: 'application/json',
      // Overwrite in place, otherwise every write mints a new suffixed path.
      allowOverwrite: true,
      addRandomSuffix: false,
    });
    this.urls.set(collection, result.url);
  }

  async list(): Promise<string[]> {
    const { list } = loadBlobSdk();
    const { blobs } = await list({ prefix: `${this.prefix}/`, token: this.token });
    return blobs
      .map((b) => b.pathname.slice(`${this.prefix}/`.length))
      .filter((p) => p.endsWith('.json'))
      .map((p) => p.slice(0, -'.json'.length));
  }
}
