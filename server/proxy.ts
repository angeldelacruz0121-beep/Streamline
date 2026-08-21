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
import type { EdgarResult } from '../src/data/sec/errors.ts';
import { getRateLimiterState } from '../src/data/sec/rate-limit.ts';

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

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

export function createEdgarProxyHandler(
  client: EdgarClient,
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
