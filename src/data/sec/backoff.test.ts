// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BASE_DELAY_MS,
  backoffDelayMs,
  isRetryableStatus,
  MAX_DELAY_MS,
  parseRetryAfter,
} from './backoff.ts';

const NOW = Date.parse('2026-07-29T16:00:00.000Z');

describe('backoff policy', () => {
  it('retries the statuses EDGAR uses for "later", and nothing else', () => {
    expect([429, 500, 502, 503, 504].every(isRetryableStatus)).toBe(true);
    expect([200, 301, 400, 403, 404].some(isRetryableStatus)).toBe(false);
  });

  it('reads Retry-After as delta-seconds', () => {
    expect(parseRetryAfter('5', NOW)).toBe(5_000);
    expect(parseRetryAfter('0', NOW)).toBe(0);
  });

  it('reads Retry-After as an HTTP-date', () => {
    expect(parseRetryAfter('Wed, 29 Jul 2026 16:00:30 GMT', NOW)).toBe(30_000);
  });

  it('never returns a negative delay for a stale Retry-After date', () => {
    expect(parseRetryAfter('Wed, 29 Jul 2026 15:00:00 GMT', NOW)).toBe(0);
  });

  it('reports Retry-After as given rather than truncating EDGAR instruction', () => {
    expect(parseRetryAfter('600', NOW)).toBe(600_000);
  });

  it('ignores an unparseable Retry-After instead of guessing', () => {
    expect(parseRetryAfter('soon', NOW)).toBeNull();
    expect(parseRetryAfter(null, NOW)).toBeNull();
    expect(parseRetryAfter('   ', NOW)).toBeNull();
  });

  it('lets Retry-After win over the computed delay', () => {
    expect(backoffDelayMs(1, 7_000, () => 0)).toBe(7_000);
    expect(backoffDelayMs(3, 7_000, () => 1)).toBe(7_000);
  });

  it('never retries inside the same rate window that produced the throttle', () => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      for (const roll of [0, 0.5, 0.999]) {
        expect(backoffDelayMs(attempt, null, () => roll)).toBeGreaterThanOrEqual(BASE_DELAY_MS / 2);
      }
    }
  });

  it('grows exponentially and then stops growing', () => {
    const half = () => 0;

    expect(backoffDelayMs(1, null, half)).toBe(BASE_DELAY_MS / 2);
    expect(backoffDelayMs(2, null, half)).toBe(BASE_DELAY_MS);
    expect(backoffDelayMs(3, null, half)).toBe(BASE_DELAY_MS * 2);
    expect(backoffDelayMs(20, null, () => 1)).toBe(MAX_DELAY_MS);
  });
});
