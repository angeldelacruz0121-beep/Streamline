// Where does the clamp start binding, and is that stretch even on-screen?
import { SEGMENTS, MAX_GROSS } from './src/data.js'
import { buildLayout } from './src/engine/geometry.js'
import { buildFlowTables } from './src/engine/flow.js'

const H = 0.035, SIGMA = 0.022, PINCH_DEPTH = 0.28
const ss = (x) => { const t = Math.min(Math.max(x, 0), 1); return t*t*t*(t*(t*6-15)+10) }

function scan(w, h) {
  const world = buildLayout(w, h, SEGMENTS)
  const S = Math.min(Math.max(Math.min(w, h) * 0.075, 28), 64) / MAX_GROSS
  const hits = []
  let worst = 0
  for (const river of world.rivers) {
    buildFlowTables(river, S)
    const gross = river.segment.grossRevenue
    const sp = river.spline
    for (let j = 0; j < sp.M; j++) {
      const t = j / (sp.M - 1)
      let frac = 1, pinch = 1
      for (const b of river.bottlenecks) {
        frac -= (b.cost.amount / gross) * ss((t - (b.t - H)) / (2 * H))
        pinch *= 1 - PINCH_DEPTH * (b.cost.amount / b.flowBefore) * Math.exp(-(((t - b.t)/SIGMA) ** 2))
      }
      const wRaw = S * gross * frac * pinch
      const k = sp.curvature[j]
      const ratio = k > 1e-6 ? (k * wRaw) / 0.85 : 0
      if (ratio > worst) worst = ratio
      if (ratio >= 1) {
        const x = sp.xs[j], y = sp.ys[j]
        const onscreen = x >= 0 && x <= w && y >= 0 && y <= h
        hits.push({ seg: river.segment.name, t: +t.toFixed(3), onscreen, x: +x.toFixed(0), y: +y.toFixed(0), R: +(1/k).toFixed(1), wRaw: +wRaw.toFixed(1), clamped: +(0.85/k).toFixed(2) })
      }
    }
  }
  return { worst, hits }
}

for (const w of [800, 1280, 1700, 1920, 2560, 3840]) {
  let firstBind = null
  for (let h = 700; h >= 60; h -= 5) {
    const r = scan(w, h)
    if (r.hits.length) { firstBind = { h, ...r }; break }
  }
  if (!firstBind) {
    // report how close it got at the shortest height tested
    const r = scan(w, 60)
    console.log(`w=${w}: never binds down to h=60 (worst ratio at h=60 = ${r.worst.toFixed(3)})`)
  } else {
    const on = firstBind.hits.filter((x) => x.onscreen).length
    console.log(`w=${w}: first binds at h=${firstBind.h}  samples=${firstBind.hits.length} onscreen=${on}  e.g. ${JSON.stringify(firstBind.hits[0])}`)
  }
}

// Detailed look at one binding case
const d = scan(1700, 120)
console.log('\n1700x120 -> binding samples:', d.hits.length, 'onscreen:', d.hits.filter(x=>x.onscreen).length)
console.log(JSON.stringify(d.hits.slice(0, 6), null, 1))
