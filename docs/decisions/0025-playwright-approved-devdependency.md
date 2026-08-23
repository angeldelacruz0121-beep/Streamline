# 0025 — Playwright approved as devDependency for the perf harness

Date:        2026-08-21
Status:      accepted
Decided by:  Angel

Context:     The performance harness needs to measure real frame times during rendering — not
             synthetic timings from a test mock. jsdom (the default test DOM implementation)
             cannot produce trustworthy frame times because it does not invoke the browser's
             rendering pipeline; it simulates the DOM in-process.

             Performance Engineer proposed Playwright (@playwright/test 1.62.1 with Chromium) to
             drive real browser rendering and capture actual frame-time measurements. This is a
             new devDependency and requires a decision gate.

Options:     1. Use jsdom + synthetic timing (faster test setup, less hardware, but unreliable
                frame data).
             2. Use Playwright with real browser rendering (@playwright/test 1.62.1 + Chromium,
                real frame times, slower harness, clear hardware dependency).

Decision:    Option 2. Playwright @playwright/test 1.62.1 + Chromium backend is approved as a
             devDependency. The perf harness measures real frame times from a real rendering
             pipeline, not synthetic numbers.

Consequence: package.json carries @playwright/test as a devDependency. Tests run on Chromium
             (CI runner must have a browser available). The perf gate is p99 17.40ms, measured
             by Performance Engineer's harness. This locks in Chromium as the canonical render
             target for performance — any future performance work compares against this target.