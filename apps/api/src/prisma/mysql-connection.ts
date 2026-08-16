import type { PoolConfig } from 'mariadb';

/** Parses a `mysql://user:pass@host:port/db` URL into a mariadb PoolConfig.
 * The mariadb driver's own string parser only accepts a `mariadb://` scheme,
 * so a `mysql://` DATABASE_URL (as used by Prisma's `mysql` provider) must be
 * parsed manually rather than passed through as-is. */
export function parseMysqlUrl(databaseUrl: string): PoolConfig {
  const url = new URL(databaseUrl);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}
