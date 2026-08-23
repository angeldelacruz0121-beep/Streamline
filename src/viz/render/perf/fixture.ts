/**
 * The page the Playwright harness drives.
 *
 * It exposes the harness on `window` and does nothing else. Deliberately not a React
 * mount: the measurement must be of the renderer, not of a framework's event delegation
 * or its scheduler. The application component is covered separately by
 * `canvas.test.tsx`.
 */
import { evaluate, formatReport, type BudgetReport } from './budget';
import { PerfHarness, runHarness, type HarnessOptions, type HarnessResult } from './harness';

export interface PerfBridge {
  runHarness: (options?: HarnessOptions) => Promise<HarnessResult>;
  evaluate: (result: HarnessResult) => BudgetReport;
  formatReport: (report: BudgetReport) => string;
  mount: (options?: HarnessOptions) => PerfHarness;
  current: PerfHarness | null;
}

const bridge: PerfBridge = {
  runHarness,
  evaluate: (result) => evaluate(result.render, result.interaction, result.resources),
  formatReport,
  mount: (options = {}) => {
    bridge.current?.dispose();
    const harness = new PerfHarness(document.body, options);
    harness.start();
    bridge.current = harness;
    return harness;
  },
  current: null,
};

(globalThis as unknown as { __streamlinePerf: PerfBridge }).__streamlinePerf = bridge;
document.body.dataset.perfReady = 'true';
