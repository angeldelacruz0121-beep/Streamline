// Test infrastructure. Never imported by production code - `compliance.test.ts`
// asserts that, so this file cannot become a back door around the transport.
//
// A real `node:http` server on an ephemeral port, following the pattern Keel
// proved in `tests/infra/test-infrastructure.test.ts`. Real sockets matter here:
// the User-Agent gate is only meaningfully tested if something outside the
// process observes the header that was actually sent.
//
// The transport it hands back rewrites data.sec.gov / www.sec.gov URLs onto the
// local origin while preserving method and headers, so the client under test
// still builds genuine EDGAR URLs - which is what the cache TTL policy keys off.
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { EdgarTransport } from '../transport.ts';
import { userAgentCarriesContact } from '../user-agent.ts';

export interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly userAgent: string | undefined;
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export interface PlannedResponse {
  readonly status: number;
  readonly body?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface EdgarDouble {
  readonly origin: string;
  readonly requests: readonly RecordedRequest[];
  readonly transport: EdgarTransport;
  route(path: string, response: PlannedResponse | readonly PlannedResponse[]): void;
  requestsFor(fragment: string): readonly RecordedRequest[];
  reset(): void;
  close(): Promise<void>;
}

export async function startEdgarDouble(): Promise<EdgarDouble> {
  const routes = new Map<string, PlannedResponse[]>();
  const requests: RecordedRequest[] = [];

  const server: Server = createServer((request, response) => {
    const path = request.url ?? '';

    requests.push({
      method: request.method ?? 'GET',
      path,
      userAgent: request.headers['user-agent'],
      headers: request.headers as Record<string, string | undefined>,
    });

    const planned = routes.get(path.split('?')[0] ?? path);
    const next =
      planned === undefined
        ? undefined
        : planned.length > 1
          ? planned.shift()
          : (planned[0] ?? undefined);

    if (next === undefined) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('no route registered');
      return;
    }

    response.writeHead(next.status, {
      'content-type': 'application/json',
      ...(next.headers ?? {}),
    });
    response.end(next.body ?? '');
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;

  const transport: EdgarTransport = (request) => {
    const target = new URL(request.url);

    return fetch(
      new Request(`${origin}${target.pathname}${target.search}`, {
        method: request.method,
        headers: request.headers,
      }),
    );
  };

  return {
    origin,
    requests,
    transport,
    route(path, response) {
      routes.set(path, Array.isArray(response) ? [...response] : [response as PlannedResponse]);
    },
    requestsFor(fragment) {
      return requests.filter((entry) => entry.path.includes(fragment));
    },
    reset() {
      requests.length = 0;
      routes.clear();
    },
    async close() {
      server.close();
      await once(server, 'close');
    },
  };
}

/**
 * The gate assertion. Applied to every request a suite emitted, not to a chosen
 * one: removing the header from `transport.ts` makes this fail for all of them.
 */
export function assertEveryRequestCarriedContactEmail(requests: readonly RecordedRequest[]): void {
  if (requests.length === 0) {
    throw new Error('No requests were observed, so User-Agent compliance was not actually tested.');
  }

  const offenders = requests.filter(
    (entry) => entry.userAgent === undefined || !userAgentCarriesContact(entry.userAgent),
  );

  if (offenders.length > 0) {
    throw new Error(
      `Invariant 4.6 violated: ${offenders.length} of ${requests.length} requests reached the ` +
        `wire without a User-Agent carrying a contact email. First offender: ` +
        `${offenders[0]?.path} (user-agent: ${JSON.stringify(offenders[0]?.userAgent)}).`,
    );
  }
}
