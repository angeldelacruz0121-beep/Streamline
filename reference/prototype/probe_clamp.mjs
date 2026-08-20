// Empirical probe: does the offset-curve clamp in flow.js ever bind?
import { SEGMENTS, MAX_GROSS } from './src/data.js'
import { buildLayout } from './src/engine/geometry.js'
import { buildFlowTables } from './src/engine/flow.js'

const H = 0.035
const SIGMA = 0.022
const PINCH_DEPTH = 0.28
const W_FLOOR = 2
function ss(x) {
  const t = Math.min(Math.max(x, 0), 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

// Recompute the pre-clamp w so we can measure the margin k*w vs 0.85.
function probe(w, h) {
  const world = buildLayout(w, h, SEGMENTS)
  const S = Math.min(Math.max(Math.min(w, h) * 0.075, 28), 64) / MAX_GROSS
  let worst = { ratio: 0 }
  for (const river of world.rivers) {
    buildFlowTables(river, S)
    const seg = river.segment
    const gross = seg.grossRevenue
    const costs = river.bottlenecks
    const M = river.spline.M
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
      const wRaw = S * gross * frac * pinch
      const k = river.spline.curvature[j]
      const ratio = k > 1e-6 ? (k * wRaw) / 0.85 : 0 // >= 1 means the clamp binds
      if (ratio > worst.ratio) {
        worst = {
          ratio,
          seg: seg.name,
          t: +t.toFixed(3),
          k: k.toExponential(3),
          radius: (1 / k).toFixed(1),
          wRaw: wRaw.toFixed(2),
          cap: (0.85 / k).toFixed(1),
        }
      }
    }
  }
  return worst
}

const viewports = [
  [320, 480], [375, 667], [414, 896], [768, 1024], [1024, 640],
  [1280, 800], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160],
  [1920, 400], [400, 1920], [600, 300], [300, 300], [5000, 300], [300, 5000],
]
let globalWorst = { ratio: 0 }
for (const [w, h] of viewports) {
  const r = probe(w, h)
  console.log(`${String(w).padStart(5)}x${String(h).padEnd(5)} worst k*w/0.85 = ${r.ratio.toExponential(3)}  ${r.seg} t=${r.t} R=${r.radius}px wRaw=${r.wRaw} cap=${r.cap}`)
  if (r.ratio > globalWorst.ratio) globalWorst = { ...r, w, h }
}
console.log('\nGLOBAL WORST:', JSON.stringify(globalWorst, null, 2))
console.log('clamp binds anywhere?', globalWorst.ratio >= 1)

// Sweep a fine grid of viewport sizes for the true maximum.
let gw = 0, gwAt = null
for (let w = 280; w <= 3840; w += 40) {
  for (let h = 280; h <= 2160; h += 80) {
    const r = probe(w, h)
    if (r.ratio > gw) { gw = r.ratio; gwAt = { w, h, ...r } }
  }
}
console.log('\nFINE SWEEP max ratio:', gw.toExponential(4), JSON.stringify(gwAt))
