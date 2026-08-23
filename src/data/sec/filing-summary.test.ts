// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  HP_FY2019_AMENDMENT_FILING_SUMMARY,
  HP_FY2022_AMENDMENT_FILING_SUMMARY,
} from './__fixtures__/hp.ts';
import { statementReports } from './filing-summary.ts';

describe('reading a filing report index', () => {
  it('finds the financial statements in a correction that restates them', () => {
    const reports = statementReports(HP_FY2022_AMENDMENT_FILING_SUMMARY);

    expect(reports.statements).toContain('Consolidated Statements of Earnings');
    expect(reports.titles[0]).toBe('Cover Page');
  });

  it('finds none in a correction that only re-files the cover', () => {
    const reports = statementReports(HP_FY2019_AMENDMENT_FILING_SUMMARY);

    expect(reports.statements).toEqual([]);
    expect(reports.titles).toEqual(['Cover', 'All Reports']);
  });

  it('reads a lone report, which EDGAR sends unwrapped rather than as a list', () => {
    // fast-xml-parser collapses a single repeated element to an object. HP's
    // FY2019 correction has exactly one report, so this is the shape that
    // actually arrives, not a hypothetical.
    expect(statementReports(HP_FY2019_AMENDMENT_FILING_SUMMARY).titles.length).toBeGreaterThan(0);
  });

  it('reads a document with no reports at all as no reports', () => {
    expect(statementReports('<FilingSummary><MyReports/></FilingSummary>')).toEqual({
      titles: [],
      statements: [],
    });
  });

  // Decision 0010's parser gate. Zero reports out of a document that plainly has
  // them would read as "this correction restates nothing", which sends a reader
  // back to a figure the filer withdrew. It must fail loudly instead.
  it('refuses to report zero reports for a document that plainly has them', () => {
    const malformed =
      '<FilingSummary><MyReports><Nested><MenuCategory>Statements</MenuCategory></Nested>' +
      '</MyReports></FilingSummary>';

    expect(() => statementReports(malformed)).toThrow(/lists reports but none could be read/);
  });
});
