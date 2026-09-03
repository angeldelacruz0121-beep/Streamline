# 0039 — The perf gate measures the app, not the test driver

Date:        2026-09-01
Status:      accepted
Decided by:  Angel (two rulings), on evidence gathered by the Performance Engineer

Context:     The 2026-09-01 status report carried two open perf-gate failures it could not
             close "either way" and attributed to machine noise, recommending a clean re-run
             on an idle machine and a fresh baseline. The clean run was made (Spotlight
             finished, load 1.6, no other servers, gate's own fixture server only) and the
             failures REPRODUCED, so they were not noise. A parallel investigation with
             adversarial refutation, then a first-hand A/B on the idle machine, found three
             different things behind three different lines:

             1. The 33.3ms frame in the regression scenario, identical on three days. It is
                the TEST DRIVER's cost, not the app's. The same 30 pointer moves dispatched
                inside the page (one per animation frame, the way a real cursor arrives)
                measured the app's hover response at 0.1-0.2ms with no dropped frame; the
                same moves delivered through Playwright's page.mouse.move (one CDP round trip
                each) produced exactly one dropped frame and ~32ms of queue time reported as
                "latency" on every run. Five runs, split perfectly by transport.
             2. The 25.1ms "pacing" failure in the uncapped test is a boundary reading. On the
                headless rasterizer some frames are stamped at a half-tick (25.x ms) with no
                input at all (the no-input control produced 25.6), and 25.0 is exactly the
                line the gate uses to classify a frame. A 0.4% overshoot once in 602 frames is
                not a stutter; two bad frames in a row is, and that already fails hard.
             3. The heap-growth flags (35-59 KiB/sample) came from short windows where startup
                allocation dominates the fit, which budget.ts itself warns about. The
                authoritative 60-second soak test passed three times in a row on the idle
                machine (-1.9, +2.5, -5.5 KiB/sample against a 24 KiB line). Not a leak.

Rulings:     1. The capped and uncapped reference-load tests gate on the hard-fail set plus
                no dropped-frame cluster, the rule their three sibling tests already used.
                The pacing line stays reported, advisory. Reversible: yes.
             2. The regression scenario dispatches its input burst in-page. The hover test at
                the 30fps floor still drives real input through the driver, so the
                not-frame-gated property stays proven on the real path. Reversible: yes.
             Applied by the Performance Engineer under ruling 1, flagged for veto: the
             regression comparator's p99 check is floored at the invariant's own on-time line
             (locked interval + half a display tick), the same way its interaction check was
             already floored at 4ms. A baseline recorded at p99 17.2 followed by a run at
             p99 25.0 is the same machine on the same code, not a slower app.

Baseline:    perf/baseline.json re-recorded 2026-09-01 from a clean idle run (worst 25.1,
             p99 17.2, hover p95 0.10ms) and verified by a second consecutive clean run. The
             rule going forward: record only from an idle run with no other servers, gate's
             fixture server only, hardFail false, and confirm with a second clean run before
             the file is kept.

Files:       src/viz/render/perf/perf.spec.ts (rulings 1 and 2), src/viz/render/perf/budget.ts
             and budget.test.ts (p99 floor + two tests), src/viz/render/perf/baseline.json.

Lesson:      "Machine noise" is a claim that needs an idle-machine reproduction and an A/B
             that changes one thing. A failure that reproduces identically is a measuring
             instrument telling the truth about something; the job is to find out what.
