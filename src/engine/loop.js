// Engine orchestration. Single requestAnimationFrame loop, delta-time based,
// dt clamped so a tab-switch stall cannot teleport the field. React never
// touches particle state — the engine is plain JS and owns the canvas.

import { SEGMENTS, MAX_GROSS, netOf } from '../data.js'
import { mulberry32 } from './rng.js'
import { buildLayout, labelAnchor, attachMouths } from './geometry.js'
import { buildFlowTables } from './flow.js'
import { buildPool, updateParticles } from './particles.js'
import { makeAtlas, renderFrame, renderStill, createLayers } from './render.js'

const AREAL_TARGET = 0.05 // particles per px² of stream, the exposure constant
const DT_CLAMP = 1 / 20
const SPRING_K = 90 // critically damped: c = 2√k

export function createEngine(canvas, callbacks = {}) {
  const ctx = canvas.getContext('2d', { alpha: false })
  const atlas = makeAtlas()
  const rand = mulberry32(0xc0ffee)

  const state = {
    world: null,
    pool: null,
    layers: null,
    debug: false,
    recyclePrev: 0,
    recycleAt: 0,
    recyclePerSec: 0,
    fps: 0,
    rafId: 0,
    lastTs: 0,
    time: 0,
    sizeScale: 1,
    alphaScale: 1,
    dprCap: 2,
    arealTarget: AREAL_TARGET,
    degradeLevel: 0,
    degradeDeadline: 0,
    frameTimes: [],
    allFrameTimes: [], // dev histogram ring
    hover: -1,
    emphasis: new Float32Array(SEGMENTS.length).fill(1),
    emphasisVel: new Float32Array(SEGMENTS.length),
    reduced: false,
    destroyed: false,
  }

  const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  function build(preserveTrails = false) {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, state.dprCap)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // preserveTrails only on the degrade path — resize moves the rivers, and
    // stale trails over new geometry would be worse than a cold start.
    state.layers = createLayers(w, h, dpr, preserveTrails ? state.layers : null)
    const world = buildLayout(w, h, SEGMENTS)
    world.v0 = Math.min(Math.max(Math.min(w, h) * 0.085, 40), 100)
    // One global scale: widths comparable BETWEEN rivers, not just within one.
    world.S = Math.min(Math.max(Math.min(w, h) * 0.075, 28), 64) / MAX_GROSS

    for (const river of world.rivers) buildFlowTables(river, world.S)
    attachMouths(world)
    world.lakeParticleW = Math.max(world.rx * 0.022, 3)
    state.world = world
    state.pool = buildPool(world, state.arealTarget, rand)

    callbacks.onLabels?.(
      world.rivers.map((r, i) => {
        const a = labelAnchor(r, world, r.wTable, i)
        return {
          idx: i,
          name: r.segment.name,
          x: a.x,
          y: a.y,
          gross: r.segment.grossRevenue,
          costs: r.segment.costs,
          net: netOf(r.segment),
        }
      }),
    )
  }

  // Toggleable evaluation readout (press d). Recycles/sec is the number that
  // matters: a spiky rate means the recycler is pulsing, which is what a
  // visible seam would look like in the data.
  function drawDebug(ts, rawDt) {
    state.fps += (1000 / Math.max(rawDt * 1000, 0.001) - state.fps) * 0.08
    if (ts - state.recycleAt >= 1000) {
      const span = (ts - state.recycleAt) / 1000
      state.recyclePerSec = Math.round((state.pool.recycles - state.recyclePrev) / span)
      state.recyclePrev = state.pool.recycles
      state.recycleAt = ts
    }
    const lines = [
      `fps          ${state.fps.toFixed(1)}`,
      `frame        ${(rawDt * 1000).toFixed(2)} ms`,
      `particles    ${state.pool.n}`,
      `recycles/s   ${state.recyclePerSec}`,
      `degrade      ${state.degradeLevel}`,
    ]
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(8,10,13,0.82)'
    ctx.fillRect(16, 16, 172, 18 + lines.length * 16)
    ctx.strokeStyle = 'rgba(150,180,205,0.18)'
    ctx.lineWidth = 1
    ctx.strokeRect(16.5, 16.5, 171, 17 + lines.length * 16)
    ctx.font = '11px Menlo, Monaco, monospace'
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(210,224,234,0.86)'
    lines.forEach((l, i) => ctx.fillText(l, 28, 25 + i * 16))
    ctx.restore()
  }

  function stepSprings(dt) {
    for (let i = 0; i < SEGMENTS.length; i++) {
      const target = state.hover === -1 ? 1 : state.hover === i ? 1.25 : 0.45
      const x = state.emphasis[i]
      const v = state.emphasisVel[i]
      const a = -SPRING_K * (x - target) - 2 * Math.sqrt(SPRING_K) * v
      state.emphasisVel[i] = v + a * dt
      state.emphasis[i] = x + state.emphasisVel[i] * dt
    }
  }

  function frame(ts) {
    if (state.destroyed) return
    state.rafId = requestAnimationFrame(frame)
    if (!state.lastTs) {
      state.lastTs = ts
      return
    }
    const rawDt = (ts - state.lastTs) / 1000
    state.lastTs = ts
    const dt = Math.min(rawDt, DT_CLAMP)
    state.time += dt

    stepSprings(dt)
    updateParticles(state.world, state.pool, dt, rand, state.time)
    renderFrame(ctx, state.world, state.pool, atlas, state.layers, {
      dt,
      time: state.time,
      sizeScale: state.sizeScale,
      alphaScale: state.alphaScale,
      emphasis: state.emphasis,
    })
    if (state.debug) drawDebug(ts, rawDt)

    // Frame accounting: dev histogram + adaptive degrade window.
    const ms = rawDt * 1000
    state.allFrameTimes.push(ms)
    if (state.allFrameTimes.length > 3600) state.allFrameTimes.shift()
    if (state.degradeDeadline > 0) {
      state.frameTimes.push(ms)
      if (state.time >= state.degradeDeadline) checkDegrade()
    }
  }

  // Adaptive degrade: reduce count and increase per-particle size, never
  // motion quality — and step the DPR cap at BOTH levels, because it is the
  // only lever that scales the fixed cost of the three full-screen composite
  // passes (opaque fill + bloom + core), which particle count cannot touch.
  function checkDegrade() {
    const samples = state.frameTimes.slice(10) // skip JIT warmup
    state.frameTimes = []
    state.degradeDeadline = 0
    if (samples.length < 30) return
    const sorted = [...samples].sort((a, b) => a - b)
    const p90 = sorted[Math.floor(sorted.length * 0.9)]
    if (p90 <= 15 || state.degradeLevel >= 2) return
    state.degradeLevel++
    state.arealTarget *= 0.72
    state.sizeScale *= 1.15
    state.alphaScale *= 1.18
    state.dprCap = state.degradeLevel === 1 ? 1.75 : 1.5
    build(true) // trails blit forward — the rebuild is genuinely invisible
    state.degradeDeadline = state.time + 2
  }

  function startLoop() {
    cancelAnimationFrame(state.rafId)
    state.lastTs = 0
    state.frameTimes = []
    state.degradeDeadline = state.time + 3
    state.rafId = requestAnimationFrame(frame)
  }

  function renderReduced() {
    // Warm start already is steady state; a short headless settle smooths any
    // sampling artifacts, then one composed frame. Seeded PRNG → reproducible.
    for (let s = 0; s < 120; s++) {
      state.time += 1 / 60
      updateParticles(state.world, state.pool, 1 / 60, rand, state.time)
    }
    renderStill(ctx, state.world, state.pool, atlas, state.layers, state.time)
    if (state.debug) drawDebug(performance.now(), 1 / 60)
  }

  function applyMode() {
    // ?reduced is a dev affordance: the automation pane cannot emulate the
    // media query, and the still-frame path deserves a real look.
    state.reduced =
      rmQuery.matches ||
      (import.meta.env.DEV && new URLSearchParams(location.search).has('reduced'))
    build()
    if (state.reduced) {
      cancelAnimationFrame(state.rafId)
      renderReduced()
    } else {
      startLoop()
    }
  }

  // ── events ────────────────────────────────────────────────────────────────
  let resizeTimer = 0
  function onResize() {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(applyMode, 150)
  }
  function onVisibility() {
    if (state.reduced) return
    if (document.hidden) cancelAnimationFrame(state.rafId)
    else startLoop()
  }
  function onMove(e) {
    if (state.reduced) return
    const r = canvas.getBoundingClientRect()
    const hit = hitTest(state.world, e.clientX - r.left, e.clientY - r.top)
    if (hit !== state.hover) {
      state.hover = hit
      callbacks.onHover?.(hit)
    }
  }
  function onLeave() {
    if (state.hover !== -1) {
      state.hover = -1
      callbacks.onHover?.(-1)
    }
  }

  function onKey(e) {
    if (e.key !== 'd' && e.key !== 'D') return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    state.debug = !state.debug
    if (state.debug) {
      state.recyclePrev = state.pool.recycles
      state.recycleAt = performance.now()
      state.recyclePerSec = 0
    }
    if (state.reduced) applyMode() // repaint the still so the panel appears/clears
  }

  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)
  canvas.addEventListener('mousemove', onMove)
  canvas.addEventListener('mouseleave', onLeave)
  rmQuery.addEventListener('change', applyMode)

  applyMode()

  if (import.meta.env.DEV) {
    window.__streamline = {
      stats() {
        const t = [...state.allFrameTimes].sort((a, b) => a - b)
        const q = (p) => t[Math.min(t.length - 1, Math.floor(t.length * p))]
        return {
          frames: t.length,
          p50: q(0.5),
          p90: q(0.9),
          p99: q(0.99),
          dropped: t.filter((ms) => ms > 26).length,
          particles: state.pool.n,
          degradeLevel: state.degradeLevel,
        }
      },
      reset() {
        state.allFrameTimes = []
      },
      // Synchronous cost-per-frame bench: the automation pane throttles rAF
      // when hidden, so wall-clock fps is unmeasurable there — but the compute
      // cost of update+render is the number that decides 60fps anyway.
      bench(n = 300) {
        const times = []
        for (let k = 0; k < n; k++) {
          const t0 = performance.now()
          state.time += 1 / 60
          stepSprings(1 / 60)
          updateParticles(state.world, state.pool, 1 / 60, rand, state.time)
          renderFrame(ctx, state.world, state.pool, atlas, state.layers, {
            dt: 1 / 60,
            time: state.time,
            sizeScale: state.sizeScale,
            alphaScale: state.alphaScale,
            emphasis: state.emphasis,
          })
          times.push(performance.now() - t0)
        }
        times.sort((a, b) => a - b)
        const q = (p) => times[Math.min(n - 1, Math.floor(n * p))]
        return {
          n,
          particles: state.pool.n,
          p50: +q(0.5).toFixed(2),
          p90: +q(0.9).toFixed(2),
          p99: +q(0.99).toFixed(2),
          budget60fps: 16.7,
        }
      },
      state,
    }
  }

  return {
    destroy() {
      state.destroyed = true
      cancelAnimationFrame(state.rafId)
      clearTimeout(resizeTimer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      rmQuery.removeEventListener('change', applyMode)
    },
  }
}

// Hover hit test: nearest polyline point across rivers, coarse stride then
// refine. ~400 distance checks per move — no grid needed at this scale.
function hitTest(world, x, y) {
  let best = -1
  let bestD = Infinity
  let bestJ = 0
  world.rivers.forEach((river, ri) => {
    const sp = river.spline
    for (let j = 0; j < sp.M; j += 4) {
      const dx = sp.xs[j] - x
      const dy = sp.ys[j] - y
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = ri
        bestJ = j
      }
    }
  })
  if (best === -1) return -1
  const river = world.rivers[best]
  const sp = river.spline
  for (let j = Math.max(0, bestJ - 3); j <= Math.min(sp.M - 1, bestJ + 3); j++) {
    const dx = sp.xs[j] - x
    const dy = sp.ys[j] - y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      bestJ = j
    }
  }
  const threshold = river.wTable[bestJ] + 18
  return bestD <= threshold * threshold ? best : -1
}
