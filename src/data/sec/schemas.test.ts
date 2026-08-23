// @vitest-environment node
/**
 * The test that would have caught the defect.
 *
 * Every envelope schema is checked against a fixture captured from a live EDGAR
 * response, and the field names EDGAR actually uses are asserted by name. The
 * previous suite passed 120/120 with `submissions.entityName` required, because
 * the fixture was hand-authored from the same assumption the schema encoded - a
 * fixture built from a guess validates the guess. These assertions are pinned to
 * observed payloads instead, and the negative cases below fail if anyone
 * reintroduces a spelling the service does not send.
 */
import { describe, expect, it } from 'vitest';
import {
  dailyIndexCompanyText,
  dailyIndexFormText,
  dailyIndexMasterText,
  microsoftFilingIndex,
  microsoftSubmissions,
  MICROSOFT_ENTITY_NAME,
  tickerMap,
} from './__fixtures__/microsoft.ts';
import {
  probeArchiveIndexComplete,
  probeArchiveIndexIncomplete,
  probeSubmissions,
  probeSubmissionsOverflow,
} from './__fixtures__/shape-probes.ts';
import { parseDailyIndexDetailed } from './daily-index.ts';
import {
  archiveIndexBoundary,
  submissionsBoundary,
  submissionsOverflowBoundary,
  tickerMapBoundary,
} from './schemas.ts';

describe('captured payloads satisfy the envelope schemas', () => {
  it.each([
    ['submissions (captured, Microsoft)', submissionsBoundary, microsoftSubmissions],
    ['submissions (shape probe)', submissionsBoundary, probeSubmissions],
    ['submissions overflow (shape probe)', submissionsOverflowBoundary, probeSubmissionsOverflow],
    ['archive index (captured, Microsoft 10-K)', archiveIndexBoundary, microsoftFilingIndex],
    ['archive index (shape probe, complete)', archiveIndexBoundary, probeArchiveIndexComplete],
    ['archive index (shape probe, incomplete)', archiveIndexBoundary, probeArchiveIndexIncomplete],
    ['company_tickers.json (captured)', tickerMapBoundary, tickerMap],
  ])('%s', (_name, boundary, fixture) => {
    const checked = boundary.check(fixture);

    expect(checked.ok ? [] : checked.issues).toEqual([]);
  });
});

describe('field names EDGAR actually uses', () => {
  it('takes the filer name from submissions.name, not submissions.entityName', () => {
    expect(Object.keys(microsoftSubmissions)).toContain('name');
    expect(Object.keys(microsoftSubmissions)).not.toContain('entityName');
    expect(microsoftSubmissions.name).toBe(MICROSOFT_ENTITY_NAME);
  });

  it('rejects a submissions payload that carries entityName instead of name', () => {
    const { name: _dropped, ...rest } = microsoftSubmissions;
    const checked = submissionsBoundary.check({ ...rest, entityName: MICROSOFT_ENTITY_NAME });

    expect(checked.ok).toBe(false);
    expect(checked.ok ? [] : checked.issues.map((issue) => issue.path.join('.'))).toContain('name');
  });

  it('tolerates the nulls EDGAR sends in isXBRLNumeric', () => {
    expect(microsoftSubmissions.filings.recent.isXBRLNumeric).toContain(null);
    expect(submissionsBoundary.check(microsoftSubmissions).ok).toBe(true);
  });

  it('reads the archive index through hyphenated keys', () => {
    expect(Object.keys(microsoftFilingIndex.directory)).toContain('parent-dir');
    expect(Object.keys(microsoftFilingIndex.directory)).not.toContain('parentDir');
    expect(Object.keys(microsoftFilingIndex.directory.item[0] ?? {})).toContain('last-modified');
    // A decimal string, not a number - and "" for entries EDGAR does not size.
    expect(typeof microsoftFilingIndex.directory.item[0]?.size).toBe('string');
  });
});

describe('daily index formats are not interchangeable', () => {
  it('parses each captured file with its own format and none with another', () => {
    expect(parseDailyIndexDetailed(dailyIndexMasterText, 'master').records).toHaveLength(3);
    expect(parseDailyIndexDetailed(dailyIndexFormText, 'form').records).toHaveLength(4);
    expect(parseDailyIndexDetailed(dailyIndexCompanyText, 'company').records).toHaveLength(4);

    // The original bug: fixed-width rows read as pipe-delimited yield nothing.
    const wrong = parseDailyIndexDetailed(dailyIndexFormText, 'master');

    expect(wrong.records).toHaveLength(0);
    expect(wrong.malformedRows).toBeGreaterThan(0);
  });

  it('counts unparsable rows rather than dropping them', () => {
    const parsed = parseDailyIndexDetailed(`${dailyIndexMasterText}\nnot-a-row`, 'master');

    expect(parsed.records).toHaveLength(3);
    expect(parsed.malformedRows).toBe(1);
  });

  it('reports an empty day as empty and clean, not as a failure', () => {
    const headerOnly = dailyIndexMasterText.split('\n').slice(0, 7).join('\n');
    const parsed = parseDailyIndexDetailed(headerOnly, 'master');

    expect(parsed.records).toHaveLength(0);
    expect(parsed.malformedRows).toBe(0);
  });
});
