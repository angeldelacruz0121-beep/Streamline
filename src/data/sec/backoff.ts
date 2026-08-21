/**
 * Retry policy for EDGAR. Narrow on purpose: only statuses EDGAR uses to mean
 * "later, not never" are retried, and only for idempotent GETs, which is all
 * this client issues.
 */

/** Statuses worth a second attempt. 403 is absent deliberately - see below. */
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

/**
 * 403 is not retryable. EDGAR returns it for a missing or unacceptable
 * User-Agent, which retrying cannot fix and repeating makes worse.
 */
export const MAX_ATTEMPTS = 4;

/**
 * One full rate window. Anything shorter retries inside the same second that
 * produced the throttle.
 */
export const BASE_DELAY_MS = 1_000;

export const MAX_DELAY_MS = 32_000;

/**
 * A `Retry-After` longer than this is honoured as an instruction, not as a
 * delay: the request stops and returns `rate-limited` carrying the interval.
 * Sleeping for minutes inside a request would hide a service state the caller
 * needs to see, and ignoring EDGAR's number would be worse.
 */
export const MAX_HONORED_RETRY_AFTER_MS = MAX_DELAY_MS;

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

/**
 * `Retry-After` in either documented form: delta-seconds, or an HTTP-date.
 * Returns milliseconds from `nowEpochMs`, or `null` when absent or unparseable.
 * Never negative - a stale date means "now" - and never truncated: EDGAR's
 * number is reported as given, and the decision to wait or give up is made by
 * the caller against `MAX_HONORED_RETRY_AFTER_MS`.
 */
export function parseRetryAfter(headerValue: string | null, nowEpochMs: number): number | null {
  if (headerValue === null) {
    return null;
  }

  const value = headerValue.trim();

  if (value.length === 0) {
    return null;
  }

  if (/^\d+$/.test(value)) {
    return Number(value) * 1_000;
  }

  const asDate = Date.parse(value);

  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.max(0, asDate - nowEpochMs);
}

/**
 * Equal jitter: half the exponential cap plus a random half. Full jitter is the
 * more common recommendation and is wrong here - its near-zero draws retry
 * inside the same one-second window that produced the 429, which is the precise
 * behaviour the SEC blocks IPs for. This never returns a delay below half the
 * cap, and still spreads concurrent retries.
 *
 * `Retry-After` always wins when EDGAR sends one: an explicit instruction beats
 * a heuristic.
 */
export function backoffDelayMs(
  attempt: number,
  retryAfterMs: number | null,
  random: () => number = Math.random,
): number {
  if (retryAfterMs !== null) {
    return retryAfterMs;
  }

  const cap = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1), MAX_DELAY_MS);

  return Math.round(cap / 2 + random() * (cap / 2));
}
