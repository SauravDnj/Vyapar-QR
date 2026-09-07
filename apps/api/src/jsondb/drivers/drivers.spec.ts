import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalFileDriver } from './local';
import { MemoryDriver } from './memory';

import type { JsonDbDriver } from './types';

/**
 * Every driver has to behave identically from the engine's point of view, so
 * the contract is asserted once and run against each implementation.
 */
function describeDriverContract(name: string, make: () => JsonDbDriver): void {
  describe(`${name} driver`, () => {
    let driver: JsonDbDriver;

    beforeEach(() => {
      driver = make();
    });

    it('returns null for a collection that was never written', async () => {
      await expect(driver.read('user')).resolves.toBeNull();
    });

    it('round-trips rows', async () => {
      const rows = [{ id: '1', email: 'a@b.com' }, { id: '2', email: 'c@d.com' }];
      await driver.write('user', rows);
      await expect(driver.read('user')).resolves.toEqual(rows);
    });

    it('overwrites rather than appending', async () => {
      await driver.write('user', [{ id: '1' }]);
      await driver.write('user', [{ id: '2' }]);
      await expect(driver.read('user')).resolves.toEqual([{ id: '2' }]);
    });

    it('persists an empty collection distinctly from a missing one', async () => {
      await driver.write('user', []);
      await expect(driver.read('user')).resolves.toEqual([]);
    });

    it('lists written collections', async () => {
      await driver.write('user', []);
      await driver.write('plan', []);
      await expect(driver.list()).resolves.toEqual(
        expect.arrayContaining(['user', 'plan']),
      );
    });
  });
}

describeDriverContract('memory', () => new MemoryDriver());

describe('local file driver', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'jsondb-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describeDriverContract('local', () => new LocalFileDriver(mkdtempSync(join(dir, 'c'))));

  it('survives a new driver instance over the same directory', async () => {
    const path = mkdtempSync(join(dir, 'persist'));
    await new LocalFileDriver(path).write('user', [{ id: 'kept' }]);

    // A fresh instance holds no state of its own — this is the real test that
    // the data landed on disk rather than in a cache.
    await expect(new LocalFileDriver(path).read('user')).resolves.toEqual([
      { id: 'kept' },
    ]);
  });
});

/**
 * The Blob driver can't be exercised against real Vercel Blob without an
 * account token, so the SDK is mocked. What matters is that reads are always
 * fresh: Blob's CDN serves a stale 200 for an overwritten pathname, and a
 * cache-busting query string does not defeat it. In production that produced
 * two distinct failures — "No User found" on an update right after a create,
 * and a duplicate account when a second instance read a stale body — which is
 * why every write publishes a new immutable version.
 */
describe('vercel blob driver', () => {
  const put = jest.fn();
  const list = jest.fn();
  const del = jest.fn();

  /** Models the store: pathname -> uploadedAt, filtered by prefix like Blob. */
  let store: { pathname: string; url: string; uploadedAt: string }[] = [];
  /** Pathnames in write order — `put.mock.calls` is untyped. */
  let written: string[] = [];

  beforeEach(() => {
    jest.resetModules();
    put.mockReset();
    list.mockReset();
    del.mockReset();
    store = [];
    written = [];

    put.mockImplementation((pathname: string) => {
      written.push(pathname);
      store.push({
        pathname,
        url: `https://blob.example/${pathname}`,
        uploadedAt: new Date(1_800_000_000_000 + store.length * 1000).toISOString(),
      });
      return Promise.resolve({ url: `https://blob.example/${pathname}` });
    });
    list.mockImplementation(({ prefix }: { prefix: string }) =>
      Promise.resolve({ blobs: store.filter((b) => b.pathname.startsWith(prefix)) }),
    );
    del.mockImplementation((urls: string[]) => {
      store = store.filter((b) => !urls.includes(b.url));
      return Promise.resolve();
    });

    jest.doMock('@vercel/blob', () => ({ put, list, del }), { virtual: true });
  });

  afterEach(() => {
    jest.unmock('@vercel/blob');
  });

  // `require` rather than dynamic `import`: the suite runs as CommonJS, where
  // an ESM import callback needs --experimental-vm-modules. It also re-reads
  // the module so `jest.doMock` above takes effect.
  function makeDriver() {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const { VercelBlobDriver } = require('./blob') as typeof import('./blob');
    return new VercelBlobDriver('jsondb', 'test-token');
  }

  /** Serves whatever the mocked store currently holds at that URL. */
  function serveStore(bodies: Record<string, unknown[] | undefined>) {
    global.fetch = jest.fn((url: string) =>
      Promise.resolve({
        ok: bodies[url] !== undefined,
        status: bodies[url] !== undefined ? 200 : 404,
        json: () => Promise.resolve(bodies[url]),
      }),
    ) as unknown as typeof fetch;
  }

  it('returns null when the collection does not exist yet', async () => {
    serveStore({});
    await expect(makeDriver().read('user')).resolves.toBeNull();
  });

  it('writes each version to a new, unique path', async () => {
    const driver = makeDriver();
    await driver.write('user', [{ id: '1' }]);
    await driver.write('user', [{ id: '2' }]);

    expect(written).toHaveLength(2);
    expect(written[0]).not.toBe(written[1]);
    for (const p of written) expect(p.startsWith('jsondb/user/')).toBe(true);
  });

  it('reads the newest version, so a fresh instance never sees stale data', async () => {
    // The regression test: instance A writes twice; instance B, with no local
    // state, must read the newer body.
    const a = makeDriver();
    await a.write('user', [{ id: 'old' }]);
    await a.write('user', [{ id: 'new' }]);

    const [older, newer] = written;
    serveStore({
      [`https://blob.example/${older}`]: [{ id: 'old' }],
      [`https://blob.example/${newer}`]: [{ id: 'new' }],
    });

    await expect(makeDriver().read('user')).resolves.toEqual([{ id: 'new' }]);
  });

  it('prunes superseded versions', async () => {
    const driver = makeDriver();
    for (let i = 0; i < 5; i++) await driver.write('user', [{ id: String(i) }]);

    const remaining = store.filter((b) => b.pathname.startsWith('jsondb/user/'));
    expect(remaining.length).toBeLessThanOrEqual(2);
  });

  it('does not confuse collections sharing a name prefix', async () => {
    const driver = makeDriver();
    await driver.write('client', [{ id: 'c' }]);
    await driver.write('clientStaffMember', [{ id: 's' }]);

    const clientPaths = store.filter((b) => b.pathname.startsWith('jsondb/client/'));
    expect(clientPaths).toHaveLength(1);
    await expect(driver.list()).resolves.toEqual(
      expect.arrayContaining(['client', 'clientStaffMember']),
    );
  });

  it('reads data written by the pre-versioning layout', async () => {
    store.push({
      pathname: 'jsondb/user.json',
      url: 'https://blob.example/jsondb/user.json',
      uploadedAt: new Date(1_700_000_000_000).toISOString(),
    });
    serveStore({ 'https://blob.example/jsondb/user.json': [{ id: 'legacy' }] });

    await expect(makeDriver().read('user')).resolves.toEqual([{ id: 'legacy' }]);
  });

  it('falls back to its own copy when the CDN keeps failing', async () => {
    const driver = makeDriver();
    await driver.write('user', [{ id: 'ours' }]);
    serveStore({});

    await expect(driver.read('user')).resolves.toEqual([{ id: 'ours' }]);
  });
});
