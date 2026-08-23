/**
 * Filesystem cache for the immutable half of EDGAR.
 *
 * Accessioned documents never change, so the highest-value thing this project
 * can do for its rate budget is never fetch one twice - including across
 * process restarts. Entries are keyed by a hash of the URL and carry the reason
 * for their lifetime, so the cache directory is auditable rather than opaque.
 *
 * Nothing secret is ever written here: EDGAR is unauthenticated, this client
 * sends no credential, and the only header stored is an ETag.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CacheEntry, CacheStore } from '../src/data/cache/store.ts';

export const DEFAULT_CACHE_DIR = '.cache/edgar';

/** The directory vanished between the last write and this one. */
function isMissingDirectory(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { readonly code?: unknown }).code === 'ENOENT'
  );
}

export class FileCacheStore implements CacheStore {
  readonly #dir: string;
  #ready: Promise<void> | null = null;

  constructor(dir: string = DEFAULT_CACHE_DIR) {
    this.#dir = dir;
  }

  async get(url: string): Promise<CacheEntry | null> {
    try {
      const raw = await readFile(this.#pathFor(url), 'utf8');

      return JSON.parse(raw) as CacheEntry;
    } catch {
      return null;
    }
  }

  /**
   * Writes an entry, creating the cache directory if it is not there.
   *
   * The retry is not defensive padding, it is a bug fix. `#ensureDir` remembers
   * that it already created the directory, so once the directory was deleted
   * underneath a running server - which is exactly what clearing a stale cache
   * by hand does - every subsequent write failed with ENOENT and the route
   * turned a perfectly good answer into a transport error. Clearing the cache
   * while the server is up is a normal thing to do, and it now costs one
   * recreated directory instead of a dead route.
   */
  async set(entry: CacheEntry): Promise<void> {
    await this.#ensureDir();

    try {
      await writeFile(this.#pathFor(entry.url), JSON.stringify(entry), 'utf8');
    } catch (cause: unknown) {
      if (!isMissingDirectory(cause)) throw cause;

      this.#ready = null;
      await this.#ensureDir();
      await writeFile(this.#pathFor(entry.url), JSON.stringify(entry), 'utf8');
    }
  }

  async delete(url: string): Promise<void> {
    await rm(this.#pathFor(url), { force: true });
  }

  async clear(): Promise<void> {
    await rm(this.#dir, { force: true, recursive: true });
    this.#ready = null;
  }

  #ensureDir(): Promise<void> {
    this.#ready ??= mkdir(this.#dir, { recursive: true }).then(() => undefined);

    return this.#ready;
  }

  #pathFor(url: string): string {
    return join(this.#dir, `${createHash('sha256').update(url).digest('hex')}.json`);
  }
}
