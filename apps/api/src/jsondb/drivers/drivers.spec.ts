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
 * account token, so the SDK is mocked. That still pins down the parts most
 * likely to be wrong: the key layout, overwrite-in-place options, and the
 * cache-busting read that stops a CDN-stale response resurrecting deleted rows.
 */
describe('vercel blob driver', () => {
  const put = jest.fn();
  const list = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    put.mockReset();
    list.mockReset();
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
    put.mockResolvedValue({ url: 'https://blob.example/jsondb/user.json' });
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
    list.mockResolvedValue({ blobs: [] });
    const driver = makeDriver();

    await expect(driver.read('user')).resolves.toBeNull();
  });

  it('reads with caching disabled so writes are read back correctly', async () => {
    const url = 'https://blob.example/jsondb/user.json';
    list.mockResolvedValue({ blobs: [{ pathname: 'jsondb/user.json', url }] });
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([{ id: '1' }]) });
    global.fetch = fetchMock;

    const driver = makeDriver();
    await expect(driver.read('user')).resolves.toEqual([{ id: '1' }]);

    expect(fetchMock).toHaveBeenCalledWith(url, { cache: 'no-store' });
  });

  it('strips the prefix when listing collections', async () => {
    list.mockResolvedValue({
      blobs: [{ pathname: 'jsondb/user.json' }, { pathname: 'jsondb/plan.json' }],
    });
    const driver = makeDriver();

    await expect(driver.list()).resolves.toEqual(['user', 'plan']);
  });
});
