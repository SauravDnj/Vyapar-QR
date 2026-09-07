import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ModelDelegate, type DelegateHost } from './delegate';
import { VercelBlobDriver } from './drivers/blob';
import { LocalFileDriver } from './drivers/local';
import { MemoryDriver } from './drivers/memory';
import { parseSchema } from './schema/parser';
import { JsonStore } from './store';

import type { JsonDbDriver } from './drivers/types';
import type { JsonDbDelegates } from './generated/models';
import type { SchemaMeta } from './schema/types';


/**
 * A JSON-document database exposing the slice of the Prisma Client API this
 * codebase actually uses. Swapping `PrismaService` to extend this keeps all
 * 35 controllers and 41 services working without edits.
 *
 * Storage is chosen by `JSONDB_DRIVER`:
 *   `local`  — one `.json` file per model on disk (dev, VPS)
 *   `blob`   — the same files in Vercel Blob (Vercel; the disk is read-only there)
 *   `memory` — in-process only (tests)
 */
/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging --
   The delegates are installed per model at construction time, so the class
   cannot declare them statically. Merging the generated `JsonDbDelegates`
   interface into the class is what gives call sites their types; the runtime
   properties are defined in the constructor below. */
export class JsonDbClient implements DelegateHost {
  readonly schema: SchemaMeta;
  readonly store: JsonStore;

  private readonly delegates = new Map<string, ModelDelegate>();

  constructor(options: { driver?: JsonDbDriver; schemaPath?: string } = {}) {
    this.schema = parseSchema(options.schemaPath ?? resolveSchemaPath());
    this.store = new JsonStore(options.driver ?? createDriverFromEnv());

    for (const model of this.schema.models.values()) {
      const delegate = new ModelDelegate(model, this.schema, this.store, this);
      this.delegates.set(model.name, delegate);
      // Expose as `client.user`, `client.landingPage`, … exactly like Prisma.
      Object.defineProperty(this, model.delegate, {
        value: delegate,
        enumerable: true,
        writable: false,
        configurable: true,
      });
    }
  }

  delegateFor(modelName: string): ModelDelegate {
    const delegate = this.delegates.get(modelName);
    if (!delegate) throw new Error(`jsondb: unknown model "${modelName}"`);
    return delegate;
  }

  /**
   * Prisma's `$transaction` in both forms. There is no rollback: a JSON
   * document store has no transaction log, so this runs the operations in
   * order and surfaces the first failure. Every current call site uses it to
   * batch independent reads or a short sequence of writes that are safe to
   * apply partially, which is why this is adequate here — but it is the one
   * genuine semantic gap versus MySQL, and it is why a failed multi-write
   * sequence can leave earlier writes applied.
   */
  async $transaction<T extends readonly unknown[]>(
    operations: readonly [...T],
  ): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }>;
  async $transaction<T>(fn: (tx: JsonDbClient) => Promise<T>): Promise<T>;
  async $transaction(arg: unknown): Promise<unknown> {
    if (typeof arg === 'function') {
      return (arg as (tx: JsonDbClient) => Promise<unknown>)(this);
    }
    const results: unknown[] = [];
    for (const operation of arg as readonly unknown[]) results.push(await operation);
    return results;
  }

  /** Present so Nest lifecycle hooks that call them keep working. */
  async $connect(): Promise<void> {
    // Nothing to open: drivers connect lazily per operation.
  }

  $disconnect(): Promise<void> {
    this.store.invalidate();
    return Promise.resolve();
  }

  $queryRaw(): never {
    throw new Error(
      'jsondb: raw SQL is not supported — port the query to the JSON engine ' +
        '(see apps/api/src/jsondb/README.md)',
    );
  }

  $executeRaw(): never {
    return this.$queryRaw();
  }
}

/** `apps/api/prisma/schema.prisma`, whether running from `src` or `dist`. */
function resolveSchemaPath(): string {
  const explicit = process.env.JSONDB_SCHEMA_PATH;
  if (explicit) return explicit;

  const candidates = [
    join(process.cwd(), 'prisma', 'schema.prisma'),
    join(process.cwd(), 'apps', 'api', 'prisma', 'schema.prisma'),
    join(__dirname, '..', '..', 'prisma', 'schema.prisma'),
    join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `jsondb: could not locate schema.prisma (looked in ${candidates.join(', ')})`,
    );
  }
  return found;
}

export function createDriverFromEnv(): JsonDbDriver {
  const name = process.env.JSONDB_DRIVER ?? (process.env.VERCEL ? 'blob' : 'local');
  switch (name) {
    case 'blob':
      return new VercelBlobDriver(process.env.JSONDB_BLOB_PREFIX ?? 'jsondb');
    case 'memory':
      return new MemoryDriver();
    case 'local':
      return new LocalFileDriver(
        process.env.JSONDB_DIR ?? join(process.cwd(), 'data', 'jsondb'),
      );
    default:
      throw new Error(`jsondb: unknown JSONDB_DRIVER "${name}"`);
  }
}

// Declares the per-model delegates for the type-checker; see the disable
// comment above the class.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JsonDbClient extends JsonDbDelegates {}
