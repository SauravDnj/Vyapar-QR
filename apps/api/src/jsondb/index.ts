/**
 * Public surface of the JSON database.
 *
 * This module is the drop-in replacement for `@prisma/client`: it re-exports
 * every model interface, enum and `Prisma` namespace member the API used to
 * import from there, so the swap from MySQL to JSON documents needed no
 * changes to the services themselves — only their import specifier.
 */
export * from './generated/models';
export { JsonDbClient, createDriverFromEnv } from './client';
export { JsonDbError, NotFoundError, UniqueConstraintError } from './errors';
export { ModelDelegate } from './delegate';
export { JsonStore } from './store';
export { LocalFileDriver } from './drivers/local';
export { VercelBlobDriver } from './drivers/blob';
export { MemoryDriver } from './drivers/memory';
export type { JsonDbDriver } from './drivers/types';
export { parseSchema } from './schema/parser';
