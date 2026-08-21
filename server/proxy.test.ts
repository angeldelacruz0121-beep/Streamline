// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryCacheStore } from '../src/data/cache/store.ts';
import {
  microsoftSubmissions,
  MICROSOFT_CIK,
  tickerMap,
} from '../src/data/sec/__fixtures__/microsoft.ts';
import {
  probeArchiveIndexIncomplete,
  PROBE_ACCESSION_INCOMPLETE,
  PROBE_CIK,
  TEST_CONTACT_EMAIL,
} from '../src/data/sec/__fixtures__/shape-probes.ts';
import { createEdgarClient } from '../src/data/sec/client.ts';
import { resetRateLimiterForTests } from '../src/data/sec/rate-limit.ts';
import {
  assertEveryRequestCarriedContactEmail,
  startEdgarDouble,
  type EdgarDouble,
} from '../src/data/sec/testing/edgar-double.ts';
import { createEdgarProxyHandler } from './proxy.ts';

let double: EdgarDouble;
let proxy: Server;
let proxyOrigin: string;

beforeAll(async () => {
  double = await startEdgarDouble();

  const client = createEdgarClient({
    contactEmail: TEST_CONTACT_EMAIL,
    transport: double.transport,
    cache: new MemoryCacheStore(),
  });

  proxy = createServer(createEdgarProxyHandler(client));
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');

  proxyOrigin = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
});

afterAll(async () => {
  proxy.close();
  await once(proxy, 'close');
  await double.close();
});

beforeEach(() => {
  double.reset();
  resetRateLimiterForTests();
  double.route('/files/company_tickers.json', { status: 200, body: JSON.stringify(tickerMap) });
  double.route(`/submissions/CIK${MICROSOFT_CIK}.json`, {
    status: 200,
    body: JSON.stringify(microsoftSubmissions),
  });
  double.route('/Archives/edgar/data/0/000000000000000004/index.json', {
    status: 200,
    body: JSON.stringify(probeArchiveIndexIncomplete),
  });
});

describe('EDGAR proxy', () => {
  it('serves a named resource and preserves the typed result', async () => {
    const response = await fetch(`${proxyOrigin}/api/edgar/company/789019/submissions`);
    const body = (await response.json()) as { kind: string; value: { entityName: string } };

    expect(response.status).toBe(200);
    expect(body.kind).toBe('ok');
    expect(body.value.entityName).toBe('MICROSOFT CORP');
  });

  it('sends a compliant User-Agent upstream even though the browser cannot', async () => {
    await fetch(`${proxyOrigin}/api/edgar/ticker/MSFT`, {
      headers: { 'user-agent': 'Mozilla/5.0 (browser pretending to be a client)' },
    });

    assertEveryRequestCarriedContactEmail(double.requests);
    expect(double.requests[0]?.userAgent).not.toContain('Mozilla');
  });

  it('never relays an inbound Authorization header upstream', async () => {
    await fetch(`${proxyOrigin}/api/edgar/ticker/MSFT`, {
      headers: { authorization: 'Bearer probe-token', cookie: 'probe=1' },
    });

    for (const request of double.requests) {
      expect(request.headers['authorization']).toBeUndefined();
      expect(request.headers['cookie']).toBeUndefined();
    }
  });

  it('maps a typed absence onto 404 while keeping the typed body', async () => {
    const response = await fetch(`${proxyOrigin}/api/edgar/ticker/NOPE`);
    const body = (await response.json()) as { kind: string };

    expect(response.status).toBe(404);
    expect(body.kind).toBe('not-found');
  });

  it('keeps an incomplete XBRL exhibit visible rather than flattening it to an error', async () => {
    const response = await fetch(
      `${proxyOrigin}/api/edgar/filing/${Number(PROBE_CIK)}/${PROBE_ACCESSION_INCOMPLETE}/index`,
    );
    const body = (await response.json()) as { kind: string; missing: string[] };

    expect(response.status).toBe(200);
    expect(body.kind).toBe('incomplete-xbrl');
    expect(body.missing).toContain('xbrl-instance');
  });

  it('exposes no arbitrary-URL route, so it cannot be used as an open proxy', async () => {
    const attempts = [
      '/api/edgar/fetch?url=https://example.invalid/',
      '/api/edgar/company/789019/../../etc/passwd',
      '/api/edgar/proxy/https://data.sec.gov/submissions/CIK0000789019.json',
    ];

    for (const attempt of attempts) {
      const response = await fetch(`${proxyOrigin}${attempt}`);

      expect(response.status).toBe(404);
    }

    expect(double.requests).toHaveLength(0);
  });

  it('refuses anything but GET', async () => {
    const response = await fetch(`${proxyOrigin}/api/edgar/company/789019/submissions`, {
      method: 'POST',
    });

    expect(response.status).toBe(405);
    expect(double.requests).toHaveLength(0);
  });

  it('reports the live rate-limiter state for health checks', async () => {
    const response = await fetch(`${proxyOrigin}/api/edgar/health`);
    const body = (await response.json()) as { rateLimiter: { limit: number } };

    expect(response.status).toBe(200);
    expect(body.rateLimiter.limit).toBe(10);
  });
});
