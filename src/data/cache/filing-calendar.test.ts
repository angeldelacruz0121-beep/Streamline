// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  easternDate,
  easternParts,
  isAcceptanceOpen,
  isBusinessDay,
  msUntilNextAcceptanceOpen,
} from './filing-calendar.ts';

const HOUR = 3_600_000;

// 2026-07-29 is the verified filing date of the Microsoft 10-K, a Wednesday.
const WED_NOON_ET = Date.parse('2026-07-29T16:00:00.000Z');
const WED_2300_ET = Date.parse('2026-07-30T03:00:00.000Z');
const SATURDAY = Date.parse('2026-08-01T16:00:00.000Z');
const HOLIDAY_OBSERVED = Date.parse('2026-07-03T16:00:00.000Z');
const FRIDAY_LATE = Date.parse('2026-07-25T03:00:00.000Z');

describe('EDGAR filing calendar', () => {
  it('reads Eastern wall-clock parts, which is the calendar EDGAR publishes in', () => {
    const parts = easternParts(WED_NOON_ET);

    expect(parts.isoDate).toBe('2026-07-29');
    expect(parts.hour).toBe(12);
    expect(parts.weekday).toBe(3);
    expect(easternDate(WED_2300_ET)).toBe('2026-07-29');
  });

  it('knows when a filing can arrive', () => {
    expect(isAcceptanceOpen(WED_NOON_ET)).toBe(true);
    expect(isAcceptanceOpen(WED_2300_ET)).toBe(false);
    expect(isAcceptanceOpen(SATURDAY)).toBe(false);
  });

  it('treats an observed federal holiday as closed', () => {
    expect(isBusinessDay(HOLIDAY_OBSERVED)).toBe(false);
    expect(isAcceptanceOpen(HOLIDAY_OBSERVED)).toBe(false);
  });

  it('measures the closed stretch to the next open, across a weekend', () => {
    // Friday 23:00 ET -> Monday 06:00 ET is 55 hours: the whole weekend is closed.
    expect(msUntilNextAcceptanceOpen(FRIDAY_LATE)).toBe(55 * HOUR);

    // Saturday noon ET -> Monday 06:00 ET is 42 hours.
    expect(msUntilNextAcceptanceOpen(SATURDAY)).toBe(42 * HOUR);
  });

  it('returns zero while the window is open, so nothing waits unnecessarily', () => {
    expect(msUntilNextAcceptanceOpen(WED_NOON_ET)).toBe(0);
  });
});
