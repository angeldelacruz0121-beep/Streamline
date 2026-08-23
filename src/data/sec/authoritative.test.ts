// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryCacheStore } from '../cache/store.ts';
import {
  hpSubmissions,
  HP_CIK,
  HP_FY2019_AMENDMENT_ARCHIVE_INDEX,
  HP_FY2019_AMENDMENT_FILING_SUMMARY,
  HP_FY2019_COVER_ONLY_AMENDMENT,
  HP_FY2019_ORIGINAL,
  HP_FY2019_PERIOD,
  HP_FY2022_AMENDMENT,
  HP_FY2022_AMENDMENT_ARCHIVE_INDEX,
  HP_FY2022_AMENDMENT_FILING_SUMMARY,
  HP_FY2022_ORIGINAL,
  HP_FY2022_PERIOD,
  HP_LATEST_ACCESSION,
  HP_LATEST_PERIOD,
  HP_10K_FILING_COLUMNS,
} from './__fixtures__/hp.ts';
import { TEST_CONTACT_EMAIL } from './__fixtures__/shape-probes.ts';
import { resolveAuthoritativeFiling } from './authoritative.ts';
import { createEdgarClient, type EdgarClient } from './client.ts';
import { buildFilingSeries, toFilingRecords } from './filings.ts';
import { resetRateLimiterForTests } from './rate-limit.ts';
import { startEdgarDouble, type EdgarDouble } from './testing/edgar-double.ts';

/**
 * HP Inc., against the wire shapes HP actually sends.
 *
 * Microsoft cannot test any of this - it has never filed a correction in
 * thirty-three years, which is what left decision 0011 gap 1 open. HP has filed
 * three, and they are three different cases: one that restates the financials,
 * one that corrects something else entirely, and one filed because the original
 * carried no XBRL at all. Nothing here is invented; every accession, date and
 * report title below came off EDGAR through the proxy on 2026-08-23.
 */
let double: EdgarDouble;
let client: EdgarClient;

const json = (value: unknown): string => JSON.stringify(value);
const archive = (accession: string): string =>
  `/Archives/edgar/data/47217/${accession.replaceAll('-', '')}`;

/**
 * Rewrites the captured submissions so one chosen period is the newest one.
 *
 * HP's newest annual period has no correction - which is the finding, and the
 * reason nothing on screen changes today. To exercise a corrected period the
 * rows filed after it are dropped, exactly as EDGAR's own page would have looked
 * on the day that correction was the latest news. No row is altered.
 */
function submissionsAsOf(filedOnOrBefore: string): unknown {
  const columns = HP_10K_FILING_COLUMNS;
  const keep = columns.filingDate
    .map((date, index) => ({ date, index }))
    .filter((row) => row.date <= filedOnOrBefore)
    .map((row) => row.index);
  const narrowed = Object.fromEntries(
    Object.entries(columns).map(([name, values]) => [name, keep.map((index) => values[index])]),
  );

  return { ...hpSubmissions, filings: { ...hpSubmissions.filings, recent: narrowed } };
}

function routeSubmissions(document: unknown): void {
  double.route(`/submissions/CIK${HP_CIK}.json`, { status: 200, body: json(document) });
}

function routeAmendmentArchives(): void {
  double.route(`${archive(HP_FY2022_AMENDMENT)}/index.json`, {
    status: 200,
    body: json(HP_FY2022_AMENDMENT_ARCHIVE_INDEX),
  });
  double.route(`${archive(HP_FY2022_AMENDMENT)}/FilingSummary.xml`, {
    status: 200,
    body: HP_FY2022_AMENDMENT_FILING_SUMMARY,
    headers: { 'content-type': 'application/xml' },
  });
  double.route(`${archive(HP_FY2019_COVER_ONLY_AMENDMENT)}/index.json`, {
    status: 200,
    body: json(HP_FY2019_AMENDMENT_ARCHIVE_INDEX),
  });
  double.route(`${archive(HP_FY2019_COVER_ONLY_AMENDMENT)}/FilingSummary.xml`, {
    status: 200,
    body: HP_FY2019_AMENDMENT_FILING_SUMMARY,
    headers: { 'content-type': 'application/xml' },
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
  routeAmendmentArchives();
  resetRateLimiterForTests();
  client = createEdgarClient({
    contactEmail: TEST_CONTACT_EMAIL,
    transport: double.transport,
    cache: new MemoryCacheStore(),
  });
});

describe("HP's filing history, as EDGAR sends it", () => {
  it('has a real correction against a real original for FY2022', () => {
    const series = buildFilingSeries(toFilingRecords(HP_10K_FILING_COLUMNS).records, '10-K').find(
      (entry) => entry.periodOfReport === HP_FY2022_PERIOD,
    );

    expect(series?.original?.accession).toBe(HP_FY2022_ORIGINAL);
    expect(series?.amendments.map((record) => record.accession)).toEqual([HP_FY2022_AMENDMENT]);
    expect(series?.amendments[0]?.form).toBe('10-K/A');
  });
});

describe('choosing which filing a reader is shown', () => {
  it('reads the correction, not the original, when the correction restates the financials', async () => {
    routeSubmissions(submissionsAsOf('2023-09-11'));

    const result = await resolveAuthoritativeFiling(client, HP_CIK, '10-K');

    expect(result.kind).toBe('selected');

    if (result.kind !== 'selected') return;

    // The whole ruling, in four assertions.
    expect(result.filing.accession).toBe(HP_FY2022_AMENDMENT);
    expect(result.filing.form).toBe('10-K/A');
    expect(result.filing.role).toBe('amendment');
    expect(result.filing.amends).toBe(HP_FY2022_ORIGINAL);
  });

  it('states the period and the filing date of the correction it read', async () => {
    routeSubmissions(submissionsAsOf('2023-09-11'));

    const result = await resolveAuthoritativeFiling(client, HP_CIK, '10-K');

    expect(result.kind === 'selected' && result.filing.periodOfReport).toBe(HP_FY2022_PERIOD);
    expect(result.kind === 'selected' && result.filing.filingDate).toBe('2023-09-11');
    expect(result.kind === 'selected' && result.filing.amendmentCount).toBe(1);
  });

  it('keeps the original when the correction restates nothing, and says the correction exists', async () => {
    routeSubmissions(submissionsAsOf('2020-02-27'));

    const result = await resolveAuthoritativeFiling(client, HP_CIK, '10-K');

    expect(result.kind).toBe('selected');

    if (result.kind !== 'selected') return;

    // HP's FY2019 correction has one rendered report and it is the cover page.
    // Reading it as authoritative would blank a year that is presently right.
    expect(result.filing.accession).toBe(HP_FY2019_ORIGINAL);
    expect(result.filing.role).toBe('original');
    expect(result.filing.periodOfReport).toBe(HP_FY2019_PERIOD);
    expect(result.filing.unreadAmendments).toHaveLength(1);
    expect(result.filing.unreadAmendments[0]?.accession).toBe(HP_FY2019_COVER_ONLY_AMENDMENT);
    expect(result.filing.unreadAmendments[0]?.reason).toBe('no-financial-statements');
  });

  it('carries enough about an unread correction for a later panel to show it', async () => {
    routeSubmissions(submissionsAsOf('2020-02-27'));

    const result = await resolveAuthoritativeFiling(client, HP_CIK, '10-K');
    const unread = result.kind === 'selected' ? result.filing.unreadAmendments[0] : undefined;

    // Angel's deferred feature: click the note, see what was actually filed.
    // None of this is rendered today; all of it is here so that building it
    // later needs no second trip to EDGAR and no re-opening of this decision.
    expect(unread?.form).toBe('10-K/A');
    expect(unread?.filingDate).toBe('2020-02-27');
    expect(unread?.periodOfReport).toBe(HP_FY2019_PERIOD);
    expect(unread?.primaryDocument).toBe('hpq3726921-10ka.htm');
    expect(unread?.documents).toContain('hpq3726921-10ka_htm.xml');
    // Two entries, both real: EDGAR's own 'All Reports' index sits beside the
    // one page this correction actually contains.
    expect(unread?.reportTitles).toEqual(['Cover', 'All Reports']);
  });

  it('reads the original untouched when the period has no correction at all', async () => {
    routeSubmissions(hpSubmissions);

    const result = await resolveAuthoritativeFiling(client, HP_CIK, '10-K');

    expect(result.kind === 'selected' && result.filing.accession).toBe(HP_LATEST_ACCESSION);
    expect(result.kind === 'selected' && result.filing.role).toBe('original');
    expect(result.kind === 'selected' && result.filing.periodOfReport).toBe(HP_LATEST_PERIOD);
    expect(result.kind === 'selected' && result.filing.unreadAmendments).toEqual([]);
  });

  it('spends no extra EDGAR requests on a period with no correction', async () => {
    routeSubmissions(hpSubmissions);

    await resolveAuthoritativeFiling(client, HP_CIK, '10-K');

    // One submissions read, which the ingest was going to make anyway. No
    // archive index, no report index. This is why nineteen of nineteen filers
    // in the corpus cost exactly what they cost yesterday.
    expect(double.requestsFor('/Archives/')).toHaveLength(0);
    expect(double.requestsFor('/submissions/')).toHaveLength(1);
  });

  it('costs two immutable requests to inspect a correction, and only the first time', async () => {
    routeSubmissions(submissionsAsOf('2023-09-11'));

    await resolveAuthoritativeFiling(client, HP_CIK, '10-K');
    await resolveAuthoritativeFiling(client, HP_CIK, '10-K');

    // index.json and FilingSummary.xml, once each: accessioned bytes, cached
    // forever, so the second resolution asks EDGAR nothing.
    expect(double.requestsFor(`${archive(HP_FY2022_AMENDMENT)}/index.json`)).toHaveLength(1);
    expect(double.requestsFor(`${archive(HP_FY2022_AMENDMENT)}/FilingSummary.xml`)).toHaveLength(1);
  });

  it('refuses rather than serving the superseded original when EDGAR will not describe a correction', async () => {
    routeSubmissions(submissionsAsOf('2023-09-11'));
    // 404 is the realistic shape: EDGAR publishes the submissions row before the
    // archive directory has settled, so a correction can be listed minutes
    // before its contents can be read.
    double.route(`${archive(HP_FY2022_AMENDMENT)}/index.json`, { status: 404 });

    const result = await resolveAuthoritativeFiling(client, HP_CIK, '10-K');

    // The tempting failure is to fall back to the original. That is precisely
    // the outcome the ruling forbids: a withdrawn figure, indistinguishable
    // from a correct one, because a request failed.
    expect(result.kind).toBe('unresolved');
    expect(result.kind === 'unresolved' && result.detail).toContain('deliberately not served');
  });

  it('reports a late-filing notice against the period it belongs to', async () => {
    // Autodesk's FY2024, not HP's: HP has never filed one for an annual report.
    const columns = {
      accessionNumber: ['0000769397-24-000090', '0000769397-24-000041'],
      filingDate: ['2024-06-10', '2024-04-01'],
      reportDate: ['2024-01-31', '2024-01-31'],
      acceptanceDateTime: ['2024-06-10T16:31:00.000Z', '2024-04-01T16:01:00.000Z'],
      form: ['10-K', 'NT 10-K'],
      primaryDocument: ['adsk-20240131.htm', 'adsk-nt10k.htm'],
      isXBRL: [1, 0],
      isInlineXBRL: [1, 0],
      isXBRLNumeric: [null, null],
      items: ['', ''],
      size: [1, 1],
    };
    const series = buildFilingSeries(toFilingRecords(columns).records, '10-K');

    expect(series[0]?.lateNotifications).toHaveLength(1);
    expect(series[0]?.timeliness.lateNotificationPresent).toBe(true);
    expect(series[0]?.timeliness.daysFromPeriodEndToFiling).toBe(131);
  });
});
