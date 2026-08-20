// Focused sweep of extreme aspect ratios: how close does k*w get to the 0.85 cap?
import { SEGMENTS, MAX_GROSS } from './src/data.js'
import { buildLayout } from './src/engine/geometry.js'
import { buildFlowTables } from './src/engine/flow.js'

const H = 0.035, SIGMA = 0.022, PINCH_DEPTH = 0.28
const ss = (x) => { const t = Math.min(Math.max(x, 0), 1); return t*t*t*(t*(t*6-15)+10) }

function probe(w, h) {
  const world = buildLayout(w, h, SEGMENTS)
  const S = Math.min(Math.max(Math.min(w, h) * 0.075, 28), 64) / MAX_GROSS
  let worst = { ratio: 0 }
  for (const river of world.rivers) {
    buildFlowTables(river, S)
    const gross = river.segment.grossRevenue
    const M = river.spline.M
    for (let j = 0; j < M; j++) {
      const t = j / (M - 1)
      let frac = 1, pinch = 1
      for (const b of river.bottlenecks) {
        frac -= (b.cost.amount / gross) * ss((t - (b.t - H)) / (2 * H))
        pinch *= 1 - PINCH_DEPTH * (b.cost.amount / b.flowBefore) * Math.exp(-(((t - b.t)/SIGMA) ** 2))
      }
      const wRaw = S * gross * frac * pinch
      const k = river.spline.curvature[j]
      const ratio = k > 1e-6 ? (k * wRaw) / 0.85 : 0
      if (ratio > worst.ratio) worst = { ratio, seg: river.segment.name, t: +t.toFixed(3), R: +(1/k).toFixed(1), wRaw: +wRaw.toFixed(2) }
    }
  }
  return worst
}

let best = { ratio: 0 }
for (let h = 120; h <= 700; h += 10) {
  for (let w = 600; w <= 8000; w += 50) {
    const r = probe(w, h)
    if (r.ratio > best.ratio) best = { w, h, ...r }
  }
}
console.log('extreme-aspect max k*w/0.85 =', best.ratio.toFixed(4), JSON.stringify(best))

// Also tall-narrow
let best2 = { ratio: 0 }
for (let w = 120; w <= 700; w += 10) {
  for (let h = 600; h <= 8000; h += 50) {
    const r = probe(w, h)
    if (r.ratio > best2.ratio) best2 = { w, h, ...r }
  }
}
console.log('tall-narrow max k*w/0.85 =', best2.ratio.toFixed(4), JSON.stringify(best2))
