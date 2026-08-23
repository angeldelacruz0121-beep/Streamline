/**
 * A cache stamp that changes by itself when the code that builds a view changes.
 *
 * The problem this replaces, exactly as it happened on 2026-08-23: derived
 * segment views were stamped with a version string a human typed
 * (`SEGMENTS_CACHE_VERSION = 'v1'`). Extraction was fixed, nobody edited the
 * string, and seventeen stale views were served afterwards - including
 * Autodesk's superseded $1,124M - until the cache was deleted by hand. A stamp
 * that depends on somebody remembering is not a stamp. Angel's ruling: the app
 * may not forget that a fix happened.
 *
 * So the stamp is the content of the code itself. Every TypeScript file under
 * the directories that can change a built view is hashed, together with the
 * dependency manifest, into one digest. Change extraction, change a schema,
 * change this route's envelope, upgrade the XBRL parser - the digest moves and
 * every previously stored view is unreachable on the next request. Nobody has to
 * remember anything.
 *
 * The two failure directions, stated rather than traded silently:
 *
 * UNDER-INVALIDATION - a stale figure surviving a fix - is what matters, and
 * within these roots it is impossible: the digest is over file bytes, so any
 * edit that could change a figure changes the digest. Directories are walked
 * recursively, so a file added tomorrow is covered without anyone listing it.
 * The residual is honest and narrow: extraction logic moved to a *new top-level
 * directory* outside `src/data`, `src/types` and `server` would escape the hash.
 * That is a structural move, not an edit, and `ROOTS` below is the one place it
 * would have to be recorded. It is the only human step left and it is named here
 * rather than hidden.
 *
 * OVER-INVALIDATION - rebuilding more than necessary - is real and accepted: a
 * comment edited in `rate-limit.ts` retires every stored view. The cost of that
 * is a re-parse, not SEC requests. Raw EDGAR bytes live in a different cache
 * (`.cache/edgar`), keyed by URL, and accessioned documents are immutable there,
 * so a rebuild re-reads the instance from local disk and spends no rate budget.
 * Paying CPU to be certain a correction is never hidden is the right side of
 * that trade, and it is the side Angel chose.
 *
 * Cost of computing it: one directory walk of a few hundred kilobytes of source,
 * once per process, memoized below. Not per request.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/**
 * Everything whose bytes can change a built view. Recursive.
 *
 * `src/data` holds extraction, normalization, validation and this process's
 * EDGAR access. `src/types` holds the boundary and branded types those compile
 * against. `server` holds the route that shapes the envelope and the cache that
 * stores it. A change anywhere in here can change what a reader sees.
 */
export const ROOTS = ['src/data', 'src/types', 'server'] as const;

/**
 * Hashed alongside the source. A `zod` or `fast-xml-parser` upgrade changes what
 * extraction produces without changing one line of our code, and a stamp that
 * missed that would under-invalidate.
 */
export const MANIFESTS = ['package.json', 'package-lock.json'] as const;

/**
 * Test files are excluded. They cannot change a view - nothing in the request
 * path imports them - and including them would retire every cached view every
 * time a test is edited, which is most edits.
 */
const EXCLUDED = /\.test\.tsx?$/;
const INCLUDED = /\.tsx?$/;

async function filesUnder(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!INCLUDED.test(entry.name) || EXCLUDED.test(entry.name)) continue;

    files.push(join(entry.parentPath, entry.name));
  }

  return files.sort();
}

/**
 * The digest, computed fresh. Throws if a root cannot be read - see
 * `segments-cache.ts` for what the caller does with that, which is not "carry
 * on with a fixed string".
 */
export async function computeExtractionFingerprint(cwd: string = process.cwd()): Promise<string> {
  const hash = createHash('sha256');
  const paths: string[] = [];

  for (const root of ROOTS) paths.push(...(await filesUnder(join(cwd, root))));
  for (const manifest of MANIFESTS) paths.push(join(cwd, manifest));

  for (const path of paths.sort()) {
    const bytes = await readFile(path);

    // The path is hashed with the bytes so that moving a file - which can change
    // behaviour - moves the digest even when no byte of content changed.
    hash.update(relative(cwd, path).split(sep).join('/'));
    hash.update('\0');
    hash.update(bytes);
    hash.update('\0');
  }

  if (paths.length === 0) {
    throw new Error(
      `No source files found under ${ROOTS.join(', ')}. Refusing to produce a cache stamp that ` +
        'would be identical for every version of the code.',
    );
  }

  return hash.digest('hex').slice(0, 16);
}

let pending: Promise<string> | null = null;

/** Memoized for the life of the process. The source cannot change under a running server. */
export function extractionFingerprint(): Promise<string> {
  pending ??= computeExtractionFingerprint();

  return pending;
}

/** Test seam. Not used in the request path. */
export function resetExtractionFingerprint(): void {
  pending = null;
}
