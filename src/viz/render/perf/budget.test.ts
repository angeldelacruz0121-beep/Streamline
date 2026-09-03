import { describe, expect, it } from 'vitest';
import {
  INTERACTION_BUDGET_MS,
  PACING_MULTIPLE,
  checkRegression,
  evaluate,
  formatReport,
  longestOverBudgetRun,
  onTimeThresholdMs,
  percentile,
  slope,
  summarise,
  type InteractionMeasurement,
  type RenderMeasurement,
  type ResourceMeasurement,
} from './budget';

function frames(count: number, ms: number): number[] {
  return Array.from({ length: count }, () => ms);
}

const cleanResources: ResourceMeasurement = {
  particleCount: 3_200,
  backingStorePx: 4_000_000,
  timeToFirstRenderMs: 40,
  heapBytes: [],
};

const cleanInteraction: InteractionMeasurement = {
  latenciesMs: frames(50, 0.4),
  gatedOnFrame: false,
};

function render(overrides: Partial<RenderMeasurement> = {}): RenderMeasurement {
  return {
    lockedHz: 60,
    effectiveHz: 60,
    displayHz: 60,
    stride: 1,
    observedLockedRates: [60],
    frameIntervalsMs: frames(600, 16.67),
    frameCostsMs: frames(600, 4),
    ...overrides,
  };
}

describe('percentiles', () => {
  it('reports p95, p99 and worst, not just a mean', () => {
    const samples = [...frames(99, 10), 100];
    const distribution = summarise(samples);
    expect(distribution.p50Ms).toBe(10);
    expect(distribution.p99Ms).toBe(10);
    expect(distribution.worstMs).toBe(100);
    // The exact failure mode Invariant 4.1 names: the mean looks fine and the worst frame
    // is a visible hitch.
    expect(distribution.meanMs).toBeCloseTo(10.9, 1);
  });

  it('is empty-safe', () => {
    expect(summarise([])).toEqual({
      count: 0,
      meanMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      worstMs: 0,
    });
    expect(percentile([], 0.95)).toBe(0);
  });

  it('finds the longest run of consecutive over-budget frames', () => {
    expect(longestOverBudgetRun([1, 40, 1, 40, 40, 40, 1], 25)).toBe(3);
    expect(longestOverBudgetRun([1, 1, 1], 25)).toBe(0);
  });

  it('computes a least-squares slope for the heap soak', () => {
    expect(slope([1, 2, 3, 4])).toBeCloseTo(1, 9);
    expect(slope([5, 5, 5, 5])).toBeCloseTo(0, 9);
    expect(slope([4])).toBe(0);
  });
});

describe('evaluate — Invariant 4.1', () => {
  it('passes a clean locked-60 run', () => {
    const report = evaluate(render(), cleanInteraction, cleanResources);
    expect(report.pass, formatReport(report)).toBe(true);
    expect(report.hardFail).toBe(false);
  });

  it('passes a clean locked-30 run — stepping the rate down must be able to pass', () => {
    // The whole "quality outranks rate" policy depends on this. If the harness judged 30
    // against a 60 budget, the ladder's first rung would always look like a failure.
    const report = evaluate(
      render({
        lockedHz: 30,
        effectiveHz: 30,
        stride: 2,
        observedLockedRates: [30],
        frameIntervalsMs: frames(600, 33.33),
      }),
      cleanInteraction,
      cleanResources,
    );
    expect(report.lockedIntervalMs).toBeCloseTo(33.33, 1);
    expect(report.pass, formatReport(report)).toBe(true);
  });

  it('hard-fails a floating rate even when every frame is fast', () => {
    const report = evaluate(
      render({ observedLockedRates: [60, 48, 30], frameIntervalsMs: frames(600, 8) }),
      cleanInteraction,
      cleanResources,
    );
    expect(report.hardFail).toBe(true);
    expect(report.checks.find((c) => c.id === 'rate-locked')?.pass).toBe(false);
  });

  it('hard-fails below the 30fps floor', () => {
    const report = evaluate(
      render({
        lockedHz: 30,
        effectiveHz: 25,
        stride: 3,
        displayHz: 75,
        observedLockedRates: [30],
      }),
      cleanInteraction,
      cleanResources,
    );
    expect(report.hardFail).toBe(true);
  });

  it('hard-fails a dropped-frame cluster', () => {
    const intervals = [...frames(598, 16.67), 40, 40];
    const report = evaluate(
      render({ frameIntervalsMs: intervals }),
      cleanInteraction,
      cleanResources,
    );
    expect(report.checks.find((c) => c.id === 'no-dropped-cluster')?.pass).toBe(false);
    expect(report.hardFail).toBe(true);
  });

  it('fails pacing when one frame exceeds 1.5x the locked interval', () => {
    const intervals = [...frames(599, 16.67), 16.67 * PACING_MULTIPLE + 1];
    const report = evaluate(
      render({ frameIntervalsMs: intervals }),
      cleanInteraction,
      cleanResources,
    );
    expect(report.checks.find((c) => c.id === 'pacing')?.pass).toBe(false);
    // A single slow frame is a failure but not a hard fail; a cluster is.
    expect(report.hardFail).toBe(false);
  });

  it('derives the on-time threshold from the panel, not from a tuned constant', () => {
    expect(onTimeThresholdMs(1000 / 60, 60)).toBeCloseTo(25, 6);
    expect(onTimeThresholdMs(1000 / 60, 120)).toBeCloseTo(20.833, 3);
    expect(onTimeThresholdMs(1000 / 30, 60)).toBeCloseTo(41.667, 3);
  });

  it('does not treat vsync timestamp jitter as a dropped frame', () => {
    // 18.3ms on a 120Hz panel locked to 60: 1.6ms of jitter, no tick missed.
    const jittery = evaluate(
      render({ displayHz: 120, stride: 2, frameIntervalsMs: frames(600, 18.3) }),
      cleanInteraction,
      cleanResources,
    );
    expect(jittery.checks.find((c) => c.id === 'p99-within-interval')?.pass).toBe(true);
  });

  it('still fails a genuinely missed tick', () => {
    // 25ms on the same panel is one whole extra display tick. That is a dropped frame.
    const dropped = evaluate(
      render({
        displayHz: 120,
        stride: 2,
        frameIntervalsMs: [...frames(500, 16.67), ...frames(100, 25.1)],
      }),
      cleanInteraction,
      cleanResources,
    );
    expect(dropped.checks.find((c) => c.id === 'p99-within-interval')?.pass).toBe(false);
  });

  it('reports "not measured" rather than 0.00ms when a run drove no input', () => {
    // A zero would read as a perfect score. The harness must not be able to pass a
    // standard it never exercised.
    const report = evaluate(render(), { latenciesMs: [], gatedOnFrame: false }, cleanResources);
    const p95 = report.checks.find((c) => c.id === 'interaction-p95');
    expect(p95?.measured).toContain('not measured');
    expect(report.checks.find((c) => c.id === 'interaction-not-frame-gated')?.measured).toContain(
      'not measured',
    );
  });

  it('judges interaction separately from render rate', () => {
    // Render is perfect; input is not. The report must fail, which is the point of the
    // two standards being independent.
    const report = evaluate(
      render(),
      { latenciesMs: [...frames(40, 2), 140], gatedOnFrame: false },
      cleanResources,
    );
    expect(report.checks.find((c) => c.id === 'interaction-worst')?.pass).toBe(false);
    expect(report.checks.find((c) => c.id === 'pacing')?.pass).toBe(true);
    expect(report.pass).toBe(false);
  });

  it('hard-fails interaction gated behind the render loop', () => {
    const report = evaluate(
      render(),
      { latenciesMs: frames(40, 1), gatedOnFrame: true },
      cleanResources,
    );
    expect(report.hardFail).toBe(true);
  });

  it('states the interaction budget as 100ms', () => {
    expect(INTERACTION_BUDGET_MS).toBe(100);
  });

  it('flags a heap that trends upward and forgives GC sawtooth', () => {
    const leaking = evaluate(render(), cleanInteraction, {
      ...cleanResources,
      heapBytes: Array.from({ length: 60 }, (_, i) => 10_000_000 + i * 500_000),
    });
    expect(leaking.checks.find((c) => c.id === 'heap-stable')?.pass).toBe(false);

    const sawtooth = evaluate(render(), cleanInteraction, {
      ...cleanResources,
      heapBytes: Array.from({ length: 60 }, (_, i) => 10_000_000 + (i % 10) * 200_000),
    });
    expect(sawtooth.checks.find((c) => c.id === 'heap-stable')?.pass).toBe(true);
  });

  it('says so plainly when the heap was never sampled', () => {
    const report = evaluate(render(), cleanInteraction, cleanResources);
    const heap = report.checks.find((c) => c.id === 'heap-stable');
    expect(heap?.pass).toBe(true);
    expect(heap?.measured).toContain('not sampled');
  });

  it('refuses to read a trend from a handful of samples', () => {
    // Nine samples over a few seconds are dominated by startup allocation. Calling that
    // a leak is as wrong as calling a real leak noise.
    const report = evaluate(render(), cleanInteraction, {
      ...cleanResources,
      heapBytes: Array.from({ length: 9 }, (_, i) => 10_000_000 + i * 800_000),
    });
    const heap = report.checks.find((c) => c.id === 'heap-stable');
    expect(heap?.pass).toBe(true);
    expect(heap?.measured).toContain('too short to read a trend');
  });

  it('formats a report that names every failing check', () => {
    const report = evaluate(
      render({ observedLockedRates: [60, 45] }),
      cleanInteraction,
      cleanResources,
    );
    const text = formatReport(report);
    expect(text).toContain('FAIL  rate-locked');
    expect(text).toContain('p99');
    expect(text).toContain('worst');
  });
});

describe('regression gate', () => {
  const baseline = {
    recorded: '2026-08-21T00:00:00.000Z',
    machine: 'reference',
    lockedHz: 60,
    p95Ms: 16.7,
    p99Ms: 16.9,
    worstMs: 20,
    interactionP95Ms: 1.5,
    particleCount: 3_200,
  };

  it('passes an unchanged run', () => {
    const report = evaluate(render(), cleanInteraction, cleanResources);
    expect(checkRegression(report, baseline).regressed).toBe(false);
  });

  it('fails when the worst frame regresses beyond the margin', () => {
    const report = evaluate(
      render({ frameIntervalsMs: [...frames(599, 16.67), 60] }),
      cleanInteraction,
      cleanResources,
    );
    const result = checkRegression(report, baseline);
    expect(result.regressed).toBe(true);
    expect(result.details.find((c) => c.id === 'regression/worst')?.pass).toBe(false);
  });

  it('does not call an on-time p99 a regression, even against a faster baseline (2026-09-01)', () => {
    // 1.2% of frames stamped at a half-tick: p99 lands at 24.9ms, past 16.9 x 1.25 = 21.1,
    // but inside the invariant's own on-time line (locked interval + half a display tick).
    const report = evaluate(
      render({ frameIntervalsMs: [...frames(593, 16.67), ...frames(7, 24.9)] }),
      cleanInteraction,
      cleanResources,
    );
    const result = checkRegression(report, baseline);
    expect(result.details.find((c) => c.id === 'regression/p99')?.pass).toBe(true);
    expect(result.regressed).toBe(false);
  });

  it('still calls a p99 past the on-time line a regression', () => {
    const report = evaluate(
      render({ frameIntervalsMs: [...frames(593, 16.67), ...frames(7, 33.3)] }),
      cleanInteraction,
      cleanResources,
    );
    expect(
      checkRegression(report, baseline).details.find((c) => c.id === 'regression/p99')?.pass,
    ).toBe(false);
  });

  it('does not call sub-millisecond input noise a regression', () => {
    const report = evaluate(
      render(),
      { latenciesMs: frames(50, 3), gatedOnFrame: false },
      cleanResources,
    );
    expect(checkRegression(report, baseline).regressed).toBe(false);
  });
});
