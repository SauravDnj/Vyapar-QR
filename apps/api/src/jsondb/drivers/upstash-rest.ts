export type RedisCommand = (string | number)[];

/**
 * Minimal client for the Upstash Redis REST API: a command is a JSON array
 * POSTed to the base URL, and `/multi-exec` runs several as one transaction.
 * Plain `fetch`, so there is no client library and no long-lived socket — the
 * right shape for serverless functions.
 *
 * Shared by the `redis` jsondb driver and `StorageService`.
 */
export class UpstashRest {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {
    if (!url || !token) {
      throw new Error(
        'Upstash Redis needs KV_REST_API_URL and KV_REST_API_TOKEN ' +
          '(or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)',
      );
    }
  }

  /** Built from the variables the Vercel Marketplace integration injects. */
  static fromEnv(): UpstashRest {
    return new UpstashRest(
      process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? '',
      process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    );
  }

  static isConfigured(): boolean {
    return Boolean(process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL);
  }

  private async send<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.url.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const message =
        payload && typeof payload === 'object' && 'error' in payload
          ? String(payload.error)
          : `HTTP ${String(res.status)}`;
      throw new Error(`Redis request failed: ${message}`);
    }
    return payload as T;
  }

  async command<T>(cmd: RedisCommand): Promise<T> {
    const { result, error } = await this.send<{ result?: T; error?: string }>('', cmd);
    if (error) throw new Error(`Redis ${String(cmd[0])} failed: ${error}`);
    return result as T;
  }

  /** Runs the commands atomically (MULTI/EXEC). */
  async transaction(cmds: RedisCommand[]): Promise<unknown[]> {
    const results = await this.send<{ result?: unknown; error?: string }[]>('/multi-exec', cmds);
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(`Redis transaction failed: ${failed.error}`);
    return results.map((r) => r.result);
  }
}
