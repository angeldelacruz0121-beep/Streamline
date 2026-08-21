/**
 * The cache contract. One entry per URL, carrying enough to revalidate cheaply
 * (`ETag`, `Last-Modified`) and enough to explain itself (`reason`).
 *
 * A cache hit costs no rate-limit budget - the limiter is acquired inside the
 * transport, after the cache lookup misses. That is the single largest lever
 * this project has for staying inside 10 requests per second.
 */

export interface CacheEntry {
  readonly url: string;
  /** Response body as text. Every EDGAR resource this client reads is text. */
  readonly body: string;
  readonly contentType: string | null;
  readonly etag: string | null;
  readonly lastModified: string | null;
  /** 200 for a hit, 404 for a cached absence. Nothing else is stored. */
  readonly status: number;
  readonly storedAt: number;
  /** `null` means immutable: accessioned bytes that will never change. */
  readonly expiresAt: number | null;
  /** Why this lifetime. Carried with the data so it can be audited, not just documented. */
  readonly reason: string;
}

export interface CacheStore {
  get(url: string): Promise<CacheEntry | null>;
  set(entry: CacheEntry): Promise<void>;
  delete(url: string): Promise<void>;
  clear(): Promise<void>;
}

/** `true` when the entry may be served without asking EDGAR. */
export function isFresh(entry: CacheEntry, nowEpochMs: number): boolean {
  return entry.expiresAt === null || entry.expiresAt > nowEpochMs;
}

/**
 * Default store. Process-lifetime only; `server/file-cache.ts` persists the
 * immutable half across runs, which is where the real saving is.
 */
export class MemoryCacheStore implements CacheStore {
  readonly #entries = new Map<string, CacheEntry>();

  get(url: string): Promise<CacheEntry | null> {
    return Promise.resolve(this.#entries.get(url) ?? null);
  }

  set(entry: CacheEntry): Promise<void> {
    this.#entries.set(entry.url, entry);

    return Promise.resolve();
  }

  delete(url: string): Promise<void> {
    this.#entries.delete(url);

    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.#entries.clear();

    return Promise.resolve();
  }

  get size(): number {
    return this.#entries.size;
  }
}
