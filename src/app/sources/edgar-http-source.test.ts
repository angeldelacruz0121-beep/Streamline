// @vitest-environment node
/**
 * The pipeline boundary, tested at the place JSON enters the process.
 *
 * The load-bearing tests in this file are the two that prove a refusal is not a
 * failure and a failure is not a crash: Exxon's 200 arrives as a normal `view`
 * result carrying `out-of-coverage`, and a malformed payload arrives as
 * `invalid-payload` carrying issues rather than throwing. Everything else is
 * scaffolding around those two.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createEdgarHttpSource,
  decodeSegmentsEnvelope,
  padCik,
  segmentsPath,
  toSourceProvenance,
  validateView,
} from './edgar-http-source';
import {
  MSFT_CIK,
  XOM_CIK,
  fixtureFetch,
  readFixtureEnvelope,
  readFixtureText,
  readFixtureView,
} from '../../../tests/infra/company-fixtures';

const MSFT_URL = `/api/edgar/company/${MSFT_CIK}/segments`;
const XOM_URL = `/api/edgar/company/${XOM_CIK}/segments`;

function sourceOver(routes: Readonly<Record<string, { status: number; body: string }>>) {
  return createEdgarHttpSource({ fetchImpl: fixtureFetch(routes) });
}

describe('cik canonicalisation', () => {
  it('collapses padded and unpadded forms of one filer onto one url', () => {
    expect(padCik('789019')).toBe(MSFT_CIK);
    expect(padCik('0000789019')).toBe(MSFT_CIK);
    expect(segmentsPath('789019')).toBe(segmentsPath('0000789019'));
  });
});

describe('a renderable filer', () => {
  it('returns a validated view carrying the reported figures unchanged', async () => {
    const source = sourceOver({ [MSFT_URL]: { status: 200, body: readFixtureText('msft') } });
    const result = await source.fetchCompanyView({ companyId: '789019' });

    expect(result.kind).toBe('view');
    if (result.kind !== 'view') return;
    expect(result.view.kind).toBe('renderable');
    if (result.view.kind !== 'renderable') return;

    expect(result.view.segments).toHaveLength(3);
    expect(result.view.segments.map((segment) => segment.operatingIncome.value)).toEqual([
      83_879_000_000, 56_972_000_000, 14_386_000_000,
    ]);
    expect(result.view.trunk.netEarnings.value).toBe(133_749_000_000);
    expect(result.view.trunk.residual.value).toBe(21_488_000_000);
    expect(result.view.reconciliation.segmentRevenueTotal.value).toBe(331_839_000_000);
  });

  it('maps edgar provenance down to the source-neutral shape without naming edgar', async () => {
    const source = sourceOver({ [MSFT_URL]: { status: 200, body: readFixtureText('msft') } });
    const result = await source.fetchCompanyView({ companyId: MSFT_CIK });

    expect(result.kind).toBe('view');
    if (result.kind !== 'view' || result.provenance === null) throw new Error('no provenance');

    expect(result.provenance.sourceId).toBe('sec-edgar');
    expect(result.provenance.url).toContain('sec.gov');
    expect(result.provenance.documentId).toBe('0001193125-26-323660');
    // `fetchedAt`/`accession` are EDGAR's names; the app's vocabulary is its own.
    expect(Object.keys(result.provenance).sort()).toEqual([
      'documentId',
      'expiresAt',
      'fromCache',
      'resource',
      'retrievedAt',
      'sourceId',
      'status',
      'url',
    ]);
  });
});

describe('a 200 that refuses to draw', () => {
  /**
   * Decision 0012. This is the test that would fail if someone ever "fixed" the
   * out-of-coverage path by turning it into an error.
   */
  it('delivers out-of-coverage as an ordinary view, never as a failure', async () => {
    const source = sourceOver({ [XOM_URL]: { status: 200, body: readFixtureText('xom') } });
    const result = await source.fetchCompanyView({ companyId: '34088' });

    expect(result.kind).toBe('view');
    if (result.kind !== 'view') return;
    expect(result.view.kind).toBe('out-of-coverage');
    if (result.view.kind !== 'out-of-coverage') return;

    expect(result.view.entity.sic).toBe('2911');
    expect(result.view.detail.length).toBeGreaterThan(0);
    expect(result.view.ranges).toEqual([
      [3570, 3579],
      [7370, 7379],
    ]);
  });
});

describe('the failing-input gate (Invariant 4.3, runtime half)', () => {
  it('rejects a malformed company object with issues instead of throwing', async () => {
    const source = sourceOver({
      [MSFT_URL]: {
        status: 200,
        body: JSON.stringify({ kind: 'view', provenance: null, view: { kind: 'renderable' } }),
      },
    });

    const result = await source.fetchCompanyView({ companyId: MSFT_CIK });

    expect(result.kind).toBe('invalid-payload');
    if (result.kind !== 'invalid-payload') return;
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((issue) => typeof issue.message === 'string')).toBe(true);
  });

  it('rejects a figure whose provenance was stripped, and names the path', () => {
    const view = structuredClone(readFixtureView('msft')) as {
      segments: { revenue: { provenance?: unknown } }[];
    };
    delete view.segments[0]!.revenue.provenance;

    const result = decodeSegmentsEnvelope(200, { kind: 'view', provenance: null, view });

    expect(result.kind).toBe('invalid-payload');
    if (result.kind !== 'invalid-payload') return;
    expect(result.issues.some((issue) => issue.path.join('.').includes('revenue'))).toBe(true);
  });

  it('rejects a figure whose derived provenance carries no inputs', () => {
    const view = structuredClone(readFixtureView('msft')) as {
      segments: { revenue: { provenance: unknown } }[];
    };
    view.segments[0]!.revenue.provenance = {
      kind: 'derived',
      method: 'summed',
      assumption: 'the parts are the whole',
      inputs: [],
    };

    const result = decodeSegmentsEnvelope(200, { kind: 'view', provenance: null, view });

    expect(result.kind).toBe('invalid-payload');
  });

  it('never mints a validated value for input the schema rejects', () => {
    const outcome = validateView({ kind: 'renderable' }, null);

    expect(outcome.ok).toBe(false);
  });

  it('does not throw for any of the malformed shapes above', () => {
    for (const body of [null, 42, 'text', {}, { kind: 'view' }, { kind: 'view', view: null }]) {
      expect(() => decodeSegmentsEnvelope(200, body)).not.toThrow();
    }
  });
});

describe('transport failures, and only transport failures', () => {
  it('maps an edgar failure body onto the source-neutral failure kinds', () => {
    const provenance = {
      url: 'https://www.sec.gov/x',
      resource: 'submissions',
      fetchedAt: '2026-08-21T12:00:00.000Z',
      fromCache: false,
      expiresAt: null,
      accession: null,
      status: 429,
    };

    const result = decodeSegmentsEnvelope(429, {
      kind: 'rate-limited',
      provenance,
      attempts: 4,
      retryAfterMs: 1200,
      detail: 'EDGAR throttled the request and the retry budget was exhausted.',
    });

    expect(result.kind).toBe('source-failure');
    if (result.kind !== 'source-failure') return;
    expect(result.failure.kind).toBe('rate-limited');
    expect(result.failure.retryAfterMs).toBe(1200);
    expect(result.failure.provenance?.documentId).toBeNull();
  });

  it('treats an unrecognised error body as a transport error rather than guessing', () => {
    const result = decodeSegmentsEnvelope(502, '<html>bad gateway</html>');

    expect(result.kind).toBe('source-failure');
    if (result.kind !== 'source-failure') return;
    expect(result.failure.kind).toBe('transport-error');
    expect(result.failure.status).toBe(502);
  });

  it('treats an unknown 200 envelope kind as a schema mismatch', () => {
    const result = decodeSegmentsEnvelope(200, { kind: 'something-new', view: {} });

    expect(result.kind).toBe('source-failure');
    if (result.kind !== 'source-failure') return;
    expect(result.failure.kind).toBe('schema-mismatch');
  });

  it('reports a thrown fetch as a transport error and an aborted one as aborted', async () => {
    const failing = createEdgarHttpSource({
      fetchImpl: vi.fn().mockRejectedValue(new Error('socket hang up')) as unknown as typeof fetch,
    });

    const plain = await failing.fetchCompanyView({ companyId: MSFT_CIK });
    expect(plain.kind).toBe('source-failure');
    if (plain.kind === 'source-failure') expect(plain.failure.kind).toBe('transport-error');

    const controller = new AbortController();
    controller.abort();
    const aborted = await failing.fetchCompanyView({ companyId: MSFT_CIK }, controller.signal);
    expect(aborted.kind).toBe('source-failure');
    if (aborted.kind === 'source-failure') expect(aborted.failure.kind).toBe('aborted');
  });
});

describe('the incomplete-accession envelope', () => {
  it('is a view with a missing list, not a failure', () => {
    const envelope = readFixtureEnvelope('xom') as { view: unknown };
    const result = decodeSegmentsEnvelope(200, {
      kind: 'incomplete-accession',
      provenance: null,
      missing: ['R-files', 'MetaLinks.json'],
      view: envelope.view,
    });

    expect(result.kind).toBe('incomplete-accession');
    if (result.kind !== 'incomplete-accession') return;
    expect(result.missing).toEqual(['R-files', 'MetaLinks.json']);
    expect(result.view.kind).toBe('out-of-coverage');
  });
});

describe('provenance mapping', () => {
  it('carries the source id and loses only the fields the app must not branch on', () => {
    const mapped = toSourceProvenance({
      url: 'https://www.sec.gov/Archives/x.xml',
      resource: 'archive-document',
      fetchedAt: '2026-08-21T12:46:13.629Z',
      fromCache: true,
      expiresAt: null,
      accession: '0001193125-26-323660',
      status: 200,
    });

    expect(mapped).toEqual({
      sourceId: 'sec-edgar',
      url: 'https://www.sec.gov/Archives/x.xml',
      resource: 'archive-document',
      retrievedAt: '2026-08-21T12:46:13.629Z',
      fromCache: true,
      expiresAt: null,
      documentId: '0001193125-26-323660',
      status: 200,
    });
  });
});
