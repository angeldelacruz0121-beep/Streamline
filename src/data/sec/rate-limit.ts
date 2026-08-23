/**
 * Invariant 4.6, second half: a hard client-side ceiling of 10 requests per
 * second across the whole process.
 *
 * Sliding window, not a fixed bucket. A fixed one-second bucket permits twenty
 * requests inside a single second whenever a burst straddles the boundary -
 * ten at 0.99s, ten at 1.01s - which is exactly the traffic shape that gets an
 * IP blocked. This admits at most `limit` starts in any rolling 1000ms.
 *
 * The state lives on a `Symbol.for` registry key rather than in module scope so
 * that two copies of this module - a bundled one and a Node one, say - still
 * share one budget. "Across the whole process" is the requirement; per-instance
 * or per-module limiters would satisfy the letter and violate the point.
 *
 * There is no clock seam. The limiter reads `Date.now` and `globalThis.setTimeout`
 * at call time, which fake timers replace, so tests control the window without
 * an injection point that production code could reach through.
 */

/** The SEC's published ceiling. Not configurable upward. */
export const SEC_MAX_REQUESTS_PER_SECOND = 10;

/** The window the ceiling applies over. */
export const RATE_WINDOW_MS = 1_000;

const REGISTRY_KEY = Symbol.for('streamline.sec.rate-limiter.v1');

interface LimiterState {
  limit: number;
  starts: number[];
  pausedUntil: number;
  tail: Promise<void>;
  admittedTotal: number;
}

interface LimiterHost {
  [REGISTRY_KEY]?: LimiterState;
}

export class RateLimitConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitConfigurationError';
  }
}

function limiter(): LimiterState {
  const host = globalThis as LimiterHost;

  host[REGISTRY_KEY] ??= {
    limit: SEC_MAX_REQUESTS_PER_SECOND,
    starts: [],
    pausedUntil: 0,
    tail: Promise.resolve(),
    admittedTotal: 0,
  };

  return host[REGISTRY_KEY];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function prune(state: LimiterState, now: number): void {
  const cutoff = now - RATE_WINDOW_MS;

  while (state.starts.length > 0 && (state.starts[0] as number) <= cutoff) {
    state.starts.shift();
  }
}

async function admit(state: LimiterState): Promise<void> {
  for (;;) {
    const now = Date.now();

    prune(state, now);

    if (now < state.pausedUntil) {
      await sleep(state.pausedUntil - now);
      continue;
    }

    if (state.starts.length < state.limit) {
      state.starts.push(now);
      state.admittedTotal += 1;
      return;
    }

    const oldest = state.starts[0] as number;

    await sleep(Math.max(1, oldest + RATE_WINDOW_MS - now));
  }
}

/**
 * The only way to earn the right to make an EDGAR request. Resolves when a slot
 * is free. Acquisitions are serialised through a tail promise so concurrent
 * callers cannot both observe the same free slot and both take it.
 */
export function acquireRateLimitSlot(): Promise<void> {
  const state = limiter();
  const admission = state.tail.then(() => admit(state));

  state.tail = admission.then(
    () => undefined,
    () => undefined,
  );

  return admission;
}

/**
 * Stop issuing slots until `untilEpochMs`. Called when EDGAR answers 429 or 503:
 * a throttle aimed at one request applies to the whole process, so the pause is
 * global rather than confined to the request that discovered it.
 */
export function pauseRateLimiter(untilEpochMs: number): void {
  const state = limiter();

  state.pausedUntil = Math.max(state.pausedUntil, untilEpochMs);
}

/** Lower the ceiling. Raising it above the SEC limit throws - there is no override. */
export function configureMaxRequestsPerSecond(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > SEC_MAX_REQUESTS_PER_SECOND) {
    throw new RateLimitConfigurationError(
      `Refusing a rate limit of ${limit}. Invariant 4.6 caps EDGAR traffic at ` +
        `${SEC_MAX_REQUESTS_PER_SECOND} requests per second for the whole process; ` +
        `only integers in 1..${SEC_MAX_REQUESTS_PER_SECOND} are accepted.`,
    );
  }

  limiter().limit = limit;
}

/** Read-only view, for assertions and for the proxy's health endpoint. */
export function getRateLimiterState(): {
  readonly limit: number;
  readonly inWindow: number;
  readonly pausedUntil: number;
  readonly admittedTotal: number;
} {
  const state = limiter();

  prune(state, Date.now());

  return {
    limit: state.limit,
    inWindow: state.starts.length,
    pausedUntil: state.pausedUntil,
    admittedTotal: state.admittedTotal,
  };
}

/**
 * Test-only. Clears the window so one suite's traffic does not throttle the
 * next. `compliance.test.ts` asserts this symbol is referenced from test files
 * only, so it cannot become a production escape hatch.
 */
export function resetRateLimiterForTests(): void {
  const host = globalThis as LimiterHost;

  delete host[REGISTRY_KEY];
}
