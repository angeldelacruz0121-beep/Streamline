// Particle pool. Fixed size, never destroyed, respawned in place — constant
// frame cost, no allocation, no GC. Each particle belongs permanently to one
// river and cycles: head → (maybe diverted to a spill channel → fade) or
// (→ lake residence → fade) → back to its river's head.
//
// Because the cycle is closed and every stage is sized to its steady-state
// occupancy, flow is conserved by construction — there is no emitter to pulse.
// Per-particle speed jitter destroys phase memory within one transit, which is
// what structurally guarantees no visible loop point.

import { sampleSpline } from './spline.js'
import { lerpTable } from './flow.js'
import { centerWeighted } from './rng.js'

const STAGE_MAIN = 0
const STAGE_SIDE = 1
const STAGE_LAKE = 2

const LAKE_TAU_MIN = 4.5
const LAKE_TAU_MAX = 8.0
const LAKE_TAU_MEAN = (LAKE_TAU_MIN + LAKE_TAU_MAX) / 2
const SIDE_SPEED = 0.9 // entry speed carries over, decaying slightly
const DRIFT_AMP = 0.06

function ss(x) {
  const t = Math.min(Math.max(x, 0), 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

// The particle budget is derived, not fixed: pick a target areal density and
// let the occupancy integrals convert it to a count. Areal brightness is then
// constant across viewports for the same reason it is constant across rivers —
// η ∝ S·v0 cancels the geometry out of ρ = η/(2·S·v0).
export function buildPool(world, arealTarget, rand) {
  const { rivers, v0 } = world

  // Steady-state occupancy integrals, in flow·seconds. The common factor η
  // scales them to the particle budget — no tuning constant anywhere.
  const occ = rivers.map((r) => {
    const M = r.spline.M
    const L = r.spline.length
    let main = 0
    for (let j = 0; j < M; j++) {
      main += (r.segment.grossRevenue * r.flowFrac[j]) / (v0 * r.speedMul[j])
    }
    main *= L / M
    let side = 0
    for (const b of r.bottlenecks) {
      side += (b.cost.amount * b.side.spline.length) / (v0 * SIDE_SPEED)
    }
    const net =
      r.segment.grossRevenue - r.bottlenecks.reduce((s, b) => s + b.cost.amount, 0)
    const lake = net * LAKE_TAU_MEAN
    return { main, side, lake, total: main + side + lake }
  })
  const occSum = occ.reduce((s, o) => s + o.total, 0)
  const etaIdeal = 2 * world.S * v0 * arealTarget
  const total = Math.min(Math.max(Math.round(etaIdeal * occSum), 2000), 9000)
  const eta = total / occSum

  // Per-river, per-stage counts.
  const counts = occ.map((o) => ({
    main: Math.round(o.main * eta),
    side: Math.round(o.side * eta),
    lake: Math.round(o.lake * eta),
  }))
  const n = counts.reduce((s, c) => s + c.main + c.side + c.lake, 0)

  const pool = {
    n,
    recycles: 0, // lifetime counter; the debug overlay differences it per second
    stage: new Uint8Array(n),
    riverIdx: new Uint8Array(n),
    sideIdx: new Uint8Array(n),
    crossedMask: new Uint8Array(n),
    t: new Float32Array(n),
    lat: new Float32Array(n),
    speedJitter: new Float32Array(n),
    size: new Float32Array(n),
    baseAlpha: new Float32Array(n),
    driftPhase: new Float32Array(n),
    driftFreq: new Float32Array(n),
    px: new Float32Array(n), // lake position / velocity
    py: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    age: new Float32Array(n),
    life: new Float32Array(n),
  }

  // ── Warm start ────────────────────────────────────────────────────────────
  // Particles distributed across t by the true steady-state density ∝ flow/v,
  // with upstream-bottleneck bits pre-set (survival is already in the density).
  // Frame 1 shows correct downstream density; nothing "fills up".
  let idx = 0
  rivers.forEach((r, ri) => {
    const M = r.spline.M
    // Inverse CDF of density flowFrac/speedMul.
    const cdf = new Float64Array(M)
    let acc = 0
    for (let j = 0; j < M; j++) {
      acc += r.flowFrac[j] / r.speedMul[j]
      cdf[j] = acc
    }
    for (let j = 0; j < M; j++) cdf[j] /= acc

    for (let k = 0; k < counts[ri].main; k++, idx++) {
      seed(pool, idx, ri, rand)
      pool.stage[idx] = STAGE_MAIN
      const u = rand()
      let j = 0
      while (j < M - 1 && cdf[j] < u) j++
      pool.t[idx] = j / (M - 1)
      let mask = 0
      r.bottlenecks.forEach((b, bi) => {
        if (b.t < pool.t[idx]) mask |= 1 << bi
      })
      pool.crossedMask[idx] = mask
    }

    // Spill channels: constant speed along the channel ⇒ uniform in t,
    // weighted per channel by the cost it carries.
    const costSum = r.bottlenecks.reduce((s, b) => s + b.cost.amount, 0)
    for (let k = 0; k < counts[ri].side; k++, idx++) {
      seed(pool, idx, ri, rand)
      pool.stage[idx] = STAGE_SIDE
      let pick = rand() * costSum
      let bi = 0
      for (; bi < r.bottlenecks.length - 1; bi++) {
        pick -= r.bottlenecks[bi].cost.amount
        if (pick <= 0) break
      }
      pool.sideIdx[idx] = bi
      pool.t[idx] = rand()
    }

    // Lake residents, spread across their residence — the inward relaxation is
    // closed-form, so warm placement is exact rather than stepped. Angle is
    // anchored at this river's mouth and spread by age·ω, matching the TRUE
    // steady state: a uniform-φ warm start looks nice for one residence, then
    // the real mouth-anchored distribution replaces it and the lake "shifts".
    const mouthOut = [0, 0, 0, 0]
    sampleSpline(r.spline, 1, mouthOut)
    const mouthPhi = Math.atan2(
      (mouthOut[1] - world.C[1]) / world.ry,
      (mouthOut[0] - world.C[0]) / world.rx,
    )
    for (let k = 0; k < counts[ri].lake; k++, idx++) {
      seed(pool, idx, ri, rand)
      enterLake(pool, idx, world, r, rand, /*warm*/ true)
      pool.age[idx] = rand() * pool.life[idx]
      const rhoT = pool.vx[idx]
      const rho = rhoT + (0.96 - rhoT) * Math.exp(-pool.age[idx] * 0.55)
      pool.vy[idx] = rho
      const base = ri % 2 === 0 ? 0.2 : -0.2
      const omega = base + (pool.speedJitter[idx] - 1) * 2.6
      const phi = mouthPhi + omega * pool.age[idx]
      pool.px[idx] = world.C[0] + world.rx * rho * Math.cos(phi)
      pool.py[idx] = world.C[1] + world.ry * rho * Math.sin(phi)
    }
  })

  return pool
}

function seed(pool, i, ri, rand) {
  pool.riverIdx[i] = ri
  pool.lat[i] = centerWeighted(rand)
  // Permanent per-particle speed variance — the decoherence guarantee.
  pool.speedJitter[i] = 0.86 + rand() * 0.28
  // size is a MULTIPLIER on the local channel width, not an absolute diameter —
  // a fixed diameter makes narrow channels render as one solid tube and wide
  // ones as sparse scatter, which inverts perceived weight against real width.
  pool.size[i] = 0.72 + rand() * 0.62
  pool.baseAlpha[i] = 0.026 + rand() * 0.024
  pool.driftPhase[i] = rand() * Math.PI * 2
  pool.driftFreq[i] = 0.3 + rand() * 0.6
  pool.crossedMask[i] = 0
  pool.sideIdx[i] = 0
  pool.age[i] = 0
  pool.life[i] = 0
}

function respawn(pool, i, rand) {
  pool.recycles++
  const ri = pool.riverIdx[i]
  // Fresh identity except speedJitter (permanent), inside the off-screen band.
  pool.lat[i] = centerWeighted(rand)
  pool.size[i] = 0.72 + rand() * 0.62
  pool.baseAlpha[i] = 0.026 + rand() * 0.024
  pool.driftPhase[i] = rand() * Math.PI * 2
  pool.driftFreq[i] = 0.3 + rand() * 0.6
  pool.crossedMask[i] = 0
  pool.stage[i] = STAGE_MAIN
  pool.t[i] = rand() * 0.02
  pool.riverIdx[i] = ri
}

// Lake residence: each particle relaxes inward from its arrival point on the
// shore to a personal target radius drawn uniform-in-area, while milling
// tangentially at its own slow rate. No field, no containment fight — density
// stays uniform and nothing can accumulate at the rim, by construction.
function enterLake(pool, i, world, river, rand, warm) {
  const out = [0, 0, 0, 0]
  sampleSpline(river.spline, 1, out)
  const wEnd = river.wTable[river.wTable.length - 1]
  pool.stage[i] = STAGE_LAKE
  pool.px[i] = out[0] + out[2] * pool.lat[i] * wEnd
  pool.py[i] = out[1] + out[3] * pool.lat[i] * wEnd
  // vx = target radius (uniform in area, center-weighted glow)
  // vy = CURRENT base radius — kept as its own state. Deriving it back from
  // the position would bake the breathe oscillation into the state, turning a
  // bounded wobble into a random walk that crashes particles into the center.
  // Initialized from the ACTUAL arrival point: a hardcoded 0.97 makes the
  // first stepLake snap the particle radially — a visible pop at the mouth,
  // exactly where the absorption glow points the eye.
  pool.vx[i] = 0.12 + Math.sqrt(rand()) * 0.72
  const au = (pool.px[i] - world.C[0]) / world.rx
  const av = (pool.py[i] - world.C[1]) / world.ry
  pool.vy[i] = Math.min(Math.hypot(au, av), 0.97)
  pool.age[i] = 0
  pool.life[i] = LAKE_TAU_MIN + rand() * (LAKE_TAU_MAX - LAKE_TAU_MIN)
}

function stepLake(pool, i, world, dt, time) {
  const { C, rx, ry } = world
  const u = (pool.px[i] - C[0]) / rx
  const vN = (pool.py[i] - C[1]) / ry
  let phi = Math.atan2(vN, u)

  // Relax the BASE radius toward the personal target; mill tangentially.
  // ω from the permanent speed jitter, alternating per river so neighbours
  // interleave. Fast enough that arrivals actually spread around the basin
  // within one residence — too slow and the lake is bright only at the mouths.
  const rhoT = pool.vx[i]
  pool.vy[i] = rhoT + (pool.vy[i] - rhoT) * Math.exp(-dt * 0.55)
  const base = pool.riverIdx[i] % 2 === 0 ? 0.2 : -0.2
  phi += (base + (pool.speedJitter[i] - 1) * 2.6) * dt
  const breathe = 0.02 * Math.sin(pool.driftFreq[i] * time * 2 + pool.driftPhase[i])
  const r = Math.min(Math.max(pool.vy[i] + breathe, 0.03), 0.97)

  pool.px[i] = C[0] + rx * r * Math.cos(phi)
  pool.py[i] = C[1] + ry * r * Math.sin(phi)
}

export function updateParticles(world, pool, dt, rand, time) {
  const { rivers, v0 } = world
  const n = pool.n
  for (let i = 0; i < n; i++) {
    const stage = pool.stage[i]
    const river = rivers[pool.riverIdx[i]]

    if (stage === STAGE_MAIN) {
      const t0 = pool.t[i]
      const sm = lerpTable(river.speedMul, t0)
      const latEff = pool.lat[i] // profile uses the base lat; drift is visual only
      const profile = 0.72 + 0.28 * (1 - latEff * latEff)
      const v = v0 * sm * pool.speedJitter[i] * profile
      const t1 = t0 + (v * dt) / river.spline.length

      // Bottleneck crossings this step: independent Bernoulli, rolled once.
      const bs = river.bottlenecks
      let diverted = false
      for (let bi = 0; bi < bs.length; bi++) {
        const b = bs[bi]
        if (t1 >= b.t && (pool.crossedMask[i] & (1 << bi)) === 0) {
          pool.crossedMask[i] |= 1 << bi
          if (rand() > b.survival) {
            // Diverted: switch to the spill channel, C¹ at the split, speed
            // carries over — the particle does not change pace as it leaves.
            pool.stage[i] = STAGE_SIDE
            pool.sideIdx[i] = bi
            pool.t[i] = 0
            diverted = true
            break
          }
        }
      }
      if (diverted) continue

      if (t1 >= 1) {
        enterLake(pool, i, world, river, rand, false)
      } else {
        pool.t[i] = t1
      }
    } else if (stage === STAGE_SIDE) {
      const b = river.bottlenecks[pool.sideIdx[i]]
      const v = v0 * SIDE_SPEED * pool.speedJitter[i]
      const t1 = pool.t[i] + (v * dt) / b.side.spline.length
      if (t1 >= 1) respawn(pool, i, rand)
      else pool.t[i] = t1
    } else {
      stepLake(pool, i, world, dt, time)
      pool.age[i] += dt
      if (pool.age[i] >= pool.life[i]) respawn(pool, i, rand)
    }
  }
}

export { STAGE_MAIN, STAGE_SIDE, STAGE_LAKE, ss }
