/**
 * A driver is the only part of the JSON database that touches the outside
 * world. Everything above it deals in plain JSON documents, so swapping
 * where those documents live — local disk, Vercel Blob, memory — never
 * reaches the query engine or the services above it.
 */
export interface JsonDbDriver {
  readonly name: string;
  /** Returns `null` when the collection has never been written. */
  read(collection: string): Promise<unknown[] | null>;
  write(collection: string, rows: unknown[]): Promise<void>;
  /** Collections that currently exist in the store. */
  list(): Promise<string[]>;
}
