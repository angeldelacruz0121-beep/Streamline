/**
 * The single choke point. Every EDGAR request in this project is issued here.
 *
 * Order matters and is the enforcement mechanism: the User-Agent is composed
 * and asserted, then the process-global rate slot is acquired, and only then is
 * the injected transport called. Both controls sit *upstream* of the seam, so
 * an injected transport - the thing that makes this testable - structurally
 * cannot route around either one. It receives a fully-formed `Request` whose
 * headers are already compliant and whose slot is already spent.
 *
 * There is deliberately no way for a caller to supply headers. The public API
 * takes a URL and an `Accept`, and nothing else, so "override the User-Agent"
 * is not a thing the type system permits anyone to express.
 *
 * `compliance.test.ts` fails if any other file in `src/data/sec`, `src/data/cache`
 * or `server` calls `fetch` directly.
 */
import { type CacheEntry, type CacheStore, isFresh } from '../cache/store.ts';
import { expiresAtFor, ttlFor } from '../cache/ttl-policy.ts';
import {
  backoffDelayMs,
  isRetryableStatus,
  MAX_ATTEMPTS,
  MAX_HONORED_RETRY_AFTER_MS,
  parseRetryAfter,
} from './backoff.ts';
import { accessionFromUrl, classifyUrl } from './endpoints.ts';
import type { EdgarProvenance } from './errors.ts';
import { acquireRateLimitSlot, pauseRateLimiter } from './rate-limit.ts';
import { assertCompliantUserAgent } from './user-agent.ts';

/** The seam. Production passes `nativeFetchTransport`; tests pass a double. */
export type EdgarTransport = (request: Request) => Promise<Response>;

export const nativeFetchTransport: EdgarTransport = (request) => fetch(request);

export interface EdgarFetchOptions {
  readonly url: string;
  readonly accept: string;
  readonly userAgent: string;
  readonly transport: EdgarTransport;
  readonly cache: CacheStore;
  readonly random?: (() => number) | undefined;
  /** Acceptance instant of the owning filing, when known - feeds the TTL policy. */
  readonly filedAtEpochMs?: number | null;
}

export type RawOutcome =
  | { readonly kind: 'body'; readonly entry: CacheEntry; readonly provenance: EdgarProvenance }
  | { readonly kind: 'not-found'; readonly provenance: EdgarProvenance; readonly detail: string }
  | {
      readonly kind: 'rate-limited';
      readonly provenance: EdgarProvenance;
      readonly attempts: number;
      readonly retryAfterMs: number | null;
      readonly detail: string;
    }
  | {
      readonly kind: 'transport-error';
      readonly provenance: EdgarProvenance;
      readonly attempts: number;
      readonly detail: string;
    };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function provenanceFor(
  url: string,
  status: number | null,
  fromCache: boolean,
  expiresAt: number | null,
): EdgarProvenance {
  const resource = classifyUrl(url);

  if (resource === null) {
    throw new Error(`Unrecognised EDGAR URL: ${url}. Build URLs with endpoints.ts.`);
  }

  return {
    url,
    resource,
    fetchedAt: new Date().toISOString(),
    fromCache,
    expiresAt: expiresAt === null ? null : new Date(expiresAt).toISOString(),
    accession: accessionFromUrl(url),
    status,
  };
}

export async function fetchEdgar(options: EdgarFetchOptions): Promise<RawOutcome> {
  const { url, accept, userAgent, transport, cache } = options;
  const cached = await cache.get(url);

  if (cached !== null && isFresh(cached, Date.now())) {
    // A cache hit never touches the limiter. That is the point of the cache.
    const provenance = provenanceFor(url, cached.status, true, cached.expiresAt);

    return cached.status === 404
      ? { kind: 'not-found', provenance, detail: 'EDGAR previously returned 404 for this URL.' }
      : { kind: 'body', entry: cached, provenance };
  }

  let lastDetail = 'No attempt was made.';
  let lastStatus: number | null = null;
  let lastRetryAfter: number | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    // Asserted on every attempt, not once at construction: a header that lost
    // its contact address cannot leave this process.
    assertCompliantUserAgent(userAgent);

    const headers = new Headers({
      'user-agent': userAgent,
      accept,
      'accept-encoding': 'gzip, deflate',
    });

    if (cached !== null && cached.status === 200) {
      if (cached.etag !== null) headers.set('if-none-match', cached.etag);
      if (cached.lastModified !== null) headers.set('if-modified-since', cached.lastModified);
    }

    await acquireRateLimitSlot();

    let response: Response;

    try {
      response = await transport(new Request(url, { method: 'GET', headers }));
    } catch (cause) {
      lastDetail = `Network failure: ${cause instanceof Error ? cause.message : String(cause)}`;

      if (attempt === MAX_ATTEMPTS) break;

      await sleep(backoffDelayMs(attempt, null, options.random));
      continue;
    }

    lastStatus = response.status;

    if (response.status === 200) {
      const body = await response.text();
      const now = Date.now();
      const decision = ttlFor(url, {
        now,
        filedAtEpochMs: options.filedAtEpochMs ?? null,
      });
      const entry: CacheEntry = {
        url,
        body,
        contentType: response.headers.get('content-type'),
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
        status: 200,
        storedAt: now,
        expiresAt: expiresAtFor(decision, now),
        reason: decision.reason,
      };

      await cache.set(entry);

      return { kind: 'body', entry, provenance: provenanceFor(url, 200, false, entry.expiresAt) };
    }

    if (response.status === 304 && cached !== null) {
      // Revalidated: same bytes, new lifetime. Cheapest possible outcome that
      // still proves freshness.
      const now = Date.now();
      const decision = ttlFor(url, { now, filedAtEpochMs: options.filedAtEpochMs ?? null });
      const refreshed: CacheEntry = {
        ...cached,
        storedAt: now,
        expiresAt: expiresAtFor(decision, now),
        reason: decision.reason,
      };

      await cache.set(refreshed);

      return {
        kind: 'body',
        entry: refreshed,
        provenance: provenanceFor(url, 304, true, refreshed.expiresAt),
      };
    }

    if (response.status === 404) {
      const now = Date.now();
      const decision = ttlFor(url, { now, negative: true });

      await cache.set({
        url,
        body: '',
        contentType: null,
        etag: null,
        lastModified: null,
        status: 404,
        storedAt: now,
        expiresAt: expiresAtFor(decision, now),
        reason: decision.reason,
      });

      return {
        kind: 'not-found',
        provenance: provenanceFor(url, 404, false, null),
        detail: 'EDGAR returned 404. The resource does not exist at this URL.',
      };
    }

    if (response.status === 403) {
      // Not retryable. EDGAR answers 403 to a request it considers unidentified;
      // repeating it is how an IP gets blocked.
      return {
        kind: 'transport-error',
        provenance: provenanceFor(url, 403, false, null),
        attempts: attempt,
        detail:
          'EDGAR returned 403 Forbidden. This is how EDGAR rejects a request it considers ' +
          'unidentified or abusive. Not retried.',
      };
    }

    if (!isRetryableStatus(response.status)) {
      return {
        kind: 'transport-error',
        provenance: provenanceFor(url, response.status, false, null),
        attempts: attempt,
        detail: `EDGAR returned ${response.status} ${response.statusText}. Not retryable.`,
      };
    }

    const now = Date.now();

    lastRetryAfter = parseRetryAfter(response.headers.get('retry-after'), now);
    lastDetail = `EDGAR returned ${response.status}.`;

    if (lastRetryAfter !== null && lastRetryAfter > MAX_HONORED_RETRY_AFTER_MS) {
      // Honoured as an instruction rather than slept through: hold the whole
      // process off EDGAR for the stated interval, and hand the caller a state
      // it can render instead of a request that hangs for minutes.
      pauseRateLimiter(now + lastRetryAfter);

      return {
        kind: 'rate-limited',
        provenance: provenanceFor(url, response.status, false, null),
        attempts: attempt,
        retryAfterMs: lastRetryAfter,
        detail:
          `EDGAR returned ${response.status} with Retry-After ${Math.round(lastRetryAfter / 1_000)}s, ` +
          'longer than this client will sleep inside a request. Traffic is paused process-wide.',
      };
    }

    const delay = backoffDelayMs(attempt, lastRetryAfter, options.random);

    // A throttle aimed at one request applies to the whole process.
    pauseRateLimiter(now + delay);

    if (attempt === MAX_ATTEMPTS) break;

    await sleep(delay);
  }

  const provenance = provenanceFor(url, lastStatus, false, null);

  if (lastStatus === 429 || lastStatus === 503) {
    return {
      kind: 'rate-limited',
      provenance,
      attempts: MAX_ATTEMPTS,
      retryAfterMs: lastRetryAfter,
      detail: `${lastDetail} Retry budget of ${MAX_ATTEMPTS} attempts exhausted.`,
    };
  }

  return {
    kind: 'transport-error',
    provenance,
    attempts: MAX_ATTEMPTS,
    detail: `${lastDetail} Retry budget of ${MAX_ATTEMPTS} attempts exhausted.`,
  };
}
