// Flow tables: w(t) = wSteady(t) · pinch(t), and speedMul(t) = 1/pinch.
//
// wSteady is how much water is still in the channel — linear in flow, one
// global scale S so widths are comparable BETWEEN rivers. pinch is the physical
// throat at each cost point: narrower than the water it sheds, then recovering.
// Speed rises only through the throat (mass continuity), never permanently —
// that is why it is 1/pinch, not 1/w.
//
// Everything bakes into Float32Array[M] lookup tables; the per-particle cost is
// two table reads and a lerp.

import { SPLINE_SAMPLES } from './spline.js'

const H = 0.035 // half-span of the width step at a bottleneck
const SIGMA = 0.022 // throat width
const PINCH_DEPTH = 0.28
const W_FLOOR = 2 // rendered half-width floor, px — geometry floored, data not

// smootherstep (C² — smoothstep's curvature jump shows as a crease on the edge)
function ss(x) {
  const t = Math.min(Math.max(x, 0), 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function buildFlowTables(river, S) {
  const M = SPLINE_SAMPLES
  const seg = river.segment
  const gross = seg.grossRevenue
  const costs = river.bottlenecks

  const flowFrac = new Float32Array(M)
  const wTable = new Float32Array(M) // effective half-width, floored
  const speedMul = new Float32Array(M)
  const alphaComp = new Float32Array(M) // compensates the floor so light ∝ flow

  // Survival probability and flow before each bottleneck (for the cull rolls).
  let before = gross
  for (const b of costs) {
    b.flowBefore = before
    b.survival = (before - b.cost.amount) / before
    before -= b.cost.amount
  }

  for (let j = 0; j < M; j++) {
    const t = j / (M - 1)

    let frac = 1
    let pinch = 1
    for (const b of costs) {
      const cf = b.cost.amount / gross
      frac -= cf * ss((t - (b.t - H)) / (2 * H))
      const g = Math.exp(-(((t - b.t) / SIGMA) ** 2))
      pinch *= 1 - PINCH_DEPTH * (b.cost.amount / b.flowBefore) * g
    }
    flowFrac[j] = frac

    const wSteady = S * gross * frac
    let w = wSteady * pinch
    // Offset-curve guard: displacing by w along the normal self-intersects on
    // the inner side of a curve when w > 1/κ.
    const k = river.spline.curvature[j]
    if (k > 1e-6) w = Math.min(w, 0.85 / k)

    const floored = Math.max(w, W_FLOOR)
    wTable[j] = floored
    // ≤ 1 exactly when the floor kicked in — but floored at 0.45: exact
    // compensation drives a dying river below perception, and invisible is
    // ambiguous with a bug. The channel still reads as clearly the weakest.
    alphaComp[j] = Math.max(w / floored, 0.45)
    speedMul[j] = Math.min(Math.max(1 / pinch, 1), 1.45)
  }

  river.flowFrac = flowFrac
  river.wTable = wTable
  river.speedMul = speedMul
  river.alphaComp = alphaComp

  // Side-channel half-width: starts at the width of the flow it carries,
  // tapers to nothing so the water dissipates rather than stopping.
  for (const b of costs) {
    b.sideW0 = Math.max(S * b.cost.amount, W_FLOOR)
  }
}

export function lerpTable(tab, t) {
  const f = Math.min(Math.max(t, 0), 1) * (tab.length - 1)
  const i = Math.min(tab.length - 2, Math.floor(f))
  const r = f - i
  return tab[i] + r * (tab[i + 1] - tab[i])
}
