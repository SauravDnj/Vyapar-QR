import type { JsonDbDriver } from './types';

/** In-process store. Used by tests, and as the seed target before a flush. */
export class MemoryDriver implements JsonDbDriver {
  readonly name = 'memory';

  private data = new Map<string, unknown[]>();

  constructor(seed?: Record<string, unknown[]>) {
    for (const [k, v] of Object.entries(seed ?? {})) this.data.set(k, v);
  }

  // These satisfy the async driver interface without doing async work, so
  // they return resolved promises rather than being pointlessly `async`.
  read(collection: string): Promise<unknown[] | null> {
    const rows = this.data.get(collection);
    return Promise.resolve(rows ? structuredClone(rows) : null);
  }

  write(collection: string, rows: unknown[]): Promise<void> {
    this.data.set(collection, structuredClone(rows));
    return Promise.resolve();
  }

  list(): Promise<string[]> {
    return Promise.resolve([...this.data.keys()]);
  }
}
