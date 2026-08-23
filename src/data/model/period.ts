/**
 * The canonical period model (Invariant 2.5).
 *
 * Fiscal calendars are not comparable until they are normalised, and the three
 * shapes that break a naive comparison are a filer whose year does not end in
 * December, a filer on a 52/53-week retail calendar whose year length changes,
 * and a filer that moved its year end and therefore filed a short transition
 * period. All three are representable here, and each is labelled rather than
 * silently smoothed: `weekBasis` says which calendar the filer is on, and
 * `transition` marks a period that must not be compared to a full year.
 */

export type PeriodKind = 'annual' | 'quarterly' | 'instant';

export type FiscalPeriodFocus = 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

/**
 * How the filer's year is counted.
 *
 * `calendar-months` is a year of whole months, 365 or 366 days. `52-week` and
 * `53-week` are the retail calendar, 364 and 371 days, where one year in five
 * or six carries an extra week and is therefore not comparable to its
 * neighbours without saying so. `irregular` is anything else, which in practice
 * means a transition period around a fiscal-year change.
 */
export type WeekBasis = 'calendar-months' | '52-week' | '53-week' | 'irregular';

export interface FiscalPeriod {
  readonly kind: PeriodKind;
  /** The filer's own `dei:DocumentFiscalYearFocus`, not a calendar year. */
  readonly fiscalYear: number;
  readonly focus: FiscalPeriodFocus;
  /** ISO date. `null` for an instant. */
  readonly start: string | null;
  readonly end: string;
  /** Inclusive day count; `null` for an instant. */
  readonly days: number | null;
  readonly weekBasis: WeekBasis;
  /** `06-30` for a June year end. */
  readonly fiscalYearEndMonthDay: string;
  /** `true` only for a 31 December year end. */
  readonly calendarAligned: boolean;
  /** The filer moved its year end, so this period is not a full comparable year. */
  readonly transition: boolean;
  /** `FY2026`. Never bare `2026`, which would read as a calendar year. */
  readonly label: string;
}

const DAY_MS = 86_400_000;

/** Inclusive day count between two ISO dates, or `null` if either is unparseable. */
export function inclusiveDays(start: string, end: string): number | null {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);

  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;

  return Math.round((to - from) / DAY_MS) + 1;
}

/**
 * Classifies a year length. 364 and 371 days are the 52-week and 53-week
 * retail calendars exactly; 365 and 366 are a year of whole months. Anything
 * else is irregular, which is the signature of a fiscal-year change.
 */
export function weekBasisFromDays(days: number | null): WeekBasis {
  if (days === 364) return '52-week';
  if (days === 371) return '53-week';
  if (days === 365 || days === 366) return 'calendar-months';

  return 'irregular';
}

/** `--06-30` (the dei spelling) or `0630` (the submissions spelling) to `06-30`. */
export function monthDayFrom(value: string | null): string | null {
  if (value === null) return null;

  const trimmed = value.trim();
  const dashed = /^--(\d{2})-(\d{2})$/.exec(trimmed);

  if (dashed !== null) return `${dashed[1]!}-${dashed[2]!}`;

  const bare = /^(\d{2})(\d{2})$/.exec(trimmed);

  if (bare !== null) return `${bare[1]!}-${bare[2]!}`;

  const already = /^(\d{2})-(\d{2})$/.exec(trimmed);

  return already === null ? null : trimmed;
}

export interface AnnualPeriodInput {
  readonly start: string;
  readonly end: string;
  readonly fiscalYear: number;
  readonly focus: FiscalPeriodFocus;
  /** From `dei:CurrentFiscalYearEndDate`, e.g. `--06-30`. */
  readonly fiscalYearEndMarker: string | null;
  /** From `dei:DocumentTransitionReport`. */
  readonly transitionReport: boolean;
}

/**
 * Builds the canonical annual period.
 *
 * A period is a transition period when the filer says so on the cover page, or
 * when its length is irregular — a filer that moves its year end files a short
 * or long stub, and calling that a year would draw a false trend.
 */
export function normalizeAnnualPeriod(input: AnnualPeriodInput): FiscalPeriod {
  const days = inclusiveDays(input.start, input.end);
  const weekBasis = weekBasisFromDays(days);
  const monthDay = monthDayFrom(input.fiscalYearEndMarker) ?? input.end.slice(5);

  return {
    kind: 'annual',
    fiscalYear: input.fiscalYear,
    focus: input.focus,
    start: input.start,
    end: input.end,
    days,
    weekBasis,
    fiscalYearEndMonthDay: monthDay,
    calendarAligned: monthDay === '12-31',
    transition: input.transitionReport || weekBasis === 'irregular',
    label: `FY${String(input.fiscalYear)}`,
  };
}

/**
 * Whether two periods may be placed on the same axis without a break marker.
 * Differing week bases and any transition period both disqualify a comparison;
 * Invariant 2.5 wants a break marker there, not a smooth line.
 */
export function comparablePeriods(left: FiscalPeriod, right: FiscalPeriod): boolean {
  if (left.transition || right.transition) return false;
  if (left.fiscalYearEndMonthDay !== right.fiscalYearEndMonthDay) return false;

  return left.weekBasis === right.weekBasis;
}
