import { randomUUID } from 'node:crypto';

import { loadBlobSdk } from './blob-sdk';

import type { JsonDbDriver } from './types';

interface Version {
  url: string;
  pathname: string;
  uploadedAt: number;
}

/**
 * Stores the JSON collections in Vercel Blob.
 *
 * Vercel's serverless filesystem is read-only apart from `/tmp`, which is
 * per-instance and wiped between invocations — so a plain file on disk cannot
 * be the write store there. Blob persists, and is on the free tier.
 *
 * **Why each write creates a new file.** Blob serves content through a CDN
 * that will return a stale 200 for a pathname that was just overwritten, and
 * a cache-busting query string does not defeat it. Overwriting one stable
 * `user.json` therefore broke correctness in two ways in production: an update
 * immediately after a create failed with "No User found", and a second
 * instance reading a stale body failed to see an existing email and created a
 * duplicate account, silently dropping the first.
 *
 * So a collection is a *directory* of immutable versions:
 *
 *     jsondb/user/1788772000000-9f3c…json
 *     jsondb/user/1788772461230-2a71…json   <- newest wins
 *
 * Every write publishes a brand-new URL that no cache has ever seen, and every
 * read asks the Blob API (`list`, not the CDN) which version is newest. Reads
 * are therefore always fresh. Superseded versions are deleted after each
 * write, with a couple kept as a short history.
 *
 * Concurrent writes from two instances remain last-write-wins — inherent to
 * file-backed storage, and documented in this package's README.
 */
export class VercelBlobDriver implements JsonDbDriver {
  readonly name = 'blob';

  /** Rows this instance last wrote, used only if a fetch fails outright. */
  private local = new Map<string, unknown[]>();

  private static readonly FETCH_RETRIES = 4;

  /** Superseded versions kept after a write, as a small safety margin. */
  private static readonly KEEP_VERSIONS = 2;

  constructor(
    private readonly prefix = 'jsondb',
    private readonly token = process.env.BLOB_READ_WRITE_TOKEN,
  ) {}

  /** Trailing slash matters: `jsondb/client/` must not match `clientStaffMember`. */
  private dir(collection: string): string {
    return `${this.prefix}/${collection}/`;
  }

  /** Pre-versioning layout, still read so existing data isn't stranded. */
  private legacyKey(collection: string): string {
    return `${this.prefix}/${collection}.json`;
  }

  /** All versions of a collection, newest first. */
  private async versions(collection: string): Promise<Version[]> {
    const { list } = loadBlobSdk();
    const { blobs } = await list({ prefix: this.dir(collection), token: this.token });
    return blobs
      .map((b) => ({
        url: b.url,
        pathname: b.pathname,
        uploadedAt: new Date(b.uploadedAt).getTime(),
      }))
      .sort((a, b) => b.uploadedAt - a.uploadedAt);
  }

  private async fetchJson(url: string): Promise<unknown[]> {
    let lastStatus = 0;

    for (let attempt = 0; attempt < VercelBlobDriver.FETCH_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** (attempt - 1)));
      }
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return (await res.json()) as unknown[];
      lastStatus = res.status;
    }

    throw new Error(
      `Blob read failed for ${url} after ${String(VercelBlobDriver.FETCH_RETRIES)} ` +
        `attempts (last status ${String(lastStatus)})`,
    );
  }

  async read(collection: string): Promise<unknown[] | null> {
    const versions = await this.versions(collection);
    // Explicit length check rather than destructuring: this project does not
    // enable `noUncheckedIndexedAccess`, so `const [x] =` would be typed as
    // present even when the array is empty.
    if (versions.length === 0) {
      // No versioned data yet — fall back to the pre-versioning file, so a
      // store written by an earlier deploy keeps working. The next write
      // publishes a versioned file and this path stops being taken.
      const legacy = await this.readLegacy(collection);
      if (legacy) return legacy;
      return this.local.get(collection) ?? null;
    }

    try {
      // A URL no cache has seen before, so this cannot be stale.
      return await this.fetchJson(versions[0].url);
    } catch (error) {
      const local = this.local.get(collection);
      if (local) return local;
      throw error;
    }
  }

  private async readLegacy(collection: string): Promise<unknown[] | null> {
    const { list } = loadBlobSdk();
    const key = this.legacyKey(collection);
    const { blobs } = await list({ prefix: key, token: this.token });
    const hit = blobs.find((b) => b.pathname === key);
    if (!hit) return null;
    return this.fetchJson(hit.url);
  }

  async write(collection: string, rows: unknown[]): Promise<void> {
    const { put } = loadBlobSdk();

    // Timestamp first so the names sort chronologically when browsing the
    // store; the uuid is what actually guarantees a fresh, uncached URL.
    const pathname = `${this.dir(collection)}${String(Date.now())}-${randomUUID()}.json`;
    await put(pathname, JSON.stringify(rows, null, 2), {
      access: 'public',
      token: this.token,
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    this.local.set(collection, rows);
    await this.pruneVersions(collection, pathname);
  }

  /** Deletes superseded versions, keeping the newest few. */
  private async pruneVersions(collection: string, justWritten: string): Promise<void> {
    try {
      const { del } = loadBlobSdk();
      const all = await this.versions(collection);
      const stale = all
        .filter((v) => v.pathname !== justWritten)
        .slice(VercelBlobDriver.KEEP_VERSIONS - 1);
      if (stale.length) {
        await del(
          stale.map((v) => v.url),
          { token: this.token },
        );
      }
    } catch {
      // Pruning is housekeeping: a failure leaves extra files behind but the
      // data is already written and correct, so it must not fail the write.
    }
  }

  async list(): Promise<string[]> {
    const { list } = loadBlobSdk();
    const { blobs } = await list({ prefix: `${this.prefix}/`, token: this.token });

    const names = new Set<string>();
    for (const blob of blobs) {
      const rest = blob.pathname.slice(`${this.prefix}/`.length);
      const slash = rest.indexOf('/');
      if (slash > 0) names.add(rest.slice(0, slash)); // versioned: <collection>/<version>.json
      else if (rest.endsWith('.json')) names.add(rest.slice(0, -'.json'.length)); // legacy
    }
    return [...names];
  }
}
