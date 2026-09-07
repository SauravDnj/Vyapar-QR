import { randomUUID } from 'node:crypto';

import { loadBlobSdk } from './blob-sdk';

import type { JsonDbDriver } from './types';

interface Version {
  url: string;
  pathname: string;
}

interface LocalWrite {
  pathname: string;
  /** The `Date.now()` this version's filename was minted with. */
  version: number;
  rows: unknown[];
}

/**
 * Stores the JSON collections in Vercel Blob.
 *
 * Vercel's serverless filesystem is read-only apart from `/tmp`, which is
 * per-instance and wiped between invocations — so a plain file on disk cannot
 * be the write store there. Blob persists, and is on the free tier.
 *
 * Two independent consistency problems had to be solved here, both found only
 * by running against the real service:
 *
 * 1. **The CDN serves a stale 200 for an overwritten pathname**, and a
 *    cache-busting query string does not defeat it. So a collection is not one
 *    file that gets overwritten; it is a *directory of immutable versions*
 *    (`jsondb/user/<ts>-<uuid>.json`). Every write publishes a URL no cache has
 *    ever seen, so a fetch cannot return something stale.
 *
 * 2. **`list()` is eventually consistent too** — immediately after a write it
 *    can still report only the previous version. Picking "the newest version
 *    `list()` knows about" therefore lost data: a `deleteMany` + `createMany`
 *    pair inside one request came back empty, because the second operation's
 *    read did not yet see the first one's write. So this instance's own write
 *    wins unless `list()` shows something demonstrably newer.
 *
 * Concurrent writes from two instances remain last-write-wins — inherent to
 * file-backed storage, and documented in this package's README.
 */
export class VercelBlobDriver implements JsonDbDriver {
  readonly name = 'blob';

  /** The version this instance last wrote, per collection. */
  private local = new Map<string, LocalWrite>();

  private static readonly FETCH_RETRIES = 4;

  /** Superseded versions kept after a write, as a small safety margin. */
  private static readonly KEEP_VERSIONS = 2;

  /**
   * Last version number handed out by this instance. `Date.now()` alone is not
   * enough: two writes in the same millisecond — a `deleteMany` immediately
   * followed by a `createMany`, exactly what onboarding does — would get equal
   * version numbers, leaving their order ambiguous and pruning unable to tell
   * which is superseded.
   */
  private lastVersion = 0;

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

  /** Parses the `Date.now()` prefix out of a version's filename. */
  private static versionOf(pathname: string): number {
    const name = pathname.slice(pathname.lastIndexOf('/') + 1);
    const dash = name.indexOf('-');
    return dash > 0 ? (Number.parseInt(name.slice(0, dash), 10) || 0) : 0;
  }

  /** All versions of a collection, newest first. */
  private async versions(collection: string): Promise<Version[]> {
    const { list } = loadBlobSdk();
    const { blobs } = await list({ prefix: this.dir(collection), token: this.token });
    return blobs
      .map((b) => ({ url: b.url, pathname: b.pathname }))
      .sort((a, b) => {
        const delta =
          VercelBlobDriver.versionOf(b.pathname) - VercelBlobDriver.versionOf(a.pathname);
        // Fall back to the full pathname so two instances that happen to mint
        // the same millisecond still order deterministically.
        return delta !== 0 ? delta : b.pathname.localeCompare(a.pathname);
      });
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
    const local = this.local.get(collection);

    // Explicit length check rather than destructuring: this project does not
    // enable `noUncheckedIndexedAccess`, so `const [x] =` would be typed as
    // present even when the array is empty.
    const newestListed =
      versions.length > 0 ? VercelBlobDriver.versionOf(versions[0].pathname) : 0;

    // Our own write wins over a listing that hasn't caught up with it. See
    // point 2 in the class comment — this is what stopped writes disappearing.
    if (local && local.version >= newestListed) return local.rows;

    if (versions.length === 0) {
      // Nothing versioned yet — fall back to the pre-versioning file so a
      // store written by an earlier deploy keeps working. The next write
      // publishes a versioned file and this path stops being taken.
      return this.readLegacy(collection);
    }

    try {
      // A URL no cache has seen before, so this cannot be stale.
      return await this.fetchJson(versions[0].url);
    } catch (error) {
      if (local) return local.rows;
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

    // Timestamp first so names sort chronologically and `versionOf` can order
    // them; the uuid is what guarantees a fresh, uncached URL.
    const version = Math.max(Date.now(), this.lastVersion + 1);
    this.lastVersion = version;
    const pathname = `${this.dir(collection)}${String(version)}-${randomUUID()}.json`;
    await put(pathname, JSON.stringify(rows, null, 2), {
      access: 'public',
      token: this.token,
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    this.local.set(collection, { pathname, version, rows });
    await this.pruneVersions(collection, version);
  }

  /** Deletes versions older than the one just written, keeping the newest few. */
  private async pruneVersions(collection: string, justWritten: number): Promise<void> {
    try {
      const { del } = loadBlobSdk();
      const all = await this.versions(collection);

      // Strictly older only: a lagging `list()` must never lead to deleting
      // the version that was just published.
      const stale = all
        .filter((v) => VercelBlobDriver.versionOf(v.pathname) < justWritten)
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
