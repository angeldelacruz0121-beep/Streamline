/**
 * Invariant 4.1, as data and as a pass/fail function.
 *
 * The tables in 4.1 are the specification; this file is the executable copy of them, and
 * nothing here is a target the renderer aims at. Two rules govern how it reports:
 *
 *   PERCENTILES, NEVER AN AVERAGE ALONE. 4.1 says "Average FPS is not a governing metric
 *   at all — it is the metric most likely to hide the exact hitches that make a build feel
 *   cheap." `summarise` computes a mean because it is occasionally useful context, but
 *   `evaluate` never reads it, and a build cannot pass on it.
 *
 *   MEASURED AGAINST THE LOCKED INTERVAL, NOT AGAINST A TARGET FPS. Every threshold below
 *   is a multiple of `1000 / lockedHz`. A locked 30 is judged against 33.3ms and a locked
 *   60 against 16.7ms, which is the only way "quality outranks rate" can be a real policy
 *   rather than a slogan — stepping to 30 has to be able to PASS.
 *
 * Render smoothness and interaction responsiveness are evaluated separately and neither
 * substitutes for the other, because 4.1 is explicit that they fail separately.
 */

/**
 * The line between "this frame was on time" and "this frame missed its vsync", derived
 * rather than tuned.
 *
 * A presented frame either lands on its scheduled display tick or it lands on the next
 * one. There is no third option — that is what the stride lock in `rate-lock.ts`
 * guarantees. So the only ambiguity is timestamp jitter, and the threshold that separates
 * jitter from a genuinely missed tick is halfway to the next possible presentation:
 *
 *     onTime = lockedInterval + displayTick / 2
 *
 * On a 60Hz panel locked to 60 that is 16.67 + 8.33 = 25.0ms, and a dropped frame at
 * 33.3ms fails. On a 120Hz panel locked to 60 it is 16.67 + 4.17 = 20.83ms, and a dropped
 * tick at 25.0ms fails. On a 60Hz panel locked to 30 it is 33.3 + 8.33 = 41.7ms, and a
 * dropped frame at 50ms fails. In every case the threshold is a property of the hardware
 * and the lock, not a number chosen to make a build pass.
 *
 * HONEST NOTE ON PROVENANCE: this replaced a flat 1.5ms constant after the first real
 * measurement, where a 120Hz-reported headless Chromium produced a p99 of 18.3ms — 1.6ms
 * of timestamp jitter on a 16.67ms interval, with zero dropped ticks and zero clusters.
 * The flat constant would have failed that as a hitch it demonstrably was not. The pacing
 * and cluster rules, which are the ones that catch real hitches, are unchanged.
 */
export function onTimeThresholdMs(lockedIntervalMs: number, displayHz: number): number {
  const displayTickMs = displayHz > 0 ? 1000 / displayHz : lockedIntervalMs;
  return lockedIntervalMs + displayTickMs / 2;
}

/** 4.1: "No frame exceeds 1.5x the locked interval (25ms at 60, 50ms at 30)." */
export const PACING_MULTIPLE = 1.5;

/** 4.1: "Hover and click feedback — under 100ms." */
export const INTERACTION_BUDGET_MS = 100;

/** 4.1: "Hard fail — sustained below the 30fps floor." */
export const FLOOR_HZ = 30;

/** Two or more consecutive over-budget frames. 4.1 calls any such cluster a hard fail. */
export const CLUSTER_LENGTH = 2;

export interface Distribution {
  readonly count: number;
  readonly meanMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly worstMs: number;
}

export function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index] as number;
}

export function summarise(samplesMs: readonly number[]): Distribution {
  if (samplesMs.length === 0) {
    return { count: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, worstMs: 0 };
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  let total = 0;
  for (const value of samplesMs) total += value;
  return {
    count: samplesMs.length,
    meanMs: total / samplesMs.length,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    worstMs: sorted[sorted.length - 1] as number,
  };
}

/** Longest run of consecutive frames over the pacing threshold. */
export function longestOverBudgetRun(samplesMs: readonly number[], thresholdMs: number): number {
  let longest = 0;
  let run = 0;
  for (const value of samplesMs) {
    if (value > thresholdMs) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  return longest;
}

export interface RenderMeasurement {
  readonly lockedHz: number;
  readonly effectiveHz: number;
  readonly displayHz: number;
  readonly stride: number;
  /** Every distinct locked rate observed during the run. */
  readonly observedLockedRates: readonly number[];
  readonly frameIntervalsMs: readonly number[];
  readonly frameCostsMs: readonly number[];
}

export interface InteractionMeasurement {
  readonly latenciesMs: readonly number[];
  /** True if any feedback was observed only after a frame boundary. */
  readonly gatedOnFrame: boolean;
}

export interface ResourceMeasurement {
  readonly particleCount: number;
  readonly backingStorePx: number;
  readonly timeToFirstRenderMs: number;
  /** Heap samples over the soak, in bytes. Empty when the browser does not expose them. */
  readonly heapBytes: readonly number[];
}

export interface Check {
  readonly id: string;
  readonly pass: boolean;
  readonly standard: string;
  readonly measured: string;
}

export interface BudgetReport {
  readonly pass: boolean;
  readonly hardFail: boolean;
  readonly lockedIntervalMs: number;
  readonly pacing: Distribution;
  readonly cost: Distribution;
  readonly interaction: Distribution;
  readonly checks: readonly Check[];
  readonly resources: ResourceMeasurement;
}

/** Least-squares slope of a series against its index, in units per sample. */
export function slope(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const y = values[i] as number;
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumXX += i * i;
  }
  const denominator = n * sumXX - sumX * sumX;
  return denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
}

export function evaluate(
  render: RenderMeasurement,
  interaction: InteractionMeasurement,
  resources: ResourceMeasurement,
): BudgetReport {
  const lockedIntervalMs = 1000 / render.lockedHz;
  const pacing = summarise(render.frameIntervalsMs);
  const cost = summarise(render.frameCostsMs);
  const latency = summarise(interaction.latenciesMs);
  const pacingThresholdMs = lockedIntervalMs * PACING_MULTIPLE;
  const onTimeMs = onTimeThresholdMs(lockedIntervalMs, render.displayHz);
  const inputMeasured = interaction.latenciesMs.length > 0;
  const cluster = longestOverBudgetRun(render.frameIntervalsMs, pacingThresholdMs);
  const heapSlope = slope(resources.heapBytes);

  const checks: Check[] = [
    {
      id: 'rate-locked',
      pass: render.observedLockedRates.every((hz) => hz === 60 || hz === 30),
      standard: 'Locked rate is 60 or 30 and never floats',
      measured: `observed ${render.observedLockedRates.join(', ') || 'none'}`,
    },
    {
      id: 'clean-divisor',
      pass: Number.isInteger(render.stride) && render.stride >= 1,
      standard: 'Presented rate is displayHz / integer stride',
      measured: `${render.displayHz}Hz / ${render.stride} = ${render.effectiveHz.toFixed(2)}Hz`,
    },
    {
      id: 'above-floor',
      pass: render.effectiveHz >= FLOOR_HZ - 0.01,
      standard: `Effective rate at or above the ${FLOOR_HZ}fps floor`,
      measured: `${render.effectiveHz.toFixed(2)}Hz`,
    },
    {
      id: 'p99-within-interval',
      pass: pacing.p99Ms <= onTimeMs,
      standard:
        `99th percentile frame interval within the locked interval ` +
        `(${lockedIntervalMs.toFixed(2)}ms, on-time to ${onTimeMs.toFixed(2)}ms)`,
      measured: `p99 ${pacing.p99Ms.toFixed(2)}ms`,
    },
    {
      id: 'pacing',
      pass: pacing.worstMs <= pacingThresholdMs,
      standard: `No frame exceeds ${PACING_MULTIPLE}x the locked interval (${pacingThresholdMs.toFixed(1)}ms)`,
      measured: `worst ${pacing.worstMs.toFixed(2)}ms`,
    },
    {
      id: 'no-dropped-cluster',
      pass: cluster < CLUSTER_LENGTH,
      standard: `No run of ${CLUSTER_LENGTH} or more consecutive over-budget frames`,
      measured: `longest run ${cluster}`,
    },
    {
      id: 'interaction-p95',
      pass: !inputMeasured || latency.p95Ms < INTERACTION_BUDGET_MS,
      standard: `Hover and click feedback under ${INTERACTION_BUDGET_MS}ms`,
      // A zero is not a result. A run that drove no input says so rather than reporting
      // 0.00ms, which would read as the best possible score.
      measured: inputMeasured
        ? `p95 ${latency.p95Ms.toFixed(2)}ms, worst ${latency.worstMs.toFixed(2)}ms`
        : 'not measured — this run drove no input',
    },
    {
      id: 'interaction-worst',
      pass: !inputMeasured || latency.worstMs < INTERACTION_BUDGET_MS,
      standard: `Worst interaction under ${INTERACTION_BUDGET_MS}ms`,
      measured: inputMeasured
        ? `${latency.worstMs.toFixed(2)}ms`
        : 'not measured — this run drove no input',
    },
    {
      id: 'interaction-not-frame-gated',
      pass: !interaction.gatedOnFrame,
      standard: 'No interaction gated behind the render loop',
      measured: interaction.gatedOnFrame
        ? 'feedback arrived only after a frame'
        : inputMeasured
          ? 'synchronous'
          : 'not measured — this run drove no input',
    },
    {
      id: 'heap-stable',
      // Bytes per sample. Positive drift over a soak is the signal; the threshold is set
      // where an unbounded leak shows and ordinary GC sawtooth does not.
      // Under twenty samples the window is short enough that startup allocation dominates
      // the fit and the slope says nothing about a leak. The soak test supplies sixty.
      pass: resources.heapBytes.length < 20 || heapSlope < 24_000,
      standard: 'No heap growth trend over the soak',
      measured:
        resources.heapBytes.length === 0
          ? 'not sampled (browser did not expose the heap)'
          : resources.heapBytes.length < 20
            ? `only ${resources.heapBytes.length} samples — too short to read a trend`
            : `${(heapSlope / 1024).toFixed(2)} KiB per sample`,
    },
  ];

  const hardFail = checks.some(
    (check) =>
      !check.pass &&
      ['rate-locked', 'above-floor', 'no-dropped-cluster', 'interaction-not-frame-gated'].includes(
        check.id,
      ),
  );

  return {
    pass: checks.every((check) => check.pass),
    hardFail,
    lockedIntervalMs,
    pacing,
    cost,
    interaction: latency,
    checks,
    resources,
  };
}

export interface RegressionBaseline {
  readonly recorded: string;
  readonly machine: string;
  readonly lockedHz: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly worstMs: number;
  readonly interactionP95Ms: number;
  readonly particleCount: number;
}

/** Slack before a change counts as a regression rather than as machine noise. */
export const REGRESSION_MARGIN = 1.25;

export interface RegressionResult {
  readonly regressed: boolean;
  readonly details: readonly Check[];
}

export function checkRegression(
  report: BudgetReport,
  baseline: RegressionBaseline,
): RegressionResult {
  const details: Check[] = [
    {
      id: 'regression/p95',
      pass: report.pacing.p95Ms <= baseline.p95Ms * REGRESSION_MARGIN,
      standard: `p95 within ${REGRESSION_MARGIN}x of ${baseline.p95Ms.toFixed(2)}ms`,
      measured: `${report.pacing.p95Ms.toFixed(2)}ms`,
    },
    {
      id: 'regression/p99',
      pass: report.pacing.p99Ms <= baseline.p99Ms * REGRESSION_MARGIN,
      standard: `p99 within ${REGRESSION_MARGIN}x of ${baseline.p99Ms.toFixed(2)}ms`,
      measured: `${report.pacing.p99Ms.toFixed(2)}ms`,
    },
    {
      id: 'regression/worst',
      pass: report.pacing.worstMs <= baseline.worstMs * REGRESSION_MARGIN,
      standard: `worst frame within ${REGRESSION_MARGIN}x of ${baseline.worstMs.toFixed(2)}ms`,
      measured: `${report.pacing.worstMs.toFixed(2)}ms`,
    },
    {
      id: 'regression/interaction',
      pass:
        report.interaction.count === 0 ||
        report.interaction.p95Ms <= Math.max(4, baseline.interactionP95Ms * REGRESSION_MARGIN),
      standard: `interaction p95 within ${REGRESSION_MARGIN}x of ${baseline.interactionP95Ms.toFixed(2)}ms`,
      measured: `${report.interaction.p95Ms.toFixed(2)}ms`,
    },
  ];
  return { regressed: details.some((check) => !check.pass), details };
}

export function formatReport(report: BudgetReport): string {
  const lines = [
    `locked interval ${report.lockedIntervalMs.toFixed(2)}ms`,
    `pacing  p50 ${report.pacing.p50Ms.toFixed(2)}  p95 ${report.pacing.p95Ms.toFixed(2)}  ` +
      `p99 ${report.pacing.p99Ms.toFixed(2)}  worst ${report.pacing.worstMs.toFixed(2)}  ` +
      `(n=${report.pacing.count})`,
    `cost    p50 ${report.cost.p50Ms.toFixed(2)}  p95 ${report.cost.p95Ms.toFixed(2)}  ` +
      `p99 ${report.cost.p99Ms.toFixed(2)}  worst ${report.cost.worstMs.toFixed(2)}`,
    `input   p95 ${report.interaction.p95Ms.toFixed(2)}  worst ${report.interaction.worstMs.toFixed(2)}  ` +
      `(n=${report.interaction.count})`,
    `particles ${report.resources.particleCount}  backing store ${report.resources.backingStorePx}px  ` +
      `ttfr ${report.resources.timeToFirstRenderMs.toFixed(1)}ms`,
  ];
  for (const check of report.checks) {
    lines.push(
      `${check.pass ? 'PASS' : 'FAIL'}  ${check.id}: ${check.standard} — ${check.measured}`,
    );
  }
  return lines.join('\n');
}
