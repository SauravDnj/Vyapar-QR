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
 * account token, so the SDK is mocked. What matters here is the read-after-
 * write behaviour: Blob's CDN can serve a *stale 200* for a pathname that was
 * just overwritten, which broke registration in production ("No User found"
 * on the update immediately following the create).
 */
describe('vercel blob driver', () => {
  const put = jest.fn();
  const list = jest.fn();
  const URL_ = 'https://blob.example/jsondb/user.json';

  /** `list` reports Blob's authoritative state; `undefined` = not present. */
  function remoteAt(uploadedAt?: string) {
    list.mockImplementation(({ prefix }: { prefix: string }) =>
      Promise.resolve({
        blobs:
          uploadedAt && prefix.startsWith('jsondb/user')
            ? [{ pathname: 'jsondb/user.json', url: URL_, uploadedAt }]
            : uploadedAt
              ? [{ pathname: 'jsondb/user.json', url: URL_, uploadedAt }]
              : [],
      }),
    );
  }

  beforeEach(() => {
    jest.resetModules();
    put.mockReset();
    list.mockReset();
    put.mockResolvedValue({ url: URL_ });
    jest.doMock('@vercel/blob', () => ({ put, list }), { virtual: true });
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

  it('writes to a stable, overwritable path', async () => {
    remoteAt('2026-01-01T00:00:00.000Z');
    const driver = makeDriver();

    await driver.write('user', [{ id: '1' }]);

    expect(put).toHaveBeenCalledWith(
      'jsondb/user.json',
      JSON.stringify([{ id: '1' }], null, 2),
      expect.objectContaining({
        access: 'public',
        token: 'test-token',
        allowOverwrite: true,
        addRandomSuffix: false,
      }),
    );
  });

  it('returns null when the collection does not exist yet', async () => {
    remoteAt(undefined);
    const driver = makeDriver();

    await expect(driver.read('user')).resolves.toBeNull();
  });

  it('serves its own write without touching the CDN', async () => {
    // The regression test for the production bug: a stale CDN body must never
    // be able to mask a write this instance just made.
    remoteAt('2026-01-01T00:00:00.000Z');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 'STALE' }]),
    });
    global.fetch = fetchMock;

    const driver = makeDriver();
    await driver.write('user', [{ id: 'fresh' }]);

    await expect(driver.read('user')).resolves.toEqual([{ id: 'fresh' }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches when another writer has published something newer', async () => {
    remoteAt('2026-01-01T00:00:00.000Z');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 'from-other-instance' }]),
    });
    global.fetch = fetchMock;

    const driver = makeDriver();
    await driver.write('user', [{ id: 'ours' }]);

    // Someone else overwrote the collection after our write.
    remoteAt('2026-06-01T00:00:00.000Z');
    await expect(driver.read('user')).resolves.toEqual([{ id: 'from-other-instance' }]);

    // …and the request must defeat the CDN cache.
    const [calledUrl, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl.startsWith(`${URL_}?_=`)).toBe(true);
    expect(opts).toEqual({ cache: 'no-store' });
  });

  it('falls back to its own copy when the CDN keeps failing', async () => {
    remoteAt('2026-01-01T00:00:00.000Z');
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 403 });

    const driver = makeDriver();
    await driver.write('user', [{ id: 'ours' }]);

    remoteAt('2026-06-01T00:00:00.000Z');
    await expect(driver.read('user')).resolves.toEqual([{ id: 'ours' }]);
  });

  it('strips the prefix when listing collections', async () => {
    list.mockResolvedValue({
      blobs: [{ pathname: 'jsondb/user.json' }, { pathname: 'jsondb/plan.json' }],
    });
    const driver = makeDriver();

    await expect(driver.list()).resolves.toEqual(['user', 'plan']);
  });
});
