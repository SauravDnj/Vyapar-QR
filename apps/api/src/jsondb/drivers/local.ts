import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { JsonDbDriver } from './types';

/**
 * One `<collection>.json` file per model on the local filesystem. Used for
 * local development and for a VPS deploy, where the disk is writable and
 * persistent. Not usable on Vercel — see `VercelBlobDriver`.
 */
export class LocalFileDriver implements JsonDbDriver {
  readonly name = 'local';

  constructor(private readonly dir: string) {}

  private path(collection: string): string {
    return join(this.dir, `${collection}.json`);
  }

  private async ensureDir(): Promise<void> {
    if (!existsSync(this.dir)) await mkdir(this.dir, { recursive: true });
  }

  async read(collection: string): Promise<unknown[] | null> {
    try {
      const raw = await readFile(this.path(collection), 'utf8');
      return JSON.parse(raw) as unknown[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async write(collection: string, rows: unknown[]): Promise<void> {
    await this.ensureDir();
    // Write to a temp file and rename: a crash mid-write then leaves the
    // previous good file intact instead of a truncated one.
    const target = this.path(collection);
    const tmp = `${target}.${String(process.pid)}.tmp`;
    await writeFile(tmp, JSON.stringify(rows, null, 2), 'utf8');
    await rename(tmp, target);
  }

  async list(): Promise<string[]> {
    await this.ensureDir();
    const entries = await readdir(this.dir);
    return entries
      .filter((e) => e.endsWith('.json'))
      .map((e) => e.slice(0, -'.json'.length));
  }
}
