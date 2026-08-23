// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  PROBE_ACCESSION_AMENDMENT,
  PROBE_ACCESSION_INCOMPLETE,
  PROBE_ACCESSION_ORIGINAL,
  probeArchiveIndexComplete,
  probeArchiveIndexIncomplete,
  probeSubmissions,
} from './__fixtures__/shape-probes.ts';
import {
  archiveInventory,
  baseFormOf,
  buildFilingSeries,
  detectAnnualPeriodGaps,
  toFilingRecords,
} from './filings.ts';
import { MICROSOFT_10K_FILING_DATE, MICROSOFT_10K_PERIOD_END } from './__fixtures__/microsoft.ts';

const records = toFilingRecords(probeSubmissions.filings.recent).records;

describe('filing records', () => {
  it('zips EDGAR columnar arrays into records', () => {
    expect(records).toHaveLength(4);
    expect(records[0]?.accession).toBe(PROBE_ACCESSION_AMENDMENT);
  });

  it('counts rows it could not zip instead of dropping them silently', () => {
    const ragged = toFilingRecords({
      ...probeSubmissions.filings.recent,
      form: ['10-K/A', '', '10-K'],
      accessionNumber: [PROBE_ACCESSION_AMENDMENT, '0000000000-00-000009', ''],
      filingDate: ['2024-05-01', '2024-04-15'],
    });

    expect(ragged.records).toHaveLength(1);
    expect(ragged.malformedRows).toBe(2);
  });

  it('names the role of every form rather than treating them all as filings', () => {
    expect(records.map((record) => record.role)).toEqual([
      'amendment',
      'original',
      'notification-of-late-filing',
      'original',
    ]);
    expect(baseFormOf('NT 10-K')).toBe('10-K');
    expect(baseFormOf('10-K/A')).toBe('10-K');
    expect(baseFormOf('10-Q')).toBe('10-Q');
  });

  it('reads the XBRL flags EDGAR provides, and says "unknown" when it provides none', () => {
    expect(records[1]?.xbrl).toBe('inline');
    expect(records[0]?.xbrl).toBe('exhibit');
    expect(records[2]?.xbrl).toBe('none');

    const flagless = toFilingRecords({
      accessionNumber: [PROBE_ACCESSION_ORIGINAL],
      filingDate: ['2024-04-15'],
      reportDate: ['2023-12-31'],
      acceptanceDateTime: ['2024-04-15T17:00:00.000Z'],
      form: ['10-K'],
      primaryDocument: ['probe.htm'],
    });

    expect(flagless.records[0]?.xbrl).toBe('unknown');
  });
});

describe('amendment and late-filing handling', () => {
  const series = buildFilingSeries(records, '10-K');

  it('never returns an amendment detached from the filing it amends', () => {
    const amended = series.find((entry) => entry.periodOfReport === '2023-12-31');

    expect(amended?.original?.accession).toBe(PROBE_ACCESSION_ORIGINAL);
    expect(amended?.amendments.map((filing) => filing.accession)).toEqual([
      PROBE_ACCESSION_AMENDMENT,
    ]);
  });

  it('attaches the late-filing notification to the period it concerns', () => {
    const amended = series.find((entry) => entry.periodOfReport === '2023-12-31');

    expect(amended?.lateNotifications).toHaveLength(1);
    expect(amended?.timeliness.lateNotificationPresent).toBe(true);
  });

  it('reports timing evidence and explicitly refuses to classify lateness', () => {
    const amended = series.find((entry) => entry.periodOfReport === '2023-12-31');

    expect(amended?.timeliness.daysFromPeriodEndToFiling).toBe(106);
    expect(amended?.timeliness.filerCategoryKnown).toBe(false);
    expect(amended?.timeliness.classification).toBe('not-classified-by-transport');
  });

  it('measures the same evidence on a real verified filing', () => {
    const real = buildFilingSeries(
      toFilingRecords({
        accessionNumber: ['0001193125-26-323660'],
        filingDate: [MICROSOFT_10K_FILING_DATE],
        reportDate: [MICROSOFT_10K_PERIOD_END],
        acceptanceDateTime: [`${MICROSOFT_10K_FILING_DATE}T16:05:00.000Z`],
        form: ['10-K'],
        primaryDocument: ['msft-20260630.htm'],
      }).records,
      '10-K',
    );

    expect(real[0]?.timeliness.daysFromPeriodEndToFiling).toBe(29);
    expect(real[0]?.timeliness.lateNotificationPresent).toBe(false);
  });

  it('surfaces missing periods as named gaps rather than a shorter list', () => {
    expect(detectAnnualPeriodGaps(series)).toEqual([2021, 2022]);
  });

  it('carries the truncation flag when older history was not fetched', () => {
    const truncated = buildFilingSeries(records, '10-K', { historyTruncated: true });

    expect(truncated.every((entry) => entry.historyTruncated)).toBe(true);
    expect(series.every((entry) => entry.historyTruncated)).toBe(false);
  });
});

describe('archive inventory', () => {
  it('finds the instance document and the R-files a dimensional read needs', () => {
    const inventory = archiveInventory(probeArchiveIndexComplete, PROBE_ACCESSION_ORIGINAL);

    expect(inventory.instanceDocument).toBe('probe-20231231_htm.xml');
    expect(inventory.filingSummary).toBe('FilingSummary.xml');
    expect(inventory.metaLinks).toBe('MetaLinks.json');
    expect(inventory.rFiles).toEqual(['R1.htm', 'R7.htm']);
    expect(inventory.missing).toEqual([]);
    expect(inventory.xbrl).toBe('inline');
  });

  it('does not mistake a linkbase for an instance document', () => {
    const inventory = archiveInventory(
      {
        directory: {
          name: '/Archives/edgar/data/0/000000000000000001',
          item: [
            { name: 'probe-20231231_cal.xml' },
            { name: 'probe-20231231_pre.xml' },
            { name: 'FilingSummary.xml' },
          ],
        },
      },
      PROBE_ACCESSION_ORIGINAL,
    );

    expect(inventory.instanceDocument).toBeNull();
    expect(inventory.xbrl).toBe('none');
  });

  it('names every absence when an XBRL exhibit is incomplete', () => {
    const inventory = archiveInventory(probeArchiveIndexIncomplete, PROBE_ACCESSION_INCOMPLETE);

    expect(inventory.missing).toEqual([
      'xbrl-instance',
      'FilingSummary.xml',
      'MetaLinks.json',
      'R-files',
    ]);
    expect(inventory.files).toEqual(['probe-paper.htm']);
  });
});
