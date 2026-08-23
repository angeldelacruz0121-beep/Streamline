// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isFresh, MemoryCacheStore, type CacheEntry } from './store.ts';

const NOW = Date.parse('2026-07-29T16:00:00.000Z');

function entry(overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    url: 'https://data.sec.gov/submissions/CIK0000789019.json',
    body: '{}',
    contentType: 'application/json',
    etag: null,
    lastModified: null,
    status: 200,
    storedAt: NOW,
    expiresAt: NOW + 3_600_000,
    reason: 'test entry',
    ...overrides,
  };
}

describe('cache store', () => {
  it('treats an immutable entry as permanently fresh', () => {
    expect(isFresh(entry({ expiresAt: null }), NOW + 10 ** 12)).toBe(true);
  });

  it('expires an entry the moment its lifetime is up', () => {
    expect(isFresh(entry(), NOW + 3_599_999)).toBe(true);
    expect(isFresh(entry(), NOW + 3_600_000)).toBe(false);
  });

  it('stores, reads, replaces and drops entries', async () => {
    const store = new MemoryCacheStore();

    expect(await store.get(entry().url)).toBeNull();

    await store.set(entry());
    expect((await store.get(entry().url))?.body).toBe('{}');

    await store.set(entry({ body: '{"replaced":true}' }));
    expect((await store.get(entry().url))?.body).toBe('{"replaced":true}');
    expect(store.size).toBe(1);

    await store.delete(entry().url);
    expect(await store.get(entry().url)).toBeNull();

    await store.set(entry());
    await store.clear();
    expect(store.size).toBe(0);
  });

  it('carries the reason for its lifetime with the data', async () => {
    const store = new MemoryCacheStore();

    await store.set(entry({ reason: 'Accessioned bytes never change.' }));

    expect((await store.get(entry().url))?.reason).toContain('never change');
  });
});
