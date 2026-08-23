/**
 * Keel's shared fixture harness (protocol §2: `tests/infra/` is Keel's).
 *
 * Every fixture here is a VERBATIM capture of the live proxy's response bytes,
 * saved with `curl` and never edited. That is not a convenience — Invariant 4.5
 * forbids invented companies and seeded demo numbers, and hand-constructing a
 * `CompanyView` would mean inventing `SourceRef`s, which is inventing
 * provenance. A captured response is real EDGAR data that really passed
 * Ledger's pipeline, so a test written against it is a test against the thing
 * that actually ships.
 *
 * The files live under `src/app/sources/fixtures/` and are read with `fs` from
 * here rather than imported, which keeps `resolveJsonModule` out of the build
 * config and keeps 32KB of financial data out of the application bundle.
 * Repo-root `fixtures/` is Adversary's attack corpus and is a different thing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Repo root, resolved the same way under both vitest environments.
 *
 * A jsdom suite's `import.meta.url` is an `http://localhost/...` URL, not a
 * `file:` one, so `fileURLToPath` throws there. Node-environment suites get a
 * real file URL. Both paths are exercised by the suites in this repo, so both
 * are handled rather than one being assumed.
 */
export function repoRoot(): string {
  try {
    return fileURLToPath(new URL('../../', import.meta.url));
  } catch {
    return `${process.cwd()}/`;
  }
}

const FIXTURE_DIR = `${repoRoot()}src/app/sources/fixtures/`;

export const FIXTURES = {
  /** Microsoft FY2026 10-K. 200, `kind: 'view'`, `view.kind: 'renderable'`, 3 segments. */
  msft: 'msft-0000789019-segments.json',
  /** Exxon Mobil, SIC 2911. 200, `kind: 'view'`, `view.kind: 'out-of-coverage'`. */
  xom: 'xom-0000034088-segments.json',
} as const;

export type FixtureName = keyof typeof FIXTURES;

export const MSFT_CIK = '0000789019';
export const XOM_CIK = '0000034088';

/** The raw bytes, exactly as the proxy sent them. */
export function readFixtureText(name: FixtureName): string {
  return readFileSync(`${FIXTURE_DIR}${FIXTURES[name]}`, 'utf8');
}

/** The parsed envelope, still `unknown` — nothing here asserts a shape the boundary owns. */
export function readFixtureEnvelope(name: FixtureName): unknown {
  return JSON.parse(readFixtureText(name));
}

/**
 * The `view` member of a captured envelope, untyped on purpose.
 *
 * Tests feed this to `companyBoundary` and take the branded value back. A helper
 * that returned `CompanyView` directly would hand out an unvalidated object with
 * a validated-looking type, which is the exact hole Invariant 4.3 closes.
 */
export function readFixtureView(name: FixtureName): unknown {
  const envelope = readFixtureEnvelope(name);

  if (typeof envelope !== 'object' || envelope === null || !('view' in envelope)) {
    throw new Error(`Fixture ${name} has no \`view\` member; it is not a segments envelope.`);
  }

  return (envelope as { view: unknown }).view;
}

/**
 * A `fetch` stand-in that answers the segments route from captured bytes.
 *
 * Used by both the EDGAR source test and the second-source test. It returns a
 * real `Response`, so the source under test exercises its real status handling
 * and its real `.json()` path rather than a shortcut.
 */
export function fixtureFetch(
  routes: Readonly<Record<string, { readonly status: number; readonly body: string }>>,
): typeof fetch {
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const match = routes[url];

    if (match === undefined) {
      return Promise.resolve(
        new Response(JSON.stringify({ kind: 'not-found-in-fixture', url }), { status: 404 }),
      );
    }

    return Promise.resolve(
      new Response(match.body, {
        status: match.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }) as typeof fetch;
}
