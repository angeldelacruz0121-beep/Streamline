// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryCacheStore } from '../src/data/cache/store.ts';
import {
  SEGMENTS_CACHE_REASON,
  SEGMENTS_CACHE_SCHEME,
  SegmentsCache,
  SingleFlight,
  segmentsCacheKey,
  type BuiltSegments,
  type SegmentsKey,
} from './segments-cache.ts';

const KEY: SegmentsKey = {
  cik: '0000789019',
  form: '10-K',
  accession: '0001193125-26-323660',
  candidates: ['0001193125-26-323660'],
};

/** Stands in for the fingerprint of the extraction code. Moved to simulate a fix landing. */
let fingerprint: string;

const keyOf = (key: SegmentsKey = KEY): string => segmentsCacheKey(key, fingerprint);

let store: MemoryCacheStore;
let cache: SegmentsCache;
let builds: number;

/** A stand-in for the real pipeline: counts how many times the parse would run. */
function builder(built: Partial<BuiltSegments> = {}, delayMs = 0): () => Promise<BuiltSegments> {
  return async () => {
    builds += 1;

    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

    return {
      status: 200,
      json: JSON.stringify({ kind: 'view', build: builds }),
      cacheable: true,
      ...built,
    };
  };
}

beforeEach(() => {
  store = new MemoryCacheStore();
  fingerprint = 'aaaaaaaaaaaaaaaa';
  cache = new SegmentsCache({ store, fingerprint: () => Promise.resolve(fingerprint) });
  builds = 0;
});

describe('the derived segment-view cache', () => {
  it('builds once and serves the second request from the store', async () => {
    const first = await cache.load(KEY, builder());
    const second = await cache.load(KEY, builder());

    expect(first.cache).toBe('miss');
    expect(second.cache).toBe('hit');
    expect(builds).toBe(1);
    expect(second.json).toBe(first.json);
  });

  it('stores the entry as immutable, with a stated reason', async () => {
    await cache.load(KEY, builder());

    const entry = await store.get(keyOf());

    expect(entry).not.toBeNull();
    // `null` is this store's encoding of "immutable": see `isFresh` in store.ts.
    expect(entry?.expiresAt).toBeNull();
    expect(entry?.reason).toBe(SEGMENTS_CACHE_REASON);
    expect(entry?.reason).toContain('accessioned bytes never change');
  });

  it('keys on the accession, so a different filing is a different entry', async () => {
    await cache.load(KEY, builder());
    await cache.load({ ...KEY, accession: '0001193125-25-000001' }, builder());

    expect(builds).toBe(2);
  });

  it('carries the extraction fingerprint in the key', () => {
    expect(keyOf()).toContain(`/${SEGMENTS_CACHE_SCHEME}/${fingerprint}/`);
    expect(keyOf()).toBe(
      `streamline:segments/${SEGMENTS_CACHE_SCHEME}/${fingerprint}/0000789019/10-K/` +
        '0001193125-26-323660/0001193125-26-323660',
    );
  });

  // The defect this replaced, reproduced. Autodesk's superseded $1,124M was
  // served seventeen times after the extraction that produced it had been
  // fixed, because the stamp on the entry was a string a human had to remember
  // to change. Here the stamp moves on its own.
  it('rebuilds a cached view after the extraction code changes, without anyone bumping anything', async () => {
    const first = await cache.load(KEY, builder({ json: '{"figure":1124}' }));

    expect(first.cache).toBe('miss');
    expect((await cache.load(KEY, builder({ json: '{"figure":1124}' }))).cache).toBe('hit');

    // A fix lands in extraction. Nobody edits a version constant.
    fingerprint = 'bbbbbbbbbbbbbbbb';

    const afterFix = await cache.load(KEY, builder({ json: '{"figure":1206}' }));

    expect(afterFix.cache).toBe('miss');
    expect(afterFix.json).toBe('{"figure":1206}');
    expect(builds).toBe(2);
  });

  it('rebuilds when a new correction appears for the period, even though the filing read is the same', async () => {
    await cache.load(KEY, builder({ json: '{"note":"none"}' }));

    // A cover-page-only 10-K/A is filed. It does not restate the financials, so
    // the same accession is still read - but the reader is owed the note that a
    // correction exists, and that note lives inside the stored body.
    const withCorrection: SegmentsKey = {
      ...KEY,
      candidates: [...KEY.candidates, '0001193125-27-000001'],
    };
    const after = await cache.load(withCorrection, builder({ json: '{"note":"correction"}' }));

    expect(after.cache).toBe('miss');
    expect(after.json).toBe('{"note":"correction"}');
    expect(builds).toBe(2);
  });

  it('serves correct figures with caching disabled when the fingerprint cannot be computed', async () => {
    const warnings: string[] = [];
    const broken = new SegmentsCache({
      store,
      fingerprint: () => Promise.reject(new Error('source tree unreadable')),
      warn: (message) => warnings.push(message),
    });

    const first = await broken.load(KEY, builder());
    const second = await broken.load(KEY, builder());

    // Never a fixed fallback stamp: that is the defect, not the remedy.
    expect(first.cache).toBe('bypass');
    expect(second.cache).toBe('bypass');
    expect(builds).toBe(2);
    expect(warnings[0]).toContain('caching is disabled');
  });

  it('still answers when the store cannot be written to', async () => {
    const warnings: string[] = [];
    const readOnly = new SegmentsCache({
      store: Object.assign(Object.create(MemoryCacheStore.prototype) as MemoryCacheStore, {
        get: () => Promise.resolve(null),
        set: () => Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
        delete: () => Promise.resolve(),
        clear: () => Promise.resolve(),
      }),
      fingerprint: () => Promise.resolve(fingerprint),
      warn: (message) => warnings.push(message),
    });

    const loaded = await readOnly.load(KEY, builder({ json: '{"kind":"view"}' }));

    expect(loaded.status).toBe(200);
    expect(loaded.json).toBe('{"kind":"view"}');
    expect(warnings[0]).toContain('Could not store');
  });

  it('never remembers a result marked uncacheable', async () => {
    const first = await cache.load(KEY, builder({ cacheable: false, status: 502 }));
    const second = await cache.load(KEY, builder({ cacheable: false, status: 502 }));

    expect(first.cache).toBe('bypass');
    expect(second.cache).toBe('bypass');
    expect(builds).toBe(2);
    expect(await store.get(keyOf())).toBeNull();
  });

  it('collapses a burst on one key into one build', async () => {
    // The tab burst. Four concurrent asks, one EDGAR sequence, one parse.
    const results = await Promise.all(
      Array.from({ length: 4 }, () => cache.load(KEY, builder({}, 20))),
    );

    expect(builds).toBe(1);
    expect(results.filter((result) => result.cache === 'miss')).toHaveLength(1);
    expect(results.filter((result) => result.cache === 'coalesced')).toHaveLength(3);

    for (const result of results) {
      expect(result.json).toBe(results[0]?.json);
    }
  });

  it('coalesces filing resolution too, so a burst asks EDGAR which filing is current once', async () => {
    let resolutions = 0;
    const resolve = async (): Promise<string> => {
      resolutions += 1;
      await new Promise((done) => setTimeout(done, 20));

      return KEY.accession;
    };

    const answers = await Promise.all(
      Array.from({ length: 4 }, () => cache.resolve(KEY.cik, KEY.form, resolve)),
    );

    expect(resolutions).toBe(1);
    expect(answers).toEqual([KEY.accession, KEY.accession, KEY.accession, KEY.accession]);
  });

  it('does not cache resolution: a later request re-asks, so a new filing surfaces', async () => {
    let resolutions = 0;
    const resolve = (): Promise<number> => Promise.resolve((resolutions += 1));

    await cache.resolve(KEY.cik, KEY.form, resolve);
    await cache.resolve(KEY.cik, KEY.form, resolve);

    expect(resolutions).toBe(2);
  });

  it('rebuilds after a build failure rather than caching the failure', async () => {
    await expect(
      cache.load(KEY, () => {
        builds += 1;

        return Promise.reject(new Error('parse blew up'));
      }),
    ).rejects.toThrow('parse blew up');

    const recovered = await cache.load(KEY, builder());

    expect(builds).toBe(2);
    expect(recovered.cache).toBe('miss');
  });
});

describe('SingleFlight', () => {
  it('releases the key once the work settles, so it is not a cache', async () => {
    const flight = new SingleFlight();
    const first = flight.run('k', () => Promise.resolve(1));

    expect(flight.size).toBe(1);
    await first.promise;
    expect(flight.size).toBe(0);

    expect(flight.run('k', () => Promise.resolve(2)).leader).toBe(true);
  });

  it('releases the key after a rejection', async () => {
    const flight = new SingleFlight();

    await expect(flight.run('k', () => Promise.reject(new Error('no'))).promise).rejects.toThrow(
      'no',
    );
    expect(flight.size).toBe(0);
  });
});
