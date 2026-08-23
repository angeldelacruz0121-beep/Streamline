/**
 * The derived-view cache for `GET /api/edgar/company/:cik/segments`.
 *
 * Every other route on this proxy is a thin passthrough: one EDGAR request, one
 * envelope, done. The segments route is not. It issues four or five requests
 * (submissions, filing series, filing index, XBRL instance, `MetaLinks.json`,
 * and usually the rendered segment R-file) and then parses a ~50MB uncompressed
 * instance to build one `CompanyView`. The raw bytes are already cached
 * immutably by `file-cache.ts`, so a warm process costs no rate-limit budget on
 * a repeat - but it still costs the parse, every page load. That parse is the
 * expensive part, and it is what this module removes.
 *
 * Two mechanisms, and they are not the same mechanism:
 *
 * 1. **The cache.** A finished, boundary-validated view keyed by the accession
 *    it was built from. Accessioned bytes are immutable, and the extraction is
 *    deterministic over them, so the derived view is immutable too - the same
 *    reasoning `TTL-POLICY.md` already applies to `archive-document`, extended
 *    one step downstream. Stored with `expiresAt: null` and a stated reason,
 *    like every other cached resource in this project.
 *
 *    The key carries two stamps, because accessioned bytes are only half of
 *    what determines a view. The first is a fingerprint of the code that built
 *    it (`extraction-fingerprint.ts`), which moves by itself whenever
 *    extraction, a schema, a dependency or this route's envelope changes - the
 *    hand-typed version string it replaces is what let seventeen stale views,
 *    Autodesk's superseded figure among them, survive a correct fix. The second
 *    is the filer's own set of filings for the period, so that a correction
 *    filed *after* a view was stored cannot be masked by that view even when the
 *    accession read does not change. Retiring derived entries never touches a
 *    byte of the raw EDGAR cache, which is why this lives in its own directory.
 *
 * 2. **Single-flight.** The cache only helps the *second* request. A cold start
 *    with four browser tabs open on the same company would otherwise fan out
 *    into four full EDGAR sequences and four parses, all racing to write the
 *    same entry. `SingleFlight` collapses concurrent work on one key to one
 *    execution and hands every caller the same result.
 *
 * Nothing secret is written here. The stored body is a `CompanyView` built from
 * public filing data; EDGAR is unauthenticated and this process holds no
 * credential to leak.
 */
import type { CacheEntry, CacheStore } from '../src/data/cache/store.ts';
import { isFresh } from '../src/data/cache/store.ts';
import { extractionFingerprint } from './extraction-fingerprint.ts';

/** Default location. Separate from `.cache/edgar` so derived views can be retired alone. */
export const DEFAULT_SEGMENTS_CACHE_DIR = '.cache/segments';

/**
 * The stamp is no longer a constant a human edits.
 *
 * It was `'v1'`, and it stayed `'v1'` through a correct extraction fix, so the
 * cache went on serving the figures the fix had corrected. `extractionFingerprint`
 * derives the stamp from the bytes of the code instead, so it cannot be
 * forgotten. This export remains only to name the scheme in the key, so a cache
 * directory written by an older build is never mistaken for a current one.
 */
export const SEGMENTS_CACHE_SCHEME = 'fp1';

/** Carried with every entry, so a cached value can explain why it was trusted. */
export const SEGMENTS_CACHE_REASON =
  'Immutable. A built segment view is a deterministic function of one accession and the code that ' +
  'read it, and accessioned bytes never change - a correction is a new accession, not an edit to ' +
  'an old one. Three things retire this entry, none of which needs a human to remember: the route ' +
  're-resolves which filing is authoritative on every request, so a new 10-K or a new correction ' +
  'is picked up on the submissions index TTL; the key carries the set of filings that existed for ' +
  'the period, so a correction filed after this entry was written cannot hide behind it; and the ' +
  'key carries a fingerprint of the extraction code, so a fix to how figures are read invalidates ' +
  'every view built before it.';

export interface SegmentsKey {
  readonly cik: string;
  readonly form: string;
  /** The filing actually read - the correction when one supersedes, else the original. */
  readonly accession: string;
  /**
   * Every filing that existed for this period when the view was built, oldest
   * first, joined. Without it a correction that does *not* change which
   * accession is read - a cover-page-only amendment, which is a real and common
   * filing - would be invisible to any reader served from cache, because the
   * response's note that a correction exists lives inside the stored body.
   */
  readonly candidates: readonly string[];
}

/** Synthetic, not an EDGAR URL - this artifact has no URL, because EDGAR does not publish it. */
export function segmentsCacheKey(key: SegmentsKey, fingerprint: string): string {
  const candidates = [...key.candidates].sort().join('+');

  return (
    `streamline:segments/${SEGMENTS_CACHE_SCHEME}/${fingerprint}/${key.cik}/${key.form}/` +
    `${key.accession}/${candidates}`
  );
}

/**
 * How a response was obtained. Reported on `x-cache`, because the `provenance`
 * in the body describes the *instance document*'s retrieval, not this cache's -
 * the two can disagree, and conflating them would misreport where the answer
 * came from.
 *
 * `bypass` means the result was deliberately not cacheable: see `cacheable` on
 * `BuiltSegments`.
 */
export type CacheDisposition = 'hit' | 'miss' | 'coalesced' | 'bypass';

/** What the route produced when it had to do the work. */
export interface BuiltSegments {
  readonly status: number;
  /** Already serialized, so a cached and a fresh response are byte-identical. */
  readonly json: string;
  /** `false` for anything that must not be remembered. */
  readonly cacheable: boolean;
}

export interface LoadedSegments extends Omit<BuiltSegments, 'cacheable'> {
  readonly cache: CacheDisposition;
}

/**
 * Collapses concurrent work on one key into one execution.
 *
 * Deliberately not a cache: the entry lives only while the work is in flight.
 * A later request re-runs, which is what keeps accession resolution honest.
 */
export class SingleFlight {
  readonly #pending = new Map<string, Promise<unknown>>();

  run<T>(
    key: string,
    work: () => Promise<T>,
  ): { readonly promise: Promise<T>; readonly leader: boolean } {
    const existing = this.#pending.get(key) as Promise<T> | undefined;

    if (existing !== undefined) return { promise: existing, leader: false };

    const promise = (async () => work())().finally(() => {
      this.#pending.delete(key);
    });

    this.#pending.set(key, promise);

    return { promise, leader: true };
  }

  /** In-flight key count. For tests and the health surface, not for control flow. */
  get size(): number {
    return this.#pending.size;
  }
}

export interface SegmentsCacheOptions {
  readonly store: CacheStore;
  /** Seam for tests. Production reads the wall clock. */
  readonly now?: () => number;
  /**
   * The extraction stamp. Defaults to the real fingerprint of the code on disk.
   * Injected in tests so a change to extraction can be simulated without editing
   * a source file.
   */
  readonly fingerprint?: () => Promise<string>;
  /** Where a degraded-cache warning goes. Defaults to `console.warn`. */
  readonly warn?: (message: string) => void;
}

export class SegmentsCache {
  readonly #store: CacheStore;
  readonly #now: () => number;
  readonly #fingerprint: () => Promise<string>;
  readonly #warn: (message: string) => void;
  readonly #views = new SingleFlight();
  readonly #resolutions = new SingleFlight();

  constructor(options: SegmentsCacheOptions) {
    this.#store = options.store;
    this.#now = options.now ?? Date.now;
    this.#fingerprint = options.fingerprint ?? extractionFingerprint;
    this.#warn = options.warn ?? ((message) => console.warn(message));
  }

  /**
   * Coalesces accession resolution.
   *
   * Resolution itself is never cached here - it must re-run per request so a new
   * filing surfaces on the submissions TTL. But four tabs arriving at once
   * should ask EDGAR which accession is current *once*, not four times, or the
   * burst spends four requests of the rate budget before the real work starts.
   */
  async resolve<T>(cik: string, form: string, work: () => Promise<T>): Promise<T> {
    return this.#resolutions.run(`${cik}|${form}`, work).promise;
  }

  /** A built view for one accession: from the store, from a peer in flight, or built now. */
  async load(key: SegmentsKey, build: () => Promise<BuiltSegments>): Promise<LoadedSegments> {
    const url = await this.#keyFor(key);

    // No stamp, no cache. The alternative - fall back to a fixed string - is the
    // exact defect this replaced: entries that outlive the code that built them.
    // A process that cannot fingerprint itself still serves correct figures; it
    // just rebuilds them every time and says so on `x-cache`.
    if (url === null) {
      const built = await build();

      return { status: built.status, json: built.json, cache: 'bypass' };
    }

    const cached = await this.#store.get(url);

    if (cached !== null && isFresh(cached, this.#now())) {
      return { status: cached.status, json: cached.body, cache: 'hit' };
    }

    const { promise, leader } = this.#views.run(url, async () => {
      const built = await build();

      if (built.cacheable) await this.#remember(url, built);

      return built;
    });

    const built = await promise;

    if (!built.cacheable) return { status: built.status, json: built.json, cache: 'bypass' };

    return { status: built.status, json: built.json, cache: leader ? 'miss' : 'coalesced' };
  }

  /** `null` when the stamp cannot be computed, which disables the cache rather than faking it. */
  async #keyFor(key: SegmentsKey): Promise<string | null> {
    try {
      return segmentsCacheKey(key, await this.#fingerprint());
    } catch (cause: unknown) {
      this.#warn(
        'Segment view caching is disabled for this process: the extraction fingerprint could ' +
          'not be computed, and a cache with no honest stamp would serve figures built by code ' +
          `that no longer exists. Views are correct but rebuilt on every request. Cause: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
      );

      return null;
    }
  }

  /**
   * A failed write must not fail a good answer. The view in hand is built and
   * boundary-validated; losing the copy on disk costs a rebuild, nothing more.
   * Reported, never swallowed silently.
   */
  async #remember(url: string, built: BuiltSegments): Promise<void> {
    try {
      await this.#store.set(this.#entryFor(url, built));
    } catch (cause: unknown) {
      this.#warn(
        `Could not store the built segment view (${url}). The response is unaffected; it will ` +
          `be rebuilt next time. Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }

  #entryFor(url: string, built: BuiltSegments): CacheEntry {
    return {
      url,
      body: built.json,
      contentType: 'application/json; charset=utf-8',
      etag: null,
      lastModified: null,
      status: built.status,
      storedAt: this.#now(),
      // `null` is the store's encoding of "immutable". See SEGMENTS_CACHE_REASON.
      expiresAt: null,
      reason: SEGMENTS_CACHE_REASON,
    };
  }
}
