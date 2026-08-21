// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  MICROSOFT_10K_ACCESSION,
  MICROSOFT_10K_FILING_DATE,
  MICROSOFT_CIK,
} from '../sec/__fixtures__/microsoft.ts';
import {
  archiveDocumentUrl,
  companyConceptUrl,
  companyFactsUrl,
  dailyIndexUrl,
  filingIndexUrl,
  submissionsOverflowUrl,
  submissionsUrl,
  tickerMapUrl,
} from '../sec/endpoints.ts';
import type { EdgarResourceKind } from '../sec/errors.ts';
import { expiresAtFor, NEGATIVE_TTL_MS, TTL_REASONS, ttlFor } from './ttl-policy.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const OPEN = Date.parse('2026-07-29T16:00:00.000Z'); // Wed 12:00 ET, filings arriving
const CLOSED_WEEKDAY = Date.parse('2026-07-30T03:00:00.000Z'); // Wed 23:00 ET
const WEEKEND = Date.parse('2026-08-01T16:00:00.000Z'); // Sat 12:00 ET

const ALL_KINDS: readonly EdgarResourceKind[] = [
  'ticker-map',
  'submissions',
  'submissions-overflow',
  'company-facts',
  'company-concept',
  'filing-index',
  'archive-document',
  'daily-index',
];

describe('TTL policy - every cached resource has a lifetime and a reason', () => {
  it('states a reason for every resource kind', () => {
    for (const kind of ALL_KINDS) {
      expect(TTL_REASONS[kind].length).toBeGreaterThan(40);
    }
  });

  it('refuses to cache a URL it cannot classify', () => {
    expect(() => ttlFor('https://example.invalid/whatever', { now: OPEN })).toThrow();
  });

  it('caches accessioned bytes forever, because they never change', () => {
    const decision = ttlFor(
      archiveDocumentUrl(MICROSOFT_CIK, MICROSOFT_10K_ACCESSION, 'msft-20260630.htm'),
      { now: OPEN },
    );

    expect(decision.immutable).toBe(true);
    expect(decision.reason).toContain('Accessioned bytes never change');
    expect(expiresAtFor(decision, OPEN)).toBeNull();
  });

  it('keeps an accession listing mutable while EDGAR is still generating it', () => {
    const url = filingIndexUrl(MICROSOFT_CIK, MICROSOFT_10K_ACCESSION);
    const justFiled = ttlFor(url, { now: OPEN, filedAtEpochMs: OPEN - HOUR });

    expect(justFiled.immutable).toBe(false);
    expect(justFiled.immutable === false && justFiled.ttlMs).toBe(HOUR);

    const settled = ttlFor(url, {
      now: OPEN,
      filedAtEpochMs: Date.parse(`${MICROSOFT_10K_FILING_DATE}T00:00:00Z`) - 30 * DAY,
    });

    expect(settled.immutable).toBe(true);
  });

  it('ages the submissions index against acceptance hours, not against a round number', () => {
    const url = submissionsUrl(MICROSOFT_CIK);

    expect(ttlFor(url, { now: OPEN })).toMatchObject({ immutable: false, ttlMs: HOUR });
    expect(ttlFor(url, { now: CLOSED_WEEKDAY })).toMatchObject({ ttlMs: 6 * HOUR });
    expect(ttlFor(url, { now: WEEKEND })).toMatchObject({ ttlMs: DAY });
  });

  it('caches the XBRL convenience APIs for a day', () => {
    expect(ttlFor(companyFactsUrl(MICROSOFT_CIK), { now: OPEN })).toMatchObject({ ttlMs: DAY });
    expect(
      ttlFor(companyConceptUrl(MICROSOFT_CIK, 'us-gaap', 'Revenues'), { now: OPEN }),
    ).toMatchObject({ ttlMs: DAY });
  });

  it('caches the ticker map and submissions overflow for a week', () => {
    expect(ttlFor(tickerMapUrl(), { now: OPEN })).toMatchObject({ ttlMs: 7 * DAY });
    expect(
      ttlFor(submissionsOverflowUrl(`CIK${MICROSOFT_CIK}-submissions-001.json`), { now: OPEN }),
    ).toMatchObject({ ttlMs: 7 * DAY });
  });

  it('treats a closed day of the index as final and the current day as filling', () => {
    expect(ttlFor(dailyIndexUrl('2026-07-28'), { now: OPEN }).immutable).toBe(true);

    const today = ttlFor(dailyIndexUrl('2026-07-29'), { now: OPEN });

    expect(today).toMatchObject({ immutable: false, ttlMs: 15 * 60_000 });

    // Outside acceptance hours nothing can be added, so the entry lives until
    // the moment EDGAR can next accept a filing.
    const overnight = ttlFor(dailyIndexUrl('2026-07-29'), { now: CLOSED_WEEKDAY });

    expect(overnight.immutable === false && overnight.ttlMs).toBe(7 * HOUR);
  });

  it('remembers an absence briefly rather than re-asking or forgetting', () => {
    const decision = ttlFor(submissionsUrl(MICROSOFT_CIK), { now: OPEN, negative: true });

    expect(decision.immutable === false && decision.ttlMs).toBe(NEGATIVE_TTL_MS);
    expect(decision.reason).toContain('late filing');
  });
});
