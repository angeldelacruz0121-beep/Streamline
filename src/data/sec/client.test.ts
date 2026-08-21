// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryCacheStore } from '../cache/store.ts';
import {
  dailyIndexCompanyText,
  dailyIndexFormText,
  dailyIndexMasterText,
  microsoftFilingIndex,
  microsoftSubmissions,
  MICROSOFT_ENTITY_NAME,
  MICROSOFT_FACTS_ENTITY_NAME,
  MICROSOFT_10K_ACCESSION,
  MICROSOFT_10K_PERIOD_END,
  MICROSOFT_CIK,
  MICROSOFT_SIC,
  tickerMap,
} from './__fixtures__/microsoft.ts';
import {
  PROBE_ACCESSION_INCOMPLETE,
  PROBE_ACCESSION_ORIGINAL,
  PROBE_CIK,
  probeArchiveIndexComplete,
  probeArchiveIndexIncomplete,
  probeSubmissions,
  probeSubmissionsOverflow,
  TEST_CONTACT_EMAIL,
} from './__fixtures__/shape-probes.ts';
import { createEdgarClient, type EdgarClient } from './client.ts';
import { resetRateLimiterForTests } from './rate-limit.ts';
import { startEdgarDouble, type EdgarDouble } from './testing/edgar-double.ts';

let double: EdgarDouble;
let client: EdgarClient;

const json = (value: unknown): string => JSON.stringify(value);

function routeEverything(): void {
  double.route('/files/company_tickers.json', { status: 200, body: json(tickerMap) });
  double.route(`/submissions/CIK${MICROSOFT_CIK}.json`, {
    status: 200,
    body: json(microsoftSubmissions),
  });
  double.route(`/submissions/CIK${PROBE_CIK}.json`, { status: 200, body: json(probeSubmissions) });
  double.route(`/submissions/CIK${PROBE_CIK}-submissions-001.json`, {
    status: 200,
    body: json(probeSubmissionsOverflow),
  });
  double.route(`/api/xbrl/companyfacts/CIK${MICROSOFT_CIK}.json`, {
    status: 200,
    // companyfacts really does use `entityName`, and really does spell the filer's
    // name differently from submissions. Both are live-verified (2026-08-20).
    body: json({ cik: 789019, entityName: MICROSOFT_FACTS_ENTITY_NAME, facts: {} }),
  });
  double.route(`/api/xbrl/companyconcept/CIK${MICROSOFT_CIK}/us-gaap/Revenues.json`, {
    status: 200,
    body: json({
      cik: 789019,
      taxonomy: 'us-gaap',
      tag: 'Revenues',
      label: 'Revenues',
      description: 'Amount of revenue recognized.',
      entityName: MICROSOFT_FACTS_ENTITY_NAME,
      units: {},
    }),
  });
  double.route('/Archives/edgar/data/0/000000000000000001/index.json', {
    status: 200,
    body: json(probeArchiveIndexComplete),
  });
  double.route('/Archives/edgar/data/0/000000000000000004/index.json', {
    status: 200,
    body: json(probeArchiveIndexIncomplete),
  });
  double.route('/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm', {
    status: 200,
    body: '<html><body>primary document</body></html>',
    headers: { 'content-type': 'text/html' },
  });
  double.route('/Archives/edgar/data/789019/000119312526323660/index.json', {
    status: 200,
    body: json(microsoftFilingIndex),
  });

  for (const [kind, body] of [
    ['master', dailyIndexMasterText],
    ['form', dailyIndexFormText],
    ['company', dailyIndexCompanyText],
  ] as const) {
    double.route(`/Archives/edgar/daily-index/2026/QTR3/${kind}.20260819.idx`, {
      status: 200,
      body,
      headers: { 'content-type': 'application/octet-stream' },
    });
  }

  // The same day served with the wrong internal format - a format change, which
  // must not look like a quiet day.
  double.route('/Archives/edgar/daily-index/2026/QTR3/master.20260818.idx', {
    status: 200,
    body: dailyIndexFormText,
    headers: { 'content-type': 'application/octet-stream' },
  });
}

beforeAll(async () => {
  double = await startEdgarDouble();
});

afterAll(async () => {
  await double.close();
});

beforeEach(() => {
  double.reset();
  routeEverything();
  resetRateLimiterForTests();
  client = createEdgarClient({
    contactEmail: TEST_CONTACT_EMAIL,
    transport: double.transport,
    cache: new MemoryCacheStore(),
  });
});

describe('company lookup', () => {
  it('resolves a ticker to a zero-padded CIK', async () => {
    const result = await client.resolveCik('msft');

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.cik).toBe(MICROSOFT_CIK);
  });

  it('returns a typed absence for an unlisted ticker', async () => {
    const result = await client.resolveCik('NOT-A-TICKER');

    expect(result.kind).toBe('not-found');
    expect(result.kind === 'not-found' && result.detail).toContain('NOT-A-TICKER');
  });
});

describe('submissions', () => {
  it('reads the verified Microsoft filing index', async () => {
    const result = await client.getSubmissions(MICROSOFT_CIK);

    expect(result.kind).toBe('ok');

    if (result.kind !== 'ok') return;

    expect(result.value.cik).toBe(MICROSOFT_CIK);
    expect(result.value.sic).toBe(MICROSOFT_SIC);
    expect(result.value.filings.records[0]?.accession).toBe(MICROSOFT_10K_ACCESSION);
    expect(result.value.filings.records[0]?.reportDate).toBe(MICROSOFT_10K_PERIOD_END);
    expect(result.value.filings.malformedRows).toBe(0);
    // Read from the submissions document's `name`. There is no `entityName` there;
    // requiring one is what broke the first live request.
    expect(result.value.entityName).toBe(MICROSOFT_ENTITY_NAME);
    // Present on the live document, contrary to the earlier comment in filings.ts.
    expect(result.value.filerCategory).toBe('Large accelerated filer');
    // Microsoft really does have two overflow files; the captured fixture keeps them.
    expect(result.value.historyTruncated).toBe(true);
    expect(result.provenance.resource).toBe('submissions');
    expect(result.provenance.expiresAt).not.toBeNull();
  });

  it('says when older history exists that it did not fetch', async () => {
    const result = await client.getFilingSeries(PROBE_CIK, '10-K');

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.every((entry) => entry.historyTruncated)).toBe(
      true,
    );
  });

  it('fetches the overflow history when asked, and then stops claiming truncation', async () => {
    const result = await client.getFilingSeries(PROBE_CIK, '10-K', { includeHistory: true });

    expect(result.kind).toBe('ok');

    if (result.kind !== 'ok') return;

    expect(result.value).toHaveLength(3);
    expect(result.value.every((entry) => entry.historyTruncated)).toBe(false);
    expect(double.requestsFor('submissions-001')).toHaveLength(1);
  });

  it('reports a malformed envelope as a typed mismatch, not a crash', async () => {
    double.route(`/submissions/CIK${MICROSOFT_CIK}.json`, { status: 200, body: json({ cik: 1 }) });

    const result = await client.getSubmissions(MICROSOFT_CIK);

    expect(result.kind).toBe('schema-mismatch');
    expect(result.kind === 'schema-mismatch' && result.issues.length).toBeGreaterThan(0);
  });

  it('reports an HTML error page served with status 200 as a mismatch', async () => {
    double.route(`/submissions/CIK${MICROSOFT_CIK}.json`, {
      status: 200,
      body: '<html>EDGAR is temporarily unavailable</html>',
    });

    const result = await client.getSubmissions(MICROSOFT_CIK);

    expect(result.kind).toBe('schema-mismatch');
    expect(result.kind === 'schema-mismatch' && result.detail).toContain('not JSON');
  });

  it('reports an unknown CIK as a typed absence', async () => {
    double.route(`/submissions/CIK${MICROSOFT_CIK}.json`, { status: 404 });

    const result = await client.getSubmissions(MICROSOFT_CIK);

    expect(result.kind).toBe('not-found');
    expect(result.provenance.status).toBe(404);
  });
});

describe('payloads Conduit deliberately does not interpret', () => {
  it('hands company facts back as text, unparsed', async () => {
    const result = await client.getCompanyFacts(MICROSOFT_CIK);

    expect(result.kind).toBe('ok');

    if (result.kind !== 'ok') return;

    expect(Object.keys(result.value).sort()).toEqual(['contentType', 'text']);
    expect(typeof result.value.text).toBe('string');
  });

  it('hands a company concept back as text, unparsed', async () => {
    const result = await client.getCompanyConcept(MICROSOFT_CIK, 'us-gaap', 'Revenues');

    expect(result.kind).toBe('ok');

    if (result.kind !== 'ok') return;

    expect(Object.keys(result.value).sort()).toEqual(['contentType', 'text']);
    expect(result.value.text).toContain('us-gaap');
  });

  it('hands an archive document back as text and never re-fetches it', async () => {
    const first = await client.getArchiveDocument(
      MICROSOFT_CIK,
      MICROSOFT_10K_ACCESSION,
      'msft-20260630.htm',
    );
    const second = await client.getArchiveDocument(
      MICROSOFT_CIK,
      MICROSOFT_10K_ACCESSION,
      'msft-20260630.htm',
    );

    expect(first.kind).toBe('ok');
    expect(first.kind === 'ok' && first.value.contentType).toContain('text/html');
    expect(first.provenance.expiresAt).toBeNull();
    expect(second.provenance.fromCache).toBe(true);
    expect(double.requestsFor('msft-20260630.htm')).toHaveLength(1);
  });

  it('refuses a traversing archive file name', async () => {
    await expect(
      client.getArchiveDocument(MICROSOFT_CIK, MICROSOFT_10K_ACCESSION, '../../etc/passwd'),
    ).rejects.toThrow();
  });
});

describe('accession contents', () => {
  it('returns the inventory when the filing carries what a dimensional read needs', async () => {
    const result = await client.getFilingIndex(PROBE_CIK, PROBE_ACCESSION_ORIGINAL);

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.instanceDocument).toBe('probe-20231231_htm.xml');
    expect(result.kind === 'ok' && result.value.rFiles).toHaveLength(2);
  });

  it('returns incomplete-xbrl - with the inventory attached - when it does not', async () => {
    const result = await client.getFilingIndex(PROBE_CIK, PROBE_ACCESSION_INCOMPLETE);

    expect(result.kind).toBe('incomplete-xbrl');

    if (result.kind !== 'incomplete-xbrl') return;

    expect(result.missing).toContain('xbrl-instance');
    expect(result.available).toEqual(['probe-paper.htm']);
    expect(result.value.accession).toBe(PROBE_ACCESSION_INCOMPLETE);
    expect(result.detail).toContain('segment');
  });
});

describe('daily index', () => {
  const DAY = '2026-08-19';

  it('parses the master feed, which is pipe-delimited', async () => {
    const result = await client.getDailyIndex(DAY);

    expect(result.kind).toBe('ok');

    if (result.kind !== 'ok') return;

    expect(result.value).toHaveLength(3);
    expect(result.value[0]?.form).toBe('424B2');
    expect(result.value[0]?.cik).toBe('1000275');
    expect(result.value[0]?.companyName).toBe('ROYAL BANK OF CANADA');
    // Normalised from the feed's `20260819`.
    expect(result.value[0]?.filingDate).toBe(DAY);
    expect(result.value[0]?.accession).toBe('0000950103-26-012581');
  });

  it('parses the form feed, which is fixed width rather than delimited', async () => {
    const result = await client.getDailyIndex(DAY, 'form');

    expect(result.kind).toBe('ok');

    if (result.kind !== 'ok') return;

    expect(result.value).toHaveLength(4);
    expect(result.value[0]?.form).toBe('1-A/A');
    expect(result.value[0]?.companyName).toBe('Casa Shares Assets, LLC');
    expect(result.value[0]?.cik).toBe('1988874');
    // A row whose filing date differs from the index date - real, and kept.
    expect(result.value[1]?.filingDate).toBe('2026-08-17');
    // EDGAR's own truncation of a form type to the 17-column field.
    expect(result.value[2]?.form).toBe('SEC STAFF ACTIO');
    expect(result.value[2]?.companyName).toBe('HUTURE Group Ltd');
    // A form type containing a space still belongs to the form column, not the name.
    expect(result.value[3]?.form).toBe('DEF 14A');
    expect(result.value[3]?.companyName).toBe('ADVENT CONVERTIBLE & INCOME FUND');
  });

  it('parses the company feed, where the leading column is the name instead', async () => {
    const result = await client.getDailyIndex(DAY, 'company');

    expect(result.kind).toBe('ok');

    if (result.kind !== 'ok') return;

    expect(result.value).toHaveLength(4);
    expect(result.value[0]?.companyName).toBe('1290 Funds');
    expect(result.value[0]?.form).toBe('485APOS');
    // 60 characters, against a 62-column field: the tightest real boundary case.
    expect(result.value[2]?.companyName).toBe(
      'Encompass Health Rehabilitation Hospital of Albuquerque, LLC',
    );
    expect(result.value[2]?.form).toBe('S-3ASR');
    // An amended late-filing notification, carried through intact.
    expect(result.value[3]?.form).toBe('NT 10-Q/A');
  });

  it('reports a format change as schema-mismatch, never as a day with no filings', async () => {
    const result = await client.getDailyIndex('2026-08-18');

    expect(result.kind).toBe('schema-mismatch');

    if (result.kind !== 'schema-mismatch') return;

    expect(result.detail).toContain('format');
    expect(result.issues[0]?.message).toContain('none parsed');
  });
});
