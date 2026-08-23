import { describe, expect, it } from 'vitest';
import { coverFact, readAnnualFilingPeriod } from './fiscal-period.ts';
import { readXbrlInstance, type XbrlInstance } from './xbrl-instance.ts';
import { MSFT_INSTANCE_EXCERPT } from './__fixtures__/msft-fy2026.ts';

function load(text: string): XbrlInstance {
  const result = readXbrlInstance(text);

  if (result.kind !== 'ok') throw new Error(result.detail);

  return result.instance;
}

describe('readAnnualFilingPeriod', () => {
  const instance = load(MSFT_INSTANCE_EXCERPT);

  it('reads the fiscal year from the filer’s own focus, not from the filing date', () => {
    const result = readAnnualFilingPeriod(instance);

    expect(result.kind).toBe('ok');

    if (result.kind !== 'ok') return;

    expect(result.filingPeriod.period.fiscalYear).toBe(2026);
    expect(result.filingPeriod.period.focus).toBe('FY');
    expect(result.filingPeriod.period.label).toBe('FY2026');
  });

  it('normalises a June year end as non-calendar-aligned', () => {
    const result = readAnnualFilingPeriod(instance);

    if (result.kind !== 'ok') throw new Error(result.detail);

    expect(result.filingPeriod.period.start).toBe('2025-07-01');
    expect(result.filingPeriod.period.end).toBe('2026-06-30');
    expect(result.filingPeriod.period.days).toBe(365);
    expect(result.filingPeriod.period.fiscalYearEndMonthDay).toBe('06-30');
    expect(result.filingPeriod.period.calendarAligned).toBe(false);
    expect(result.filingPeriod.period.transition).toBe(false);
    expect(result.filingPeriod.warnings).toEqual([]);
  });

  it('identifies the undimensioned required context the cover page is tagged in', () => {
    const result = readAnnualFilingPeriod(instance);

    if (result.kind !== 'ok') throw new Error(result.detail);

    expect(result.filingPeriod.requiredContext.dimensions).toHaveLength(0);
    expect(result.filingPeriod.requiredContext.period.kind).toBe('duration');
    expect(result.filingPeriod.documentType).toBe('10-K');
    expect(result.filingPeriod.amendment).toBe(false);
  });

  it('exposes cover-page facts as written', () => {
    expect(coverFact(instance, 'CurrentFiscalYearEndDate')).toBe('--06-30');
    expect(coverFact(instance, 'EntityRegistrantName')).toBe('MICROSOFT CORPORATION');
    expect(coverFact(instance, 'NotAFact')).toBeNull();
  });

  it('warns when the cover page and its context disagree about the period end', () => {
    const shifted = MSFT_INSTANCE_EXCERPT.replace(
      '>2026-06-30</dei:DocumentPeriodEndDate>',
      '>2026-06-29</dei:DocumentPeriodEndDate>',
    );

    expect(shifted).not.toBe(MSFT_INSTANCE_EXCERPT);

    const result = readAnnualFilingPeriod(load(shifted));

    if (result.kind !== 'ok') throw new Error(result.detail);

    expect(result.filingPeriod.warnings.join(' ')).toContain('2026-06-29');
  });

  it('warns when the declared year end does not match the period, the mark of a year-end move', () => {
    const moved = MSFT_INSTANCE_EXCERPT.replace(
      '>--06-30</dei:CurrentFiscalYearEndDate>',
      '>--12-31</dei:CurrentFiscalYearEndDate>',
    );
    const result = readAnnualFilingPeriod(load(moved));

    if (result.kind !== 'ok') throw new Error(result.detail);

    expect(result.filingPeriod.warnings.join(' ')).toContain('fiscal-year change');
  });

  it('refuses a document with no period end on its cover page', () => {
    const stripped = MSFT_INSTANCE_EXCERPT.replace(
      /<dei:DocumentPeriodEndDate[\s\S]*?<\/dei:DocumentPeriodEndDate>/,
      '',
    );
    const result = readAnnualFilingPeriod(load(stripped));

    expect(result.kind).toBe('unresolved');
    expect(result.kind === 'unresolved' && result.detail).toContain('DocumentPeriodEndDate');
  });
});
