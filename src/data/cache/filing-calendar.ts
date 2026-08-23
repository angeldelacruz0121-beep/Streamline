/**
 * The filing calendar, as far as transport needs it.
 *
 * Cache lifetimes are tied to when EDGAR can possibly change, not to round
 * numbers. EDGAR accepts filings 06:00-22:00 Eastern on business days; outside
 * that window no new filing can appear, so a cached index cannot go stale.
 * That is the whole reason this file exists.
 *
 * Nothing here interprets a fiscal calendar or a filing deadline. Period
 * normalisation and filer-category deadlines belong to Ledger (Invariant 2.5).
 */

export const ACCEPTANCE_OPEN_HOUR_ET = 6;
export const ACCEPTANCE_CLOSE_HOUR_ET = 22;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/**
 * US federal holidays on which EDGAR does not accept filings, as observed
 * dates. Real published dates, extended by hand as the years roll; an unlisted
 * year degrades to weekends-only, which errs toward a shorter cache lifetime
 * rather than a stale one.
 */
export const EDGAR_HOLIDAYS: ReadonlySet<string> = new Set([
  '2025-01-01',
  '2025-01-20',
  '2025-02-17',
  '2025-05-26',
  '2025-06-19',
  '2025-07-04',
  '2025-09-01',
  '2025-10-13',
  '2025-11-11',
  '2025-11-27',
  '2025-12-25',
  '2026-01-01',
  '2026-01-19',
  '2026-02-16',
  '2026-05-25',
  '2026-06-19',
  '2026-07-03',
  '2026-09-07',
  '2026-10-12',
  '2026-11-11',
  '2026-11-26',
  '2026-12-25',
  '2027-01-01',
  '2027-01-18',
  '2027-02-15',
  '2027-05-31',
  '2027-06-18',
  '2027-07-05',
  '2027-09-06',
  '2027-10-11',
  '2027-11-11',
  '2027-11-25',
  '2027-12-24',
]);

export interface EasternParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  /** 0 = Sunday. */
  readonly weekday: number;
  readonly isoDate: string;
}

const PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
});

const OFFSET_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  timeZoneName: 'shortOffset',
});

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Wall-clock parts in the timezone EDGAR's schedule is published in. */
export function easternParts(epochMs: number): EasternParts {
  const parts = new Map(
    PARTS_FORMAT.formatToParts(new Date(epochMs)).map((part) => [part.type, part.value]),
  );

  const year = Number(parts.get('year'));
  const month = Number(parts.get('month'));
  const day = Number(parts.get('day'));
  const hour = Number(parts.get('hour')) % 24;

  return {
    year,
    month,
    day,
    hour,
    minute: Number(parts.get('minute')),
    weekday: WEEKDAY_INDEX[parts.get('weekday') ?? 'Sun'] ?? 0,
    isoDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

function easternOffsetMs(epochMs: number): number {
  const label =
    OFFSET_FORMAT.formatToParts(new Date(epochMs)).find((part) => part.type === 'timeZoneName')
      ?.value ?? 'GMT-5';

  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(label);

  if (match === null) {
    return -5 * HOUR_MS;
  }

  const sign = match[1] === '-' ? -1 : 1;

  return sign * (Number(match[2]) * HOUR_MS + Number(match[3] ?? 0) * MINUTE_MS);
}

/** The epoch instant of a given Eastern wall-clock hour on a given Eastern date. */
export function easternInstant(isoDate: string, hour: number): number {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  const naive = Date.UTC(year, month - 1, day, hour);

  return naive - easternOffsetMs(naive);
}

export function isBusinessDay(epochMs: number): boolean {
  const parts = easternParts(epochMs);

  return parts.weekday >= 1 && parts.weekday <= 5 && !EDGAR_HOLIDAYS.has(parts.isoDate);
}

/** `true` while EDGAR can accept a new filing, so an index can change. */
export function isAcceptanceOpen(epochMs: number): boolean {
  if (!isBusinessDay(epochMs)) {
    return false;
  }

  const { hour } = easternParts(epochMs);

  return hour >= ACCEPTANCE_OPEN_HOUR_ET && hour < ACCEPTANCE_CLOSE_HOUR_ET;
}

/**
 * Milliseconds until EDGAR can next accept a filing. A cache entry that expires
 * exactly then is never stale and never re-fetched during a closed window.
 */
export function msUntilNextAcceptanceOpen(epochMs: number): number {
  if (isAcceptanceOpen(epochMs)) {
    return 0;
  }

  for (let dayOffset = 0; dayOffset <= 10; dayOffset += 1) {
    const probe = epochMs + dayOffset * DAY_MS;

    if (!isBusinessDay(probe)) {
      continue;
    }

    const open = easternInstant(easternParts(probe).isoDate, ACCEPTANCE_OPEN_HOUR_ET);

    if (open > epochMs) {
      return open - epochMs;
    }
  }

  return DAY_MS;
}

/** `YYYY-MM-DD` in Eastern time - the calendar EDGAR's daily index is named by. */
export function easternDate(epochMs: number): string {
  return easternParts(epochMs).isoDate;
}
