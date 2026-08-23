// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryCacheStore } from '../cache/store.ts';
import { TEST_CONTACT_EMAIL } from './__fixtures__/shape-probes.ts';
import { MAX_ATTEMPTS } from './backoff.ts';
import { submissionsUrl } from './endpoints.ts';
import { getRateLimiterState, resetRateLimiterForTests } from './rate-limit.ts';
import { fetchEdgar, type EdgarTransport } from './transport.ts';
import { composeUserAgent } from './user-agent.ts';

const USER_AGENT = composeUserAgent(TEST_CONTACT_EMAIL);
const URL_UNDER_TEST = submissionsUrl('0000789019');

interface Planned {
  readonly status: number;
  readonly body?: string;
  readonly headers?: Record<string, string>;
  readonly throws?: boolean;
}

function stub(plan: readonly Planned[]): { transport: EdgarTransport; calls: Request[] } {
  const calls: Request[] = [];
  let index = 0;

  const transport: EdgarTransport = (request) => {
    calls.push(request);

    const next = plan[Math.min(index, plan.length - 1)];

    index += 1;

    if (next?.throws === true) {
      return Promise.reject(new Error('socket hang up'));
    }

    const status = next?.status ?? 200;
    // 204/205/304 are null-body statuses; the platform Response constructor
    // throws if given content for one.
    const body = status === 204 || status === 205 || status === 304 ? null : (next?.body ?? '{}');

    return Promise.resolve(
      new Response(body, {
        status,
        headers: next?.headers ?? {},
      }),
    );
  };

  return { transport, calls };
}

function run(transport: EdgarTransport, cache = new MemoryCacheStore()) {
  return fetchEdgar({
    url: URL_UNDER_TEST,
    accept: 'application/json',
    userAgent: USER_AGENT,
    transport,
    cache,
    random: () => 0.5,
  });
}

beforeEach(() => {
  resetRateLimiterForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  resetRateLimiterForTests();
});

describe('backoff against a simulated 429', () => {
  it('waits the interval EDGAR asked for, then succeeds', async () => {
    const { transport, calls } = stub([
      { status: 429, headers: { 'retry-after': '2' } },
      { status: 200, body: '{"ok":true}' },
    ]);
    const pending = run(transport);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(calls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(2);
    const outcome = await pending;

    expect(calls).toHaveLength(2);
    expect(outcome.kind).toBe('body');
  });

  it('pauses the whole process, not just the throttled request', async () => {
    const { transport } = stub([{ status: 429, headers: { 'retry-after': '2' } }, { status: 200 }]);
    const started = Date.now();
    const pending = run(transport);

    await vi.advanceTimersByTimeAsync(1);
    expect(getRateLimiterState().pausedUntil).toBeGreaterThanOrEqual(started + 2_000);

    await vi.advanceTimersByTimeAsync(5_000);
    await pending;
  });

  it('gives up after the retry budget and says so as a typed result', async () => {
    const { transport, calls } = stub([{ status: 429, headers: { 'retry-after': '1' } }]);
    const pending = run(transport);

    await vi.advanceTimersByTimeAsync(60_000);
    const outcome = await pending;

    expect(calls).toHaveLength(MAX_ATTEMPTS);
    expect(outcome.kind).toBe('rate-limited');
    expect(outcome.kind === 'rate-limited' && outcome.attempts).toBe(MAX_ATTEMPTS);
    expect(outcome.kind === 'rate-limited' && outcome.retryAfterMs).toBe(1_000);
  });

  it('backs off exponentially when EDGAR sends no Retry-After', async () => {
    const { transport, calls } = stub([{ status: 503 }]);
    const pending = run(transport);

    // Equal jitter at random()=0.5: 750ms, then 1500ms, then 3000ms.
    await vi.advanceTimersByTimeAsync(749);
    expect(calls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1_500);
    expect(calls).toHaveLength(3);

    await vi.advanceTimersByTimeAsync(60_000);
    await pending;
  });

  it('treats a long Retry-After as an instruction rather than sleeping through it', async () => {
    const { transport, calls } = stub([{ status: 429, headers: { 'retry-after': '600' } }]);
    const pending = run(transport);

    await vi.advanceTimersByTimeAsync(1);
    const outcome = await pending;

    expect(calls).toHaveLength(1);
    expect(outcome.kind).toBe('rate-limited');
    expect(outcome.kind === 'rate-limited' && outcome.retryAfterMs).toBe(600_000);
    expect(getRateLimiterState().pausedUntil).toBeGreaterThan(Date.now() + 599_000);
  });

  it('retries a dropped socket but not a 403', async () => {
    const flaky = stub([{ status: 0, throws: true }, { status: 200 }]);
    const pendingFlaky = run(flaky.transport);

    await vi.advanceTimersByTimeAsync(60_000);
    expect((await pendingFlaky).kind).toBe('body');
    expect(flaky.calls).toHaveLength(2);

    const forbidden = stub([{ status: 403 }]);
    const pendingForbidden = run(forbidden.transport);

    await vi.advanceTimersByTimeAsync(60_000);
    const outcome = await pendingForbidden;

    expect(forbidden.calls).toHaveLength(1);
    expect(outcome.kind).toBe('transport-error');
    expect(outcome.kind === 'transport-error' && outcome.detail).toContain('403');
  });
});

describe('cache behaviour at the transport', () => {
  it('serves a fresh entry without spending a rate-limit slot', async () => {
    const cache = new MemoryCacheStore();
    const { transport, calls } = stub([{ status: 200, body: '{"ok":true}' }]);

    await run(transport, cache);
    expect(getRateLimiterState().admittedTotal).toBe(1);

    const second = await run(transport, cache);

    expect(calls).toHaveLength(1);
    expect(second.kind === 'body' && second.provenance.fromCache).toBe(true);
    expect(getRateLimiterState().admittedTotal).toBe(1);
  });

  it('remembers a 404 as a typed absence instead of re-asking', async () => {
    const cache = new MemoryCacheStore();
    const { transport, calls } = stub([{ status: 404 }]);

    const first = await run(transport, cache);
    const second = await run(transport, cache);

    expect(first.kind).toBe('not-found');
    expect(second.kind).toBe('not-found');
    expect(second.provenance.fromCache).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('revalidates a stale entry with a conditional request and accepts 304', async () => {
    vi.setSystemTime(Date.parse('2026-07-29T16:00:00.000Z'));

    const cache = new MemoryCacheStore();
    const { transport, calls } = stub([
      { status: 200, body: '{"ok":true}', headers: { etag: 'W/"probe"' } },
      { status: 304 },
    ]);

    await run(transport, cache);

    vi.setSystemTime(Date.parse('2026-07-29T18:30:00.000Z'));

    const outcome = await run(transport, cache);

    expect(calls).toHaveLength(2);
    expect(calls[1]?.headers.get('if-none-match')).toBe('W/"probe"');
    expect(outcome.kind === 'body' && outcome.entry.body).toBe('{"ok":true}');
    expect(outcome.kind === 'body' && outcome.provenance.status).toBe(304);
  });

  it('records why a cached entry has the lifetime it has', async () => {
    const cache = new MemoryCacheStore();

    await run(stub([{ status: 200 }]).transport, cache);

    expect((await cache.get(URL_UNDER_TEST))?.reason).toContain('acceptance hours');
  });
});
