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

  /**
   * The last rows this instance wrote, per collection. Used only when the CDN
   * fails to serve a just-written file — see `read`.
   */
  private lastWritten = new Map<string, unknown[]>();

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

  /**
   * Blob is served through a CDN that is only eventually consistent with a
   * just-completed write: a read issued immediately after `put` can come back
   * 403 or 404 for a second or so. Every mutation re-reads its collection
   * before applying, so that window is hit constantly rather than rarely —
   * hence the retry, which also re-resolves the URL in case the cached one
   * went stale.
   */
  private static readonly READ_RETRIES = 5;

  async read(collection: string): Promise<unknown[] | null> {
    let lastStatus = 0;

    for (let attempt = 0; attempt < VercelBlobDriver.READ_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
        // Drop the cached URL so the next pass asks Blob where the file is.
        this.urls.delete(collection);
      }

      const url = await this.resolveUrl(collection);
      // Genuinely absent: the collection has never been written.
      if (!url) return attempt === 0 ? null : (this.lastWritten.get(collection) ?? null);

      // `cache: 'no-store'` matters: a stale CDN read after a write would
      // silently resurrect deleted rows.
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return (await res.json()) as unknown[];
      lastStatus = res.status;

      // 403/404 here means "written, not visible yet" — worth retrying.
      // Anything else (429, 5xx) is also transient enough to retry.
    }

    // The CDN never caught up. If this process wrote the collection, its own
    // copy is authoritative and newer than anything Blob would have served.
    const local = this.lastWritten.get(collection);
    if (local) return local;

    throw new Error(
      `Blob read failed for ${collection} after ${String(VercelBlobDriver.READ_RETRIES)} attempts ` +
        `(last status ${String(lastStatus)})`,
    );
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
    this.lastWritten.set(collection, rows);
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
