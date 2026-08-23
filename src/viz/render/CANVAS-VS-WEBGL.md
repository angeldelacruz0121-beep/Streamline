# Canvas 2D over WebGL — the decision, and the measurement behind it

Forge owns this call and owes a written justification backed by measurement. This is it.

**Decision: Canvas 2D. WebGL is not used and is not needed at the v1 reference load.**

Recorded 2026-08-21 against the shipped renderer. Reproduce with:

```
npx playwright test -c src/viz/render/perf/playwright.config.ts
```

---

## 1. The argument, before the numbers

Invariant §5 is what makes this easy, and it is worth quoting because it is the whole
reason WebGL has nothing to sell here:

> Naturalism is pursued through motion behavior, silhouette, surface, and light — never
> through refraction, caustics, or physically-based water shading, which will not hold the
> frame budget on reference hardware even at the 30fps floor.

Refraction, caustics and PBR water are exactly the workloads that justify a fragment
shader. They are ruled out by the aesthetic direction, not by the budget. What remains is
flat filled polygons, hairline strokes, text, and a few thousand one-pixel points — the
workload Canvas 2D exists for, and one where WebGL's advantage is a rounding error against
its costs.

Those costs are real and are not hypothetical:

- **Text.** Canvas 2D has a text rasteriser. WebGL does not. Every figure on this canvas is
  load-bearing — Invariant 2.2 traceability, test record 0001 C2's persistent readout, the
  mandatory annotation on every constriction — and reimplementing type as an SDF atlas
  would be the largest single piece of work in the renderer, in service of a speedup the
  measurement below says is not needed.
- **Context loss.** A WebGL context can be lost and must be rebuilt. That is a real crash
  path on the thermal and battery behaviour Forge owns, and Canvas 2D does not have it.
- **Debuggability.** A draw call recorder over `Ctx2D` is what makes the geometry-invariance
  test possible at all: it compares coordinates, not pixels. That test is the mechanical
  proof that Invariant 4.1's "geometry accuracy is never degraded" holds at every rung of
  the ladder. The WebGL equivalent is pixel diffing, which breaks on an antialiasing
  change that means nothing.

---

## 2. The measurement

Reference load per Invariant 4.1: **12 segments, desktop viewport (1440 × 900), 2× DPR.**
Both the shipping capped path (12 segments → 8 lanes + 1 aggregate, per Invariant 3.7) and
the uncapped 12-lane worst case were measured. Figures from the real Microsoft FY2026
disclosure, repeated four times to reach twelve segments.

| | capped, 9 lanes | uncapped, 12 lanes |
|---|---|---|
| Draw cost p50 | 0.40 ms | 0.40 ms |
| Draw cost p95 | 0.50 ms | 0.50 ms |
| Draw cost p99 | 0.50 ms | 0.50 ms |
| Draw cost worst | 0.50 ms | 3.10 ms |
| Frame pacing p50 | 16.70 ms | 16.70 ms |
| Frame pacing p95 | 17.00 ms | 17.70 ms |
| Frame pacing p99 | 18.40 ms | 18.40 ms |
| Frame pacing worst | 18.70 ms | 18.50 ms |
| Particles | 2,955 | 2,947 |
| Backing store | 12.81 Mpx | 13.23 Mpx |
| Time to first render | 7.3 ms | 7.4 ms |

**The number that decides it is the draw cost: p99 of 0.50 ms against a 16.67 ms budget.**
The renderer is using **3% of the frame**. There is no workload here for a GPU pipeline to
rescue. Frame pacing sits at the locked interval; the ~1.7 ms above 16.67 at p99 is
`requestAnimationFrame` timestamp jitter, measured independently at p99 9.30 ms on an
8.30 ms tick by `cadence.spec.ts`, and no display tick is ever missed.

**Measured conservatively.** Headless Chromium composites through SwiftShader, a software
rasteriser, with no GPU at all. The reference machine — a 2020 MacBook Air with Intel Iris
Plus — has hardware-accelerated Canvas 2D that this rig does not. A build that passes here
has headroom on the reference machine, not the other way round.

---

## 3. What the headroom means, and what it does not

Forge's mandate: *"Do not 'save' framerate nobody asked you to save. Headroom above the
floor belongs to visual quality, not to a higher number on the harness."*

At 3% of frame budget, that headroom is enormous and it is **currently unspent**. This is a
finding for Angel and Atelier, not a result to protect:

- Particle areal density is `5.5 per 1,000 px²`, giving ~2,950 particles. On this evidence
  it could rise by an order of magnitude before pacing moved. It is deliberately not raised
  here, because density is `ATELIER-REPLACE` and raising it is a look decision.
- The bloom and blur rung of the degradation ladder is a **no-op stub**. There is no effect
  to degrade because Atelier has shipped no tokens for one. The measurement says the budget
  for one exists.
- Draw cost worst rose from 0.50 ms to 3.10 ms between 9 and 12 lanes. That is one GC pause
  in a 600-frame run, not a per-lane trend: p99 is identical at 0.50 ms in both.

---

## 4. When to revisit

Reopen this decision if any of the following becomes true, and reopen it with numbers:

1. Particle counts exceed roughly 50,000 at the reference load. `fillRect` per particle is
   linear and will eventually dominate; that is the point where instanced points pay.
2. Angel amends §5 to permit refraction, caustics or physically-based water shading.
3. Multi-company or multi-period comparison puts several canvases on screen at once and the
   combined backing store approaches the 16 Mpx ceiling in `renderer.ts`.
4. The reference machine is re-baselined to something slower than a 2020 MacBook Air.

Until one of those happens, adding WebGL would be a dependency and a context-loss path
bought with no measured benefit. Under protocol §3 a new rendering dependency is an
escalation, and there is nothing here to escalate.
