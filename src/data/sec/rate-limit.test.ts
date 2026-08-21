// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquireRateLimitSlot,
  configureMaxRequestsPerSecond,
  getRateLimiterState,
  pauseRateLimiter,
  RateLimitConfigurationError,
  resetRateLimiterForTests,
  SEC_MAX_REQUESTS_PER_SECOND,
} from './rate-limit.ts';

/**
 * Invariant 4.6, second half. These run on fake timers against the limiter
 * directly - no sockets - so a one-second window costs no wall-clock time and
 * the assertions are about admission counts rather than about elapsed real time.
 */

function admitMany(count: number): {
  readonly admitted: () => number;
  readonly settled: Promise<unknown>;
} {
  let admitted = 0;
  const all = Promise.all(
    Array.from({ length: count }, () =>
      acquireRateLimitSlot().then(() => {
        admitted += 1;
      }),
    ),
  );

  return { admitted: () => admitted, settled: all };
}

beforeEach(() => {
  resetRateLimiterForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  resetRateLimiterForTests();
});

describe('process-wide rate limit', () => {
  it('admits no more than 10 requests in a one-second window', async () => {
    const run = admitMany(25);

    await vi.advanceTimersByTimeAsync(1);
    expect(run.admitted()).toBe(SEC_MAX_REQUESTS_PER_SECOND);

    await vi.advanceTimersByTimeAsync(999);
    expect(run.admitted()).toBe(20);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(run.admitted()).toBe(25);

    await run.settled;
  });

  it('slides the window instead of resetting it, so a burst cannot straddle a boundary', async () => {
    const first = admitMany(10);

    await vi.advanceTimersByTimeAsync(1);
    expect(first.admitted()).toBe(10);

    // 900ms later a fixed one-second bucket would be about to reset and would
    // admit ten more at the boundary - twenty inside one real second.
    await vi.advanceTimersByTimeAsync(900);

    const second = admitMany(10);

    await vi.advanceTimersByTimeAsync(98);
    expect(second.admitted()).toBe(0);

    await vi.advanceTimersByTimeAsync(2);
    expect(second.admitted()).toBe(10);

    await Promise.all([first.settled, second.settled]);
  });

  it('holds every caller off while paused, not just the one that saw the 429', async () => {
    pauseRateLimiter(Date.now() + 5_000);

    const run = admitMany(3);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(run.admitted()).toBe(0);

    await vi.advanceTimersByTimeAsync(2);
    expect(run.admitted()).toBe(3);

    await run.settled;
  });

  it('refuses a ceiling above the SEC limit', () => {
    expect(() => configureMaxRequestsPerSecond(11)).toThrow(RateLimitConfigurationError);
    expect(() => configureMaxRequestsPerSecond(1_000)).toThrow(RateLimitConfigurationError);
    expect(() => configureMaxRequestsPerSecond(0)).toThrow(RateLimitConfigurationError);
    expect(() => configureMaxRequestsPerSecond(2.5)).toThrow(RateLimitConfigurationError);
    expect(() => configureMaxRequestsPerSecond(Number.POSITIVE_INFINITY)).toThrow(
      RateLimitConfigurationError,
    );
  });

  it('accepts a lower ceiling and enforces that instead', async () => {
    configureMaxRequestsPerSecond(3);

    const run = admitMany(7);

    await vi.advanceTimersByTimeAsync(1);
    expect(run.admitted()).toBe(3);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(run.admitted()).toBe(6);

    await vi.advanceTimersByTimeAsync(1_000);
    await run.settled;
  });

  it('reports its own state for assertions and health checks', async () => {
    const run = admitMany(4);

    await vi.advanceTimersByTimeAsync(1);

    const state = getRateLimiterState();

    expect(state.limit).toBe(SEC_MAX_REQUESTS_PER_SECOND);
    expect(state.inWindow).toBe(4);
    expect(state.admittedTotal).toBe(4);

    await run.settled;
  });
});
