import { loadBlobSdk } from './blob-sdk';

import type { JsonDbDriver } from './types';

interface LocalCopy {
  rows: unknown[];
  /** Blob's own `uploadedAt` for the write this instance made, in ms. */
  uploadedAt: number;
}

/**
 * Stores the same one-JSON-file-per-model layout in Vercel Blob.
 *
 * Vercel's serverless filesystem is read-only apart from `/tmp`, which is
 * per-instance and wiped between invocations — so a plain file on disk cannot
 * be the write store there. Blob keeps the JSON-file model intact while
 * actually persisting, and is available on Vercel's free tier.
 *
 * **Read-after-write.** Blob content is served through a CDN that can return a
 * *stale 200* for a pathname that was just overwritten. That is fatal for a
 * database: registration created a user, and the very next update failed with
 * "No User found" because the read came back without it. Retrying does not
 * help, since the stale response is a success.
 *
 * So reads do not trust the CDN blindly. `list()` goes to the Blob API rather
 * than the CDN and always reports the true `uploadedAt`, which is used to
 * decide:
 *
 *   - nothing newer than this instance's own write exists → serve the copy we
 *     wrote, which is authoritative;
 *   - something newer exists (another instance wrote) → fetch it, with a
 *     cache-busting query string so the CDN cannot serve an older body.
 */
export class VercelBlobDriver implements JsonDbDriver {
  readonly name = 'blob';

  /** What this instance last wrote, per collection. See the class comment. */
  private local = new Map<string, LocalCopy>();

  private static readonly FETCH_RETRIES = 4;

  constructor(
    private readonly prefix = 'jsondb',
    private readonly token = process.env.BLOB_READ_WRITE_TOKEN,
  ) {}

  private key(collection: string): string {
    return `${this.prefix}/${collection}.json`;
  }

  /** Current remote state from the Blob API — never from the CDN. */
  private async describe(
    collection: string,
  ): Promise<{ url: string; uploadedAt: number } | null> {
    const { list } = loadBlobSdk();
    const key = this.key(collection);
    const { blobs } = await list({ prefix: key, token: this.token });
    const hit = blobs.find((b) => b.pathname === key);
    if (!hit) return null;
    return { url: hit.url, uploadedAt: new Date(hit.uploadedAt).getTime() };
  }

  private async fetchBody(url: string): Promise<unknown[] | null> {
    let lastStatus = 0;

    for (let attempt = 0; attempt < VercelBlobDriver.FETCH_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** (attempt - 1)));
      }
      // A unique query string gives the CDN a cache key it cannot already
      // hold, forcing it to go to origin.
      const res = await fetch(`${url}?_=${String(Date.now())}-${String(attempt)}`, {
        cache: 'no-store',
      });
      if (res.ok) return (await res.json()) as unknown[];
      lastStatus = res.status;
    }

    throw new Error(
      `Blob read failed for ${url} after ${String(VercelBlobDriver.FETCH_RETRIES)} attempts ` +
        `(last status ${String(lastStatus)})`,
    );
  }

  async read(collection: string): Promise<unknown[] | null> {
    const remote = await this.describe(collection);
    const local = this.local.get(collection);

    if (!remote) {
      // Never written, or the API hasn't registered our write yet — our own
      // copy is still the better answer than "empty".
      return local ? local.rows : null;
    }

    // Nothing has landed since this instance's write, so skip the CDN entirely.
    if (local && remote.uploadedAt <= local.uploadedAt) return local.rows;

    try {
      return await this.fetchBody(remote.url);
    } catch (error) {
      if (local) return local.rows;
      throw error;
    }
  }

  async write(collection: string, rows: unknown[]): Promise<void> {
    const { put } = loadBlobSdk();
    await put(this.key(collection), JSON.stringify(rows, null, 2), {
      access: 'public',
      token: this.token,
      contentType: 'application/json',
      // Overwrite in place, otherwise every write mints a new suffixed path.
      allowOverwrite: true,
      addRandomSuffix: false,
    });

    // Take `uploadedAt` from Blob rather than the local clock, so the
    // comparison in `read` is between two server-side timestamps and cannot be
    // thrown off by clock skew.
    const remote = await this.describe(collection);
    this.local.set(collection, {
      rows,
      uploadedAt: remote?.uploadedAt ?? Date.now(),
    });
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
