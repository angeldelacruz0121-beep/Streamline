import { describe, expect, it } from 'vitest';
import {
  comparablePeriods,
  inclusiveDays,
  monthDayFrom,
  normalizeAnnualPeriod,
  weekBasisFromDays,
} from './period.ts';

// The dates below are date arithmetic, not a claim about any filer's calendar.
// Invariant 4.5 bars invented financial figures; there are none here, and the
// fiscal shapes these exercise are validated against real filers when the
// multi-year workstream lands.
describe('fiscal period normalisation', () => {
  it('counts a year inclusively', () => {
    expect(inclusiveDays('2025-07-01', '2026-06-30')).toBe(365);
    expect(inclusiveDays('2026-06-30', '2025-07-01')).toBeNull();
    expect(inclusiveDays('not-a-date', '2026-06-30')).toBeNull();
  });

  it('classifies the retail calendar exactly', () => {
    expect(weekBasisFromDays(364)).toBe('52-week');
    expect(weekBasisFromDays(371)).toBe('53-week');
    expect(weekBasisFromDays(365)).toBe('calendar-months');
    expect(weekBasisFromDays(366)).toBe('calendar-months');
    expect(weekBasisFromDays(276)).toBe('irregular');
    expect(weekBasisFromDays(null)).toBe('irregular');
  });

  it('reads a fiscal year end marker in either spelling', () => {
    expect(monthDayFrom('--06-30')).toBe('06-30');
    expect(monthDayFrom('0630')).toBe('06-30');
    expect(monthDayFrom('06-30')).toBe('06-30');
    expect(monthDayFrom('June')).toBeNull();
    expect(monthDayFrom(null)).toBeNull();
  });

  it('normalises a non-December year end without calling it calendar aligned', () => {
    const period = normalizeAnnualPeriod({
      start: '2025-07-01',
      end: '2026-06-30',
      fiscalYear: 2026,
      focus: 'FY',
      fiscalYearEndMarker: '--06-30',
      transitionReport: false,
    });

    expect(period.label).toBe('FY2026');
    expect(period.days).toBe(365);
    expect(period.weekBasis).toBe('calendar-months');
    expect(period.fiscalYearEndMonthDay).toBe('06-30');
    expect(period.calendarAligned).toBe(false);
    expect(period.transition).toBe(false);
  });

  it('marks a 52-week year and a 53-week year as different bases', () => {
    const fiftyTwo = normalizeAnnualPeriod({
      start: '2025-09-28',
      end: '2026-09-26',
      fiscalYear: 2026,
      focus: 'FY',
      fiscalYearEndMarker: null,
      transitionReport: false,
    });
    const fiftyThree = normalizeAnnualPeriod({
      start: '2026-09-27',
      end: '2027-10-02',
      fiscalYear: 2027,
      focus: 'FY',
      fiscalYearEndMarker: null,
      transitionReport: false,
    });

    expect(fiftyTwo.weekBasis).toBe('52-week');
    expect(fiftyThree.weekBasis).toBe('53-week');
    expect(comparablePeriods(fiftyTwo, fiftyThree)).toBe(false);
  });

  it('treats a stub period from a fiscal-year change as a transition', () => {
    const stub = normalizeAnnualPeriod({
      start: '2026-01-01',
      end: '2026-06-30',
      fiscalYear: 2026,
      focus: 'FY',
      fiscalYearEndMarker: '--06-30',
      transitionReport: false,
    });

    expect(stub.weekBasis).toBe('irregular');
    expect(stub.transition).toBe(true);
  });

  it('honours the filer’s own transition flag even for a full-length year', () => {
    const declared = normalizeAnnualPeriod({
      start: '2025-07-01',
      end: '2026-06-30',
      fiscalYear: 2026,
      focus: 'FY',
      fiscalYearEndMarker: '--06-30',
      transitionReport: true,
    });

    expect(declared.transition).toBe(true);
  });

  it('refuses to compare across a year-end move or a transition', () => {
    const june = normalizeAnnualPeriod({
      start: '2025-07-01',
      end: '2026-06-30',
      fiscalYear: 2026,
      focus: 'FY',
      fiscalYearEndMarker: '--06-30',
      transitionReport: false,
    });
    const december = normalizeAnnualPeriod({
      start: '2026-01-01',
      end: '2026-12-31',
      fiscalYear: 2026,
      focus: 'FY',
      fiscalYearEndMarker: '--12-31',
      transitionReport: false,
    });

    expect(comparablePeriods(june, december)).toBe(false);
    expect(comparablePeriods(june, june)).toBe(true);
    expect(december.calendarAligned).toBe(true);
  });
});
