/**
 * The CI gate. Invariant 4.1, measured in a real Chromium, and it fails the build.
 *
 * Every assertion below reads a percentile or a worst case. None reads an average — 4.1
 * says the average is the metric most likely to hide the exact hitches that make a build
 * feel cheap, so it is printed as context and never gated on.
 *
 * Render pacing and interaction latency are separate tests because they are separate
 * standards and they fail separately.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  checkRegression,
  longestOverBudgetRun,
  type BudgetReport,
  type RegressionBaseline,
} from './budget';
import type { HarnessOptions, HarnessResult } from './harness';

const FIXTURE = '/src/viz/render/perf/fixture.html';
const BASELINE_PATH = join(process.cwd(), 'src/viz/render/perf/baseline.json');

interface Bridge {
  runHarness: (options?: HarnessOptions) => Promise<HarnessResult>;
  evaluate: (result: HarnessResult) => BudgetReport;
  formatReport: (report: BudgetReport) => string;
  mount: (options?: HarnessOptions) => unknown;
  /** The mounted harness, while one is alive: its container takes in-page input. */
  current: { container: HTMLDivElement; result: () => HarnessResult } | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __streamlinePerf: Bridge;
}

async function open(page: Page): Promise<void> {
  await page.goto(FIXTURE);
  await page.waitForFunction(() => document.body.dataset.perfReady === 'true');
  // Settle. Locally the Vite dev server can fire an HMR reload just after the bridge
  // appears, which destroys the execution context mid-measurement.
  await page.waitForTimeout(250);
}

async function run(page: Page, options: HarnessOptions): Promise<HarnessResult> {
  return page.evaluate(async (opts) => globalThis.__streamlinePerf.runHarness(opts), options);
}

async function report(page: Page, result: HarnessResult): Promise<BudgetReport> {
  return page.evaluate((value) => globalThis.__streamlinePerf.evaluate(value), result);
}

async function attach(
  testInfo: {
    attach: (name: string, options: { body: string; contentType: string }) => Promise<void>;
  },
  name: string,
  result: HarnessResult,
  budget: BudgetReport,
): Promise<void> {
  const lines = [
    `machine: ${result.meta.userAgent}`,
    `load: ${result.meta.segments} segments, ${result.meta.lanes} lanes, uncapped=${String(result.meta.uncapped)}`,
    `content: ${Math.round(result.meta.contentPx.width)}x${Math.round(result.meta.contentPx.height)} css px`,
    `quality: ${result.meta.qualityLevel}`,
    `warmup excluded: ${result.meta.warmupFrames} frames (startup is reported as ttfr)`,
    '',
    formatBudget(budget),
  ];
  const body = lines.join('\n');
  await testInfo.attach(name, { body, contentType: 'text/plain' });
  // Printed as well as attached. A gate that hides its distribution is the average-FPS
  // failure mode in a different costume: the number that matters is the one you can see.
  process.stdout.write(`\n--- ${name} ---\n${body}\n`);
}

function formatBudget(budget: BudgetReport): string {
  const rows = [
    `locked interval ${budget.lockedIntervalMs.toFixed(2)}ms`,
    `pacing  p50 ${budget.pacing.p50Ms.toFixed(2)}  p95 ${budget.pacing.p95Ms.toFixed(2)}  p99 ${budget.pacing.p99Ms.toFixed(2)}  worst ${budget.pacing.worstMs.toFixed(2)}  n=${budget.pacing.count}`,
    `cost    p50 ${budget.cost.p50Ms.toFixed(2)}  p95 ${budget.cost.p95Ms.toFixed(2)}  p99 ${budget.cost.p99Ms.toFixed(2)}  worst ${budget.cost.worstMs.toFixed(2)}`,
    `input   p95 ${budget.interaction.p95Ms.toFixed(2)}  worst ${budget.interaction.worstMs.toFixed(2)}  n=${budget.interaction.count}`,
    `particles ${budget.resources.particleCount}  backing ${budget.resources.backingStorePx}px  ttfr ${budget.resources.timeToFirstRenderMs.toFixed(1)}ms`,
  ];
  for (const check of budget.checks) {
    rows.push(
      `${check.pass ? 'PASS' : 'FAIL'}  ${check.id}: ${check.standard} — ${check.measured}`,
    );
  }
  return rows.join('\n');
}

function failedChecks(budget: BudgetReport): string {
  return budget.checks
    .filter((check) => !check.pass)
    .map((check) => `${check.id}: ${check.standard} — measured ${check.measured}`)
    .join('\n');
}

test.describe('Invariant 4.1 — reference load', () => {
  test('capped 12-segment reference load holds the locked rate', async ({ page }, testInfo) => {
    await open(page);
    const result = await run(page, { segments: 12, frames: 600, timeoutSeconds: 40 });
    const budget = await report(page, result);
    await attach(testInfo, 'capped-12.txt', result, budget);

    expect(result.meta.lanes, 'twelve segments cap to eight lanes plus one aggregate').toBe(9);
    expect(budget.hardFail, failedChecks(budget)).toBe(false);
    // Angel's ruling, 2026-09-01: gate on the hard-fail set plus no dropped-frame cluster,
    // the rule the three sibling tests already use. The pacing line stays REPORTED (see
    // failedChecks) but is advisory here: the headless rasterizer stamps some frames at a
    // half-tick (25.x ms) with no input at all, and 25.0 is exactly the classification
    // line, so a literal assert failed on a 0.4% overshoot that means nothing. A real
    // stutter is two bad frames in a row, and that still fails the build.
    expect(
      longestOverBudgetRun(result.render.frameIntervalsMs, budget.lockedIntervalMs * 1.5),
      'no dropped-frame cluster',
    ).toBeLessThanOrEqual(1);
  });

  test('uncapped 12-lane load holds the locked rate', async ({ page }, testInfo) => {
    await open(page);
    const result = await run(page, {
      segments: 12,
      uncapped: true,
      frames: 600,
      timeoutSeconds: 40,
    });
    const budget = await report(page, result);
    await attach(testInfo, 'uncapped-12.txt', result, budget);

    expect(result.meta.lanes, 'uncapped means one lane per segment').toBe(12);
    expect(budget.hardFail, failedChecks(budget)).toBe(false);
    // Same ruling as the capped test above: cluster rule, pacing advisory.
    expect(
      longestOverBudgetRun(result.render.frameIntervalsMs, budget.lockedIntervalMs * 1.5),
      'no dropped-frame cluster',
    ).toBeLessThanOrEqual(1);
  });
});

test.describe('Invariant 4.1 — the rate never floats', () => {
  test('every presented rate is 60 or 30 on an integer stride', async ({ page }) => {
    await open(page);
    const result = await run(page, { segments: 12, frames: 400, timeoutSeconds: 30 });
    for (const hz of result.render.observedLockedRates) {
      expect([60, 30]).toContain(hz);
    }
    expect(Number.isInteger(result.render.stride)).toBe(true);
    expect(result.render.effectiveHz).toBeCloseTo(
      result.render.displayHz / result.render.stride,
      6,
    );
    expect(result.render.effectiveHz).toBeGreaterThanOrEqual(29.99);
  });

  test('pinned to the 30fps floor, the rate is still locked', async ({ page }) => {
    await open(page);
    const result = await run(page, {
      segments: 12,
      frames: 300,
      timeoutSeconds: 30,
      pinQualityRank: 1,
    });
    expect(result.render.lockedHz).toBe(30);
    expect(result.meta.qualityLevel).toBe('full-30');
    const budget = await report(page, result);
    expect(budget.hardFail, failedChecks(budget)).toBe(false);
  });
});

test.describe('Invariant 4.1 — interaction responsiveness', () => {
  test('hover feedback is under 100ms at the 30fps floor', async ({ page }, testInfo) => {
    await open(page);
    await page.evaluate(() =>
      globalThis.__streamlinePerf.mount({ segments: 12, pinQualityRank: 1 }),
    );
    // Past the warm-up window first, so the frames measured alongside the input are
    // steady-state frames and the render side of this test is not vacuous.
    await page.waitForTimeout(2_000);

    // Real, trusted input across the whole canvas: rivers, constrictions, the trunk, the
    // gap, and the lake. Latency is recorded inside the event dispatch by the harness.
    for (let i = 0; i < 40; i += 1) {
      await page.mouse.move(120 + i * 30, 300 + (i % 7) * 40);
    }
    await page.waitForTimeout(2_000);

    const measured = await page.evaluate(() => {
      const harness = globalThis.__streamlinePerf as unknown as {
        current: { result: () => HarnessResult } | null;
      };
      return harness.current === null ? null : harness.current.result();
    });
    expect(measured).not.toBeNull();
    const result = measured as HarnessResult;
    const budget = await report(page, result);
    await attach(testInfo, 'interaction-at-30.txt', result, budget);

    expect(result.interaction.latenciesMs.length).toBeGreaterThan(10);
    expect(result.interaction.gatedOnFrame, 'feedback must not wait for a frame').toBe(false);
    expect(budget.interaction.p95Ms).toBeLessThan(100);
    expect(budget.interaction.worstMs).toBeLessThan(100);
    // And the render side must be a real sample, not one frame that happened to be fine.
    expect(budget.pacing.count).toBeGreaterThan(60);
    expect(budget.hardFail, failedChecks(budget)).toBe(false);

    // KNOWN AND GATED, not ignored. A burst of synthetic pointer events dispatched over
    // CDP at machine speed — faster than a hand can move — costs at most ONE isolated
    // dropped display tick. Invariant 4.1 calls a *cluster* a hard fail and an isolated
    // over-budget frame a standard miss, and this is the line between them, asserted so
    // that a second consecutive slip fails the build. It is reported in Forge's verdict.
    expect(
      longestOverBudgetRun(result.render.frameIntervalsMs, budget.lockedIntervalMs * 1.5),
      'input must never cost two consecutive frames',
    ).toBeLessThanOrEqual(1);
  });
});

test.describe('Invariant 4.2 — reduced motion', () => {
  test('renders once, completely, and does not start a loop', async ({ page }) => {
    await open(page);
    const result = await run(page, {
      segments: 12,
      reducedMotion: true,
      frames: 1,
      timeoutSeconds: 4,
    });
    expect(result.meta.reducedMotion).toBe(true);
    expect(result.resources.timeToFirstRenderMs).toBeGreaterThan(0);
    // No presented frames: the clock never started. The picture is complete regardless.
    expect(result.render.frameIntervalsMs.length).toBe(0);
    expect(result.resources.particleCount).toBeGreaterThan(0);
  });
});

test.describe('No memory growth over an idle session', () => {
  test('heap does not trend upward while idling', async ({ page }, testInfo) => {
    // Defaults to 60s so CI stays usable. The Invariant standard is ten minutes:
    //   PERF_SOAK_SECONDS=600 npx playwright test -c src/viz/render/perf/playwright.config.ts
    const seconds = Number(process.env.PERF_SOAK_SECONDS ?? 60);
    test.setTimeout(seconds * 1000 + 60_000);
    await open(page);
    const result = await run(page, {
      segments: 12,
      frames: Math.ceil(seconds * 60),
      timeoutSeconds: seconds + 10,
      heapSampleMs: 1000,
    });
    const budget = await report(page, result);
    await attach(testInfo, `soak-${seconds}s.txt`, result, budget);

    const heap = budget.checks.find((check) => check.id === 'heap-stable');
    expect(heap?.pass, `${heap?.measured ?? 'no heap check'}`).toBe(true);
  });
});

test.describe('Regression gate', () => {
  test('does not regress against the recorded baseline', async ({ page }, testInfo) => {
    await open(page);
    // Mounted rather than one-shot, so the run carries real pointer input and the
    // baseline records an interaction figure instead of a vacuous zero.
    await page.evaluate(() => globalThis.__streamlinePerf.mount({ segments: 12 }));
    // Warm-up first, THEN the input burst, so the burst lands inside the measured window.
    // Driving input during warm-up would let the excluded frames swallow exactly the
    // hitch this gate exists to catch.
    await page.waitForTimeout(1_500);
    // The burst is dispatched INSIDE the page, one pointer move per animation frame, the
    // way a real cursor arrives. Angel's ruling, 2026-09-01, after a first-hand A/B on an
    // idle machine: the same 30 moves delivered through the test driver (page.mouse.move,
    // one CDP round trip each) cost exactly one dropped frame (33.3ms) and reported ~32ms
    // of "latency" every run, while in-page delivery measured the app's real hover
    // response at 0.1-0.2ms with no dropped frame. The driver's queue is not the app's
    // cost, and this gate exists to measure the app. The hover test at the 30fps floor
    // still drives real trusted input through the driver, so the not-frame-gated
    // property stays proven on the real path.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const container = globalThis.__streamlinePerf.current?.container;
          if (!container) {
            resolve();
            return;
          }
          const at = (x: number, y: number): PointerEventInit => ({
            bubbles: true,
            clientX: x,
            clientY: y,
            pointerType: 'mouse',
          });
          container.dispatchEvent(new PointerEvent('pointerenter', at(140, 260)));
          let i = 0;
          const step = (): void => {
            container.dispatchEvent(
              new PointerEvent('pointermove', at(140 + i * 40, 260 + (i % 5) * 60)),
            );
            i += 1;
            if (i < 30) requestAnimationFrame(step);
            else resolve();
          };
          requestAnimationFrame(step);
        }),
    );
    await page.waitForTimeout(8_000);
    const measured = await page.evaluate(() => {
      const bridge = globalThis.__streamlinePerf as unknown as {
        current: { result: () => HarnessResult } | null;
      };
      return bridge.current === null ? null : bridge.current.result();
    });
    expect(measured).not.toBeNull();
    const result = measured as HarnessResult;
    const budget = await report(page, result);
    await attach(testInfo, 'regression.txt', result, budget);

    if (process.env.PERF_WRITE_BASELINE !== undefined) {
      const baseline: RegressionBaseline = {
        recorded: new Date().toISOString(),
        machine: result.meta.userAgent,
        lockedHz: result.render.lockedHz,
        p95Ms: budget.pacing.p95Ms,
        p99Ms: budget.pacing.p99Ms,
        worstMs: budget.pacing.worstMs,
        interactionP95Ms: budget.interaction.p95Ms,
        particleCount: budget.resources.particleCount,
      };
      writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
      test.info().annotations.push({ type: 'baseline', description: 'rewritten' });
      return;
    }

    expect(
      existsSync(BASELINE_PATH),
      'No baseline recorded. Run once with PERF_WRITE_BASELINE=1 on the reference machine.',
    ).toBe(true);
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as RegressionBaseline;
    // Compared in the test process, not in the page: `budget.ts` is pure and has no DOM
    // dependency, so both sides run the identical comparison code.
    const regression = checkRegression(budget, baseline);
    expect(
      longestOverBudgetRun(result.render.frameIntervalsMs, budget.lockedIntervalMs * 1.5),
      'input must never cost two consecutive frames',
    ).toBeLessThanOrEqual(1);

    const failures = regression.details
      .filter((check) => !check.pass)
      .map((check) => `${check.id}: ${check.standard} — measured ${check.measured}`)
      .join('\n');
    expect(regression.regressed, failures).toBe(false);
  });
});
