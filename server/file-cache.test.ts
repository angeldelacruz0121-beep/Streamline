// @vitest-environment node
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CacheEntry } from '../src/data/cache/store.ts';
import { FileCacheStore } from './file-cache.ts';

const URL_UNDER_TEST =
  'https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/index.json';

let dir: string;
let store: FileCacheStore;

function entry(overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    url: URL_UNDER_TEST,
    body: '{"directory":{"name":"probe","item":[]}}',
    contentType: 'application/json',
    etag: 'W/"probe"',
    lastModified: null,
    status: 200,
    storedAt: Date.parse('2026-07-29T16:00:00.000Z'),
    expiresAt: null,
    reason: 'Accessioned bytes never change.',
    ...overrides,
  };
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'streamline-edgar-cache-'));
  store = new FileCacheStore(dir);
});

afterAll(async () => {
  await rm(dir, { force: true, recursive: true });
});

describe('file cache', () => {
  it('survives a process boundary, which is the point of it', async () => {
    await store.set(entry());

    const reopened = new FileCacheStore(dir);

    expect((await reopened.get(URL_UNDER_TEST))?.body).toBe(entry().body);
    expect((await reopened.get(URL_UNDER_TEST))?.expiresAt).toBeNull();
  });

  it('keeps the reason for the lifetime beside the data', async () => {
    expect((await store.get(URL_UNDER_TEST))?.reason).toContain('never change');
  });

  it('treats a missing or unreadable entry as a miss rather than an error', async () => {
    expect(await store.get('https://data.sec.gov/submissions/CIK0000000000.json')).toBeNull();
  });

  it('never writes a credential, because there is none to write', async () => {
    const files = await readdir(dir);
    const contents = await Promise.all(
      files.map(async (name) => (await store.get(URL_UNDER_TEST)) !== null && name),
    );

    expect(contents.length).toBeGreaterThan(0);
    expect(JSON.stringify(entry())).not.toMatch(/authorization|cookie|token/i);
  });

  // The bug: `#ensureDir` remembered it had created the directory, so once the
  // directory was deleted underneath a running server - which is what clearing
  // a stale cache by hand does - every later write failed with ENOENT and the
  // segments route turned a good answer into a transport error. Deleting the
  // cache while the server runs is a normal thing to do.
  it('recreates its directory when the cache is cleared underneath a running process', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'streamline-vanishing-cache-'));
    const vanishing = new FileCacheStore(join(scratch, 'segments'));

    await vanishing.set(entry());
    await rm(join(scratch, 'segments'), { force: true, recursive: true });

    await expect(vanishing.set(entry())).resolves.toBeUndefined();
    expect((await vanishing.get(URL_UNDER_TEST))?.body).toBe(entry().body);

    await rm(scratch, { force: true, recursive: true });
  });

  it('drops an entry on request and clears the whole directory', async () => {
    await store.set(entry());
    await store.delete(URL_UNDER_TEST);

    expect(await store.get(URL_UNDER_TEST)).toBeNull();

    await store.set(entry());
    await store.clear();

    expect(await store.get(URL_UNDER_TEST)).toBeNull();
  });
});
