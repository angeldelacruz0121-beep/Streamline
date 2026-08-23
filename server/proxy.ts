/**
 * The local EDGAR proxy.
 *
 * It exists because a browser cannot reach EDGAR compliantly. A custom
 * User-Agent makes the request non-simple, which triggers a CORS preflight
 * EDGAR does not answer, and a page cannot hold one 10-requests-per-second
 * budget across tabs anyway. So every EDGAR request in this project is issued
 * by Node, and the browser talks only to this.
 *
 * Closed by construction: there is no URL parameter. Each route names a
 * resource and builds its own EDGAR URL through `endpoints.ts`, so this cannot
 * be turned into an open proxy. Inbound headers are never forwarded upstream -
 * the client composes its own, and an `Authorization` header sent here is
 * dropped rather than relayed.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { EdgarClient } from '../src/data/sec/client.ts';
import { padCik } from '../src/data/sec/endpoints.ts';
import type { EdgarResult } from '../src/data/sec/errors.ts';
import { getRateLimiterState } from '../src/data/sec/rate-limit.ts';
import {
  resolveAuthoritativeFiling,
  type AuthoritativeFiling,
} from '../src/data/sec/authoritative.ts';
import { ingestAnnualSegments, type IngestResult } from '../src/data/normalize/ingest.ts';
import { companyBoundary } from '../src/data/validate/company-schema.ts';
import { BoundaryValidationError } from '../src/types/boundary.ts';
import type { BuiltSegments, LoadedSegments, SegmentsCache } from './segments-cache.ts';

const STATUS_BY_KIND = {
  ok: 200,
  'incomplete-xbrl': 200,
  'not-found': 404,
  'rate-limited': 429,
  'transport-error': 502,
  'schema-mismatch': 502,
} as const;

type Handler = (client: EdgarClient, params: readonly string[]) => Promise<EdgarResult<unknown>>;

interface Route {
  readonly pattern: RegExp;
  readonly handle: Handler;
}

const decode = (value: string | undefined): string => decodeURIComponent(value ?? '');

const ROUTES: readonly Route[] = [
  {
    pattern: /^\/api\/edgar\/ticker\/([^/]+)$/,
    handle: (client, [ticker]) => client.resolveCik(decode(ticker)),
  },
  {
    pattern: /^\/api\/edgar\/company\/(\d{1,10})\/submissions$/,
    handle: (client, [cik]) => client.getSubmissions(decode(cik)),
  },
  {
    pattern: /^\/api\/edgar\/company\/(\d{1,10})\/facts$/,
    handle: (client, [cik]) => client.getCompanyFacts(decode(cik)),
  },
  {
    pattern: /^\/api\/edgar\/company\/(\d{1,10})\/concept\/([^/]+)\/([^/]+)$/,
    handle: (client, [cik, taxonomy, tag]) =>
      client.getCompanyConcept(decode(cik), decode(taxonomy), decode(tag)),
  },
  {
    pattern: /^\/api\/edgar\/company\/(\d{1,10})\/series\/([^/]+)$/,
    handle: (client, [cik, form]) => client.getFilingSeries(decode(cik), decode(form)),
  },
  {
    pattern: /^\/api\/edgar\/filing\/(\d{1,10})\/([\d-]{18,20})\/index$/,
    handle: (client, [cik, accession]) => client.getFilingIndex(decode(cik), decode(accession)),
  },
  {
    pattern: /^\/api\/edgar\/filing\/(\d{1,10})\/([\d-]{18,20})\/document\/([^/]+)$/,
    handle: (client, [cik, accession, file]) =>
      client.getArchiveDocument(decode(cik), decode(accession), decode(file)),
  },
  {
    pattern: /^\/api\/edgar\/daily\/(\d{4}-\d{2}-\d{2})$/,
    handle: (client, [date]) => client.getDailyIndex(decode(date)),
  },
];

/**
 * The ninth resource, kept out of `ROUTES` for one reason: it does not return an
 * `EdgarResult`. It returns Ledger's `IngestResult`, whose arms are a validated
 * `CompanyView` rather than an EDGAR payload, so the shared `Handler` type and
 * the shared status mapping do not fit it. Everything else about it - a named
 * resource, no URL parameter, no inbound header relayed, GET only - is the same
 * as its eight siblings.
 */
const SEGMENTS_PATTERN = /^\/api\/edgar\/company\/(\d{1,10})\/segments$/;

/**
 * The only form this route serves. Not a query parameter: an open `form` would
 * let a caller aim the heaviest pipeline in the process at arbitrary filings.
 * A quarterly variant is a new named route when one is wanted.
 */
const SEGMENTS_FORM = '10-K';

/**
 * Which filing the segments route ingests, re-derived on every request.
 *
 * Until 2026-08-23 this took the period's *original* filing and dropped its
 * corrections on the floor. A filer that found a mistake, corrected it, and
 * filed a 10-K/A got the withdrawn figure served with no sign the correction
 * existed. Angel's ruling reversed that: the correction is what a reader sees,
 * because a company files one when it has found a mistake, and the corrected
 * number is the accurate one. `resolveAuthoritativeFiling` holds the rule and
 * the reason it has a qualifier.
 *
 * Re-deriving per request is deliberate and it is the reason the derived cache
 * can be immutable. The built view is cached against the filing it came from and
 * never expires; if resolution were cached with it, a newly filed 10-K - or a
 * newly filed correction - would stay invisible until something evicted the
 * entry. Re-resolving means a new filing appears exactly when the *submissions*
 * index TTL lets it, one hour during EDGAR acceptance hours, which is the
 * schedule that actually governs when new filings exist.
 *
 * Costs no extra rate budget for a period with no correction, which is every
 * filer in the corpus today: `getFilingSeries` derives from the submissions
 * document, which `ingestAnnualSegments` was going to fetch anyway, and the
 * second read of it is a cache hit. A period *with* a correction costs that
 * correction's archive index and its report index - two requests against
 * accessioned bytes, cached forever after the first.
 */

/**
 * `IngestResult` -> an HTTP status and a body, per decision 0012 (Ledger A1).
 *
 * Every arm of `CompanyView` is a designed UI state, refusals included:
 * out-of-coverage, segment-identity-unresolved, reconciliation-break,
 * incomplete-filing and no-segment-disclosure are findings the product renders,
 * not errors. None of them is an HTTP error, so all of them are 200. Only a
 * `transport-failure` - EDGAR itself failing - maps through `STATUS_BY_KIND`,
 * unchanged and shared with the other eight routes.
 *
 * The view passes `companyBoundary.parse` before it is serialized or stored, so
 * nothing that fails the pipeline boundary can reach the browser or the cache.
 *
 * Exported for its own test: the three arms and the refusal states are cheaper
 * and more completely provable here than through a socket.
 */
export function shapeIngestResult(
  result: IngestResult,
  filing: AuthoritativeFiling | null,
): BuiltSegments {
  if (result.kind === 'transport-failure') {
    return {
      status: STATUS_BY_KIND[result.failure.kind],
      json: JSON.stringify(result.failure),
      cacheable: false,
    };
  }

  const view = companyBoundary.parse(result.view);

  if (result.kind === 'incomplete-accession') {
    return {
      status: 200,
      json: JSON.stringify({
        kind: 'incomplete-accession',
        // OPEN SEAM - cross-boundary note to Ledger, not an oversight.
        //
        // `IngestResult`'s `incomplete-accession` arm (src/data/normalize/ingest.ts:785-789)
        // carries `view` and `missing` but no `provenance`, where the `view` arm
        // carries one. So this response cannot say which EDGAR document
        // established that the accession was incomplete, and Invariant 2.2 asks
        // every rendered state to name its source. Angel ruled: ship `null`,
        // record the seam, do not work around it in this file - synthesizing a
        // provenance here would be Conduit inventing a source Ledger did not
        // report. Fixed by adding `provenance: EdgarProvenance` to that arm,
        // which is Ledger's change to make. The vertical slice does not
        // exercise this path.
        provenance: null,
        filing,
        missing: result.missing,
        view,
      }),
      // Not cached, on purpose. EDGAR generates the R-files and MetaLinks for a
      // few hours after acceptance, so "this accession has no XBRL instance"
      // read on filing day is a settling listing, not a final fact - the same
      // hazard `TTL-POLICY.md` refinement 1 records for `index.json`. Caching it
      // immutably would pin a real filing as permanently incomplete.
      cacheable: false,
    };
  }

  return {
    status: 200,
    json: JSON.stringify({ kind: 'view', provenance: result.provenance, filing, view }),
    // `out-of-coverage` is decided from the submissions index (SIC), not from
    // accessioned bytes, so it is not immutable the way the rest of the union
    // is and is not keyed correctly by accession. Left uncached rather than
    // cached under a key that could not notice the input changing.
    cacheable: view.kind !== 'out-of-coverage',
  };
}

async function handleSegments(
  client: EdgarClient,
  cache: SegmentsCache,
  rawCik: string,
): Promise<LoadedSegments> {
  const form = SEGMENTS_FORM;
  // Both `789019` and `0000789019` reach this route and mean the same filer.
  // Keying the cache on the raw path segment would give one company two
  // entries and two parses, so the CIK is normalised to EDGAR's own padded
  // form before it is used as an identity anywhere.
  const cik = padCik(rawCik);
  const selection = await cache.resolve(cik, form, () =>
    resolveAuthoritativeFiling(client, cik, form),
  );

  // A correction exists and EDGAR would not say what is in it. Serving the
  // original here is the one thing the ruling forbids: it would show a figure
  // the filer has withdrawn, and it would look exactly like a correct answer.
  // The failure's own status carries through - 429 stays 429, 404 stays 404.
  if (selection.kind === 'unresolved') {
    const failure = { ...selection.failure, detail: selection.detail };

    return {
      status: STATUS_BY_KIND[failure.kind],
      json: JSON.stringify(failure),
      cache: 'bypass',
    };
  }

  if (selection.kind === 'none') {
    // No filing of this form can be named. Run the ingest unpinned and do not
    // cache it, so Ledger produces its own typed failure with its own
    // provenance rather than this file inventing a message.
    const built = shapeIngestResult(await ingestAnnualSegments(client, cik, { form }), null);

    return { status: built.status, json: built.json, cache: 'bypass' };
  }

  const filing = selection.filing;
  const build = async (): Promise<BuiltSegments> =>
    shapeIngestResult(
      await ingestAnnualSegments(client, cik, { form, accession: filing.accession }),
      filing,
    );

  return cache.load(
    { cik, form, accession: filing.accession, candidates: filing.periodFilings },
    build,
  );
}

function sendJson(
  response: ServerResponse,
  status: number,
  json: string,
  headers: Readonly<Record<string, string>> = {},
): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(json);
}

function send(response: ServerResponse, status: number, body: unknown): void {
  sendJson(response, status, JSON.stringify(body));
}

export function createEdgarProxyHandler(
  client: EdgarClient,
  segments: SegmentsCache,
): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');

    if (request.method !== 'GET') {
      send(response, 405, { kind: 'method-not-allowed', detail: 'This proxy is read-only.' });
      return;
    }

    if (pathname === '/api/edgar/health') {
      send(response, 200, { kind: 'ok', rateLimiter: getRateLimiterState() });
      return;
    }

    const segmentsMatch = SEGMENTS_PATTERN.exec(pathname);

    if (segmentsMatch !== null) {
      handleSegments(client, segments, decode(segmentsMatch[1]))
        .then((loaded) => {
          sendJson(response, loaded.status, loaded.json, { 'x-cache': loaded.cache });
        })
        .catch((cause: unknown) => {
          if (cause instanceof BoundaryValidationError) {
            // Server-side extraction produced an object the pipeline boundary
            // refuses. 502, not 400: the caller did nothing wrong, and this
            // must never degrade into shipping the object anyway.
            send(response, 502, {
              kind: 'schema-mismatch',
              issues: cause.issues,
              detail:
                'Segment extraction produced a company object that does not satisfy the pipeline ' +
                'boundary, so it was not sent. This is a server-side defect, not a bad request.',
            });
            return;
          }

          send(response, 400, {
            kind: 'transport-error',
            detail: cause instanceof Error ? cause.message : String(cause),
          });
        });

      return;
    }

    for (const route of ROUTES) {
      const match = route.pattern.exec(pathname);

      if (match === null) continue;

      route
        .handle(client, match.slice(1) as string[])
        .then((result) => {
          send(response, STATUS_BY_KIND[result.kind], result);
        })
        .catch((cause: unknown) => {
          send(response, 400, {
            kind: 'transport-error',
            detail: cause instanceof Error ? cause.message : String(cause),
          });
        });

      return;
    }

    send(response, 404, {
      kind: 'not-found',
      detail: `No EDGAR route for ${pathname}. This proxy exposes named resources only.`,
    });
  };
}
