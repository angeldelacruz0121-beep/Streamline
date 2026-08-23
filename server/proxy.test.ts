// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryCacheStore } from '../src/data/cache/store.ts';
import {
  microsoftFilingIndex,
  microsoftSubmissions,
  MICROSOFT_CIK,
  tickerMap,
} from '../src/data/sec/__fixtures__/microsoft.ts';
// Ledger's captured FY2026 filing, imported read-only. Conduit does not own or
// edit it; the whole point of exercising the route against it is that the wire
// bytes and the extraction under test come from the same capture.
import * as MSFT from '../src/data/normalize/__fixtures__/msft-fy2026.ts';
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
import { createEdgarProxyHandler, shapeIngestResult } from './proxy.ts';
import { SegmentsCache } from './segments-cache.ts';
import * as HP from '../src/data/sec/__fixtures__/hp.ts';

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

  proxy = createServer(
    createEdgarProxyHandler(client, new SegmentsCache({ store: new MemoryCacheStore() })),
  );
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

/** `/Archives/edgar/data/789019/000119312526323660`, as `endpoints.ts` builds it. */
const ARCHIVE = `/Archives/edgar/data/${Number(MSFT.MSFT_CIK)}/${MSFT.MSFT_ACCESSION.replaceAll('-', '')}`;

/** Everything the segment pipeline reads out of one accession. */
const FILING_DOCUMENTS: Readonly<Record<string, string>> = {
  [`${ARCHIVE}/index.json`]: JSON.stringify(microsoftFilingIndex),
  [`${ARCHIVE}/${MSFT.MSFT_INSTANCE_FILE}`]: MSFT.MSFT_INSTANCE_EXCERPT,
  [`${ARCHIVE}/MetaLinks.json`]: MSFT.MSFT_METALINKS_EXCERPT,
  [`${ARCHIVE}/${MSFT.MSFT_SEGMENT_RFILE}`]: MSFT.MSFT_SEGMENT_RFILE_EXCERPT,
};

const M = 1_000_000;
const SEGMENTS_PATH = `/api/edgar/company/${Number(MSFT.MSFT_CIK)}/segments`;

interface SegmentsBody {
  readonly kind: string;
  readonly provenance: { readonly resource: string; readonly url: string } | null;
  readonly filing: {
    readonly accession: string;
    readonly form: string;
    readonly role: string;
    readonly amends: string | null;
    readonly amendmentCount: number;
    readonly unreadAmendments: readonly { readonly accession: string; readonly reason: string }[];
  } | null;
  readonly view: {
    readonly kind: string;
    readonly entity: { readonly name: string };
    readonly filing: { readonly accession: string };
    readonly segments: readonly { readonly label: string }[];
    readonly trunk: {
      readonly segmentOperatingIncomeTotal: { readonly value: number };
      readonly netEarnings: { readonly value: number };
      readonly residual: { readonly value: number };
    };
    readonly reconciliation: {
      readonly consolidatedRevenue: { readonly value: number };
      readonly segmentRevenueTotal: { readonly value: number };
      readonly withinTolerance: boolean;
    };
  };
}

describe('the segments route', () => {
  let segmentsProxy: Server;
  let origin: string;

  beforeEach(async () => {
    // A fresh client cache and a fresh view cache per case. Cache behaviour is
    // the thing under test here, so it must not inherit entries from a peer.
    const client = createEdgarClient({
      contactEmail: TEST_CONTACT_EMAIL,
      transport: double.transport,
      cache: new MemoryCacheStore(),
    });

    segmentsProxy = createServer(
      createEdgarProxyHandler(client, new SegmentsCache({ store: new MemoryCacheStore() })),
    );
    segmentsProxy.listen(0, '127.0.0.1');
    await once(segmentsProxy, 'listening');
    origin = `http://127.0.0.1:${(segmentsProxy.address() as AddressInfo).port}`;

    for (const [path, body] of Object.entries(FILING_DOCUMENTS)) {
      double.route(path, { status: 200, body });
    }
  });

  afterEach(async () => {
    segmentsProxy.close();
    await once(segmentsProxy, 'close');
  });

  it('serves the extracted company view the browser could not build for itself', async () => {
    const response = await fetch(`${origin}${SEGMENTS_PATH}`);
    const body = (await response.json()) as SegmentsBody;

    expect(response.status).toBe(200);
    expect(body.kind).toBe('view');
    expect(body.view.kind).toBe('renderable');
    expect(body.view.entity.name).toBe('MICROSOFT CORP');
    expect(body.view.filing.accession).toBe(MSFT.MSFT_ACCESSION);
    expect(body.view.segments).toHaveLength(3);
  });

  it('says which filing the figures came from, and that it was the original', async () => {
    const response = await fetch(`${origin}${SEGMENTS_PATH}`);
    const body = (await response.json()) as SegmentsBody;

    // Invariant 2.2 is not satisfied by naming an accession alone once
    // corrections are read: a reader has to be able to tell a corrected figure
    // from an original one. Microsoft has never filed a correction, so this is
    // what the clean case looks like.
    expect(body.filing?.role).toBe('original');
    expect(body.filing?.form).toBe('10-K');
    expect(body.filing?.accession).toBe(MSFT.MSFT_ACCESSION);
    expect(body.filing?.amends).toBeNull();
    expect(body.filing?.amendmentCount).toBe(0);
    expect(body.filing?.unreadAmendments).toEqual([]);
  });

  it('returns the figures as filed', async () => {
    const response = await fetch(`${origin}${SEGMENTS_PATH}`);
    const { view } = (await response.json()) as SegmentsBody;

    expect(view.reconciliation.consolidatedRevenue.value).toBe(331_839 * M);
    expect(view.reconciliation.segmentRevenueTotal.value).toBe(331_839 * M);
    expect(view.reconciliation.withinTolerance).toBe(true);
    expect(view.trunk.segmentOperatingIncomeTotal.value).toBe(155_237 * M);
    expect(view.trunk.netEarnings.value).toBe(133_749 * M);
    expect(view.trunk.residual.value).toBe(21_488 * M);
  });

  it('names the document each answer came from', async () => {
    const response = await fetch(`${origin}${SEGMENTS_PATH}`);
    const body = (await response.json()) as SegmentsBody;

    expect(body.provenance?.resource).toBe('archive-document');
    expect(body.provenance?.url).toContain(MSFT.MSFT_INSTANCE_FILE);
  });

  it('never sends the raw instance to the browser', async () => {
    const response = await fetch(`${origin}${SEGMENTS_PATH}`);
    const text = await response.text();

    // Decision 0014: extraction is server-side; the ~10.9MB instance stops here.
    expect(text).not.toContain('<xbrli:xbrl');
    expect(text).not.toContain('contextRef="');
    expect(text.length).toBeLessThan(200_000);
  });

  it('issues one EDGAR sequence cold and none at all warm', async () => {
    await fetch(`${origin}${SEGMENTS_PATH}`);

    const cold = double.requests.length;

    expect(cold).toBe(5);
    expect(double.requestsFor('/submissions/')).toHaveLength(1);
    expect(double.requestsFor(MSFT.MSFT_INSTANCE_FILE)).toHaveLength(1);

    const warm = await fetch(`${origin}${SEGMENTS_PATH}`);

    expect(warm.status).toBe(200);
    expect(warm.headers.get('x-cache')).toBe('hit');
    // Not one further byte off the wire, and not one further parse of a 10.9MB
    // instance: the whole reason this route has a derived cache.
    expect(double.requests).toHaveLength(cold);
  });

  it('serves a cached view byte-identical to the one it was built from', async () => {
    const first = await (await fetch(`${origin}${SEGMENTS_PATH}`)).text();
    const second = await fetch(`${origin}${SEGMENTS_PATH}`);

    expect(second.headers.get('x-cache')).toBe('hit');
    expect(await second.text()).toBe(first);
  });

  it('collapses a burst of tabs into one EDGAR sequence and one parse', async () => {
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => fetch(`${origin}${SEGMENTS_PATH}`)),
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
    }

    expect(double.requestsFor('/submissions/')).toHaveLength(1);
    expect(double.requestsFor(MSFT.MSFT_INSTANCE_FILE)).toHaveLength(1);
    expect(double.requests).toHaveLength(5);

    const dispositions = responses.map((response) => response.headers.get('x-cache'));

    expect(dispositions.filter((value) => value === 'miss')).toHaveLength(1);
    expect(dispositions.filter((value) => value === 'coalesced')).toHaveLength(3);
  });

  it('carries a compliant User-Agent on every upstream request the route makes', async () => {
    await fetch(`${origin}${SEGMENTS_PATH}`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (browser pretending to be a client)',
        authorization: 'Bearer probe-token',
      },
    });

    assertEveryRequestCarriedContactEmail(double.requests);

    for (const request of double.requests) {
      expect(request.headers['authorization']).toBeUndefined();
      expect(request.userAgent).not.toContain('Mozilla');
    }
  });

  it('maps a transport failure through the shared status table, not through the view', async () => {
    double.reset();
    resetRateLimiterForTests();

    const response = await fetch(`${origin}${SEGMENTS_PATH}`);
    const body = (await response.json()) as { kind: string };

    expect(response.status).toBe(404);
    expect(body.kind).toBe('not-found');
    expect(response.headers.get('x-cache')).toBe('bypass');
  });

  it('refuses anything but GET, like every other route', async () => {
    const response = await fetch(`${origin}${SEGMENTS_PATH}`, { method: 'POST' });

    expect(response.status).toBe(405);
    expect(double.requests).toHaveLength(0);
  });

  it('accepts no form or accession parameter, so the heavy pipeline cannot be aimed', async () => {
    const response = await fetch(`${origin}/api/edgar/company/789019/segments/10-K`);

    expect(response.status).toBe(404);
    expect(double.requests).toHaveLength(0);
  });
});

const ENTITY = {
  cik: MSFT.MSFT_CIK,
  name: 'MICROSOFT CORP',
  sic: '1311',
  sicDescription: 'Crude Petroleum and Natural Gas',
  filerCategory: 'Large accelerated filer',
  tickers: ['MSFT'],
  exchanges: ['Nasdaq'],
};

const PROVENANCE = {
  url: 'https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630_htm.xml',
  resource: 'archive-document',
  fetchedAt: '2026-08-21T00:00:00.000Z',
  fromCache: false,
  expiresAt: null,
  accession: MSFT.MSFT_ACCESSION,
  status: 200,
} as const;

describe('IngestResult to HTTP, per decision 0012', () => {
  it('sends a refusal state at 200, because a refusal is a designed UI state', () => {
    const built = shapeIngestResult(
      {
        kind: 'view',
        provenance: PROVENANCE,
        view: {
          kind: 'out-of-coverage',
          entity: ENTITY,
          detail: 'Crude petroleum is outside the covered SIC ranges.',
          ranges: [
            [3570, 3579],
            [7370, 7379],
          ],
        },
      } as never,
      null,
    );

    expect(built.status).toBe(200);
    expect(JSON.parse(built.json)).toMatchObject({
      kind: 'view',
      view: { kind: 'out-of-coverage' },
    });
  });

  it('does not cache out-of-coverage, which is decided from a mutable index', () => {
    const built = shapeIngestResult(
      {
        kind: 'view',
        provenance: PROVENANCE,
        view: {
          kind: 'out-of-coverage',
          entity: ENTITY,
          detail: 'Crude petroleum is outside the covered SIC ranges.',
          ranges: [[3570, 3579]],
        },
      } as never,
      null,
    );

    expect(built.cacheable).toBe(false);
  });

  it('sends incomplete-accession at 200 with its missing list, and does not cache it', () => {
    const built = shapeIngestResult(
      {
        kind: 'incomplete-accession',
        missing: ['xbrl-instance'],
        view: {
          kind: 'incomplete-filing',
          entity: { ...ENTITY, sic: '7372', sicDescription: 'Services-Prepackaged Software' },
          filing: null,
          missing: ['xbrl-instance'],
          detail: 'This accession carries no XBRL instance document.',
        },
      } as never,
      null,
    );

    expect(built.status).toBe(200);
    expect(built.cacheable).toBe(false);
    expect(JSON.parse(built.json)).toMatchObject({
      kind: 'incomplete-accession',
      missing: ['xbrl-instance'],
      // The open seam recorded at the call site: this arm carries no provenance.
      provenance: null,
    });
  });

  it.each([
    ['not-found', 404],
    ['rate-limited', 429],
    ['transport-error', 502],
    ['schema-mismatch', 502],
  ])('maps a %s failure onto %i, unchanged from the shared table', (kind, status) => {
    const built = shapeIngestResult(
      {
        kind: 'transport-failure',
        failure: { kind, provenance: PROVENANCE, detail: 'probe', attempts: 1, issues: [] },
      } as never,
      null,
    );

    expect(built.status).toBe(status);
    expect(built.cacheable).toBe(false);
    expect(JSON.parse(built.json)).toMatchObject({ kind });
  });

  it('refuses to serialize a view that fails the pipeline boundary', () => {
    expect(() =>
      shapeIngestResult(
        {
          kind: 'view',
          provenance: PROVENANCE,
          // A renderable with no segments: representable in TypeScript, refused by
          // the schema, and never sent or cached.
          view: { kind: 'renderable', entity: ENTITY, segments: [] },
        } as never,
        null,
      ),
    ).toThrow(/pipeline boundary/i);
  });
});

describe('the segments route, when a correction cannot be inspected', () => {
  let server: Server;
  let at: string;

  /** HP's own rows, cut off at the day its FY2022 correction was filed. */
  function hpAsOf(filedOnOrBefore: string): unknown {
    const columns = HP.HP_10K_FILING_COLUMNS;
    const keep = columns.filingDate
      .map((date, index) => ({ date, index }))
      .filter((row) => row.date <= filedOnOrBefore)
      .map((row) => row.index);

    return {
      ...HP.hpSubmissions,
      filings: {
        ...HP.hpSubmissions.filings,
        recent: Object.fromEntries(
          Object.entries(columns).map(([name, values]) => [name, keep.map((i) => values[i])]),
        ),
      },
    };
  }

  beforeEach(async () => {
    const client = createEdgarClient({
      contactEmail: TEST_CONTACT_EMAIL,
      transport: double.transport,
      cache: new MemoryCacheStore(),
    });

    server = createServer(
      createEdgarProxyHandler(client, new SegmentsCache({ store: new MemoryCacheStore() })),
    );
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    at = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    double.route(`/submissions/CIK${HP.HP_CIK}.json`, {
      status: 200,
      body: JSON.stringify(hpAsOf('2023-09-11')),
    });
    double.route(
      `/Archives/edgar/data/47217/${HP.HP_FY2022_AMENDMENT.replaceAll('-', '')}/index.json`,
      { status: 404 },
    );
  });

  afterEach(async () => {
    server.close();
    await once(server, 'close');
  });

  it('refuses instead of quietly serving the figure the filer withdrew', async () => {
    const response = await fetch(`${at}/api/edgar/company/47217/segments`);
    const body = (await response.json()) as { readonly kind: string; readonly detail: string };

    // HP corrected its FY2022 annual report. If the correction cannot be read,
    // the honest answer is "we cannot show you this", not the superseded
    // original dressed up as a current figure.
    expect(response.status).toBe(404);
    expect(body.kind).toBe('not-found');
    expect(body.detail).toContain('deliberately not served');
    expect(response.headers.get('x-cache')).toBe('bypass');
  });
});

describe('the segments route, CIK identity', () => {
  it('treats a padded and an unpadded CIK as one company, not two cache entries', async () => {
    const client = createEdgarClient({
      contactEmail: TEST_CONTACT_EMAIL,
      transport: double.transport,
      cache: new MemoryCacheStore(),
    });
    const server = createServer(
      createEdgarProxyHandler(client, new SegmentsCache({ store: new MemoryCacheStore() })),
    );

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const at = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    for (const [path, body] of Object.entries(FILING_DOCUMENTS)) {
      double.route(path, { status: 200, body });
    }

    try {
      const unpadded = await fetch(`${at}/api/edgar/company/789019/segments`);
      const padded = await fetch(`${at}/api/edgar/company/0000789019/segments`);

      expect(unpadded.headers.get('x-cache')).toBe('miss');
      expect(padded.headers.get('x-cache')).toBe('hit');
      expect(await padded.text()).toBe(await unpadded.text());
    } finally {
      server.close();
      await once(server, 'close');
    }
  });
});
