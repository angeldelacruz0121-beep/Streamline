/**
 * A diagnostic, not a gate: what is this machine's raw `requestAnimationFrame` cadence?
 *
 * It exists because a pacing failure has two possible authors — the renderer, or the
 * presentation cadence underneath it — and a harness that cannot tell them apart will
 * send someone optimising a draw call that was never the problem. The rate lock presents
 * on every Nth tick, so any jitter in the underlying tick is multiplied by the stride;
 * this measures the tick directly, with no renderer in the page at all.
 */
import { expect, test } from '@playwright/test';
import { summarise } from './budget';

test('raw requestAnimationFrame cadence of the measurement rig', async ({ page }) => {
  await page.goto('/src/viz/render/perf/fixture.html');
  await page.waitForFunction(() => document.body.dataset.perfReady === 'true');
  await page.waitForTimeout(250);
  const deltas = await page.evaluate(
    async () =>
      new Promise<number[]>((resolve) => {
        const samples: number[] = [];
        let previous: number | null = null;
        const tick = (t: number): void => {
          if (previous !== null) samples.push(t - previous);
          previous = t;
          if (samples.length < 600) requestAnimationFrame(tick);
          else resolve(samples);
        };
        requestAnimationFrame(tick);
      }),
  );
  const distribution = summarise(deltas);
  process.stdout.write(
    `\n--- raw rAF cadence ---\n` +
      `p50 ${distribution.p50Ms.toFixed(2)}  p95 ${distribution.p95Ms.toFixed(2)}  ` +
      `p99 ${distribution.p99Ms.toFixed(2)}  worst ${distribution.worstMs.toFixed(2)}  ` +
      `n=${distribution.count}\n` +
      `implied stride-2 worst ${(distribution.worstMs + distribution.p50Ms).toFixed(2)}ms  ` +
      `stride-4 worst ${(distribution.worstMs + distribution.p50Ms * 3).toFixed(2)}ms\n`,
  );
  expect(distribution.count).toBe(600);
});
