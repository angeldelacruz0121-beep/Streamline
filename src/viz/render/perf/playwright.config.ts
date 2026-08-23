/**
 * Playwright config for the performance harness. Scoped to this directory so it cannot
 * collide with anything Keel owns at the repo root, and matched on `*.spec.ts` so Vitest —
 * which includes only `*.test.ts` — never tries to run it.
 *
 * MEASUREMENT HONESTY NOTE. Headless Chromium composites Canvas 2D through SwiftShader,
 * a software rasteriser, rather than through a GPU. That makes every number this harness
 * produces CONSERVATIVE relative to a real 2020 MacBook Air with Intel Iris Plus
 * graphics: the reference machine has hardware acceleration this rig does not. A build
 * that passes here has headroom on the reference machine. It does not work the other way,
 * and the headed run below is the check for anyone who wants the real figure.
 *
 *   npx playwright test -c src/viz/render/perf/playwright.config.ts --headed
 *
 * Background throttling is disabled so the rate lock is measured, not the browser's
 * occlusion policy, and precise memory info is enabled so the heap soak has real numbers
 * rather than the 100KB-bucketed default.
 */
import { defineConfig } from '@playwright/test';

const PORT = 5199;

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  // Performance measurement cannot share a CPU with a second worker and stay meaningful.
  workers: 1,
  fullyParallel: false,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  timeout: 180_000,
  reporter: process.env.CI !== undefined ? [['github'], ['list']] : [['list']],
  use: {
    // Deliberately NOT `devices['Desktop Chrome']`: that descriptor overrides the user
    // agent with a Windows string, and a perf report that misnames the machine it ran on
    // is worse than no report.
    browserName: 'chromium',
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    launchOptions: {
      args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--enable-precise-memory-info',
      ],
    },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    // `localhost`, not `127.0.0.1`: Vite 8 binds the dev server to ::1 by default and the
    // IPv4 literal never connects.
    url: `http://localhost:${PORT}/src/viz/render/perf/fixture.html`,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
});
