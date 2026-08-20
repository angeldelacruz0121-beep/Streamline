// Rendering.
//
// Particles never touch the visible canvas directly. They accumulate into an
// offscreen half-resolution buffer; that buffer is downsampled and blurred into
// a quarter-res buffer; both composite onto the main canvas additively. The
// blurred copy is what turns discrete points into a luminous body of water
// rather than a meteor shower.
//
// Particle DIAMETER is proportional to the local channel half-width. This is
// the fix for the perception bug: a fixed sprite size makes a narrow channel
// render as one solid bright tube and a wide channel as a sparse scatter, which
// inverts perceived weight relative to actual width.
//
// Trails come from decaying the accumulation buffer's alpha, dt-corrected —
// without the correction, trail length silently changes with frame rate.

import { sampleSpline } from './spline.js'
import { lerpTable } from './flow.js'
import { STAGE_MAIN, STAGE_SIDE } from './particles.js'

export const GROUND = '#0b0d10'
const TILE = 64
// Geometric alpha ladder. Low per-particle alpha is the point — density comes
// from many overlapping translucent particles, not few opaque ones.
const TIER_A = [0.012, 0.019, 0.03, 0.047, 0.072, 0.105, 0.15, 0.2]
const FADE_BASE = 0.18 // per-frame decay at 60fps; dt-corrected below
const BLOOM_ALPHA = 0.55

// Particle diameter tracks the channel it is in — proportional, but well under
// the full width: at 0.9× the sprites tile the channel solid and every river
// saturates to white once the accumulation buffer reaches equilibrium.
const D_PER_W = 0.55
const D_MIN = 2.4
const D_MAX = 11

export function makeAtlas() {
  const c = document.createElement('canvas')
  c.width = TILE * TIER_A.length
  c.height = TILE
  const g = c.getContext('2d')
  TIER_A.forEach((a, i) => {
    const cx = i * TILE + TILE / 2
    const grad = g.createRadialGradient(cx, TILE / 2, 0, cx, TILE / 2, TILE / 2)
    // Broad plateau then a soft shoulder. A pure gradient-to-zero wastes most
    // of the sprite's area on near-invisible pixels, which is what made the
    // wide rivers read as sparse.
    grad.addColorStop(0, `rgba(226,236,244,${a})`)
    grad.addColorStop(0.42, `rgba(226,236,244,${a * 0.92})`)
    grad.addColorStop(0.72, `rgba(220,232,242,${a * 0.42})`)
    grad.addColorStop(1, 'rgba(216,230,242,0)')
    g.fillStyle = grad
    g.fillRect(i * TILE, 0, TILE, TILE)
  })
  return c
}

function tierFor(a) {
  for (let i = TIER_A.length - 1; i > 0; i--) if (a >= TIER_A[i] * 0.8) return i
  return 0
}

function ss(x) {
  const t = Math.min(Math.max(x, 0), 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

// Offscreen layers. Half-res accumulation + quarter-res blur source.
//
// `prev` carries the old layers across a DEGRADE rebuild: all trail energy
// lives in `acc`, so recreating it cold drops the image to ~1/7 brightness and
// ramps back over ~20 frames — a visible flash on exactly the machines the
// degrade ladder exists to protect. Blitting the old field forward makes the
// rebuild genuinely invisible. Only `acc` needs this (`blur` is regenerated
// from it every frame), and only on degrade — on a resize the layout has
// moved, and stretching stale trails over new geometry would be worse than a
// cold start.
export function createLayers(w, h, dpr, prev = null) {
  const mk = (scale) => {
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w * dpr * scale))
    c.height = Math.max(1, Math.round(h * dpr * scale))
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
    return { c, ctx, scale }
  }
  const layers = { acc: mk(0.5), blur: mk(0.25), w, h }
  if (prev) {
    // Both transforms are CSS-pixel spaces, so this rescales correctly even
    // across a DPR-cap change.
    layers.acc.ctx.drawImage(prev.acc.c, 0, 0, w, h)
  }
  return layers
}

// ── lake ────────────────────────────────────────────────────────────────────
// Boundary displaced by 4 layered sines at incommensurable temporal
// frequencies — the surface has no period, so "no visible loop" holds by
// construction. Spatial frequencies are integers so the curve stays closed.
const SN = [3, 5, 7, 11]
const SA = [0.012, 0.008, 0.005, 0.004]
// Genuinely irrational rate ratios. The previous hand-picked set shared a
// gcd of 0.01 rad/s — an exact 628s period, quietly contradicting the
// "no period by construction" claim below.
const SW = [0.21, 0.21 * Math.SQRT2, 0.21 * Math.E * 0.5, 0.21 * Math.PI * 0.5]
const SP = [0.0, 1.7, 3.9, 5.1]

function lakePath(ctx, world, time, inset = 1) {
  const { C, rx, ry } = world
  ctx.beginPath()
  const STEPS = 112
  for (let s = 0; s <= STEPS; s++) {
    const phi = (s / STEPS) * Math.PI * 2
    let scale = 1
    for (let k = 0; k < 4; k++) scale += SA[k] * Math.sin(SN[k] * phi + SW[k] * time + SP[k])
    scale *= inset
    const x = C[0] + rx * Math.cos(phi) * scale
    const y = C[1] + ry * Math.sin(phi) * scale
    if (s === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

export function drawLake(ctx, world, time) {
  const { C, rx, ry } = world
  ctx.save()
  lakePath(ctx, world, time)
  ctx.clip()

  // Depth: light falls from the far shore, so the basin is brightest along the
  // top and deepens toward the near edge. Offsetting the gradient origin does
  // more for dimensionality than a concentric one.
  const g = ctx.createRadialGradient(
    C[0],
    C[1] - ry * 0.8,
    rx * 0.04,
    C[0],
    C[1] - ry * 0.05,
    rx * 1.18,
  )
  g.addColorStop(0, '#18212c')
  g.addColorStop(0.4, '#111923')
  g.addColorStop(1, '#0a0e14')
  ctx.fillStyle = g
  ctx.fillRect(C[0] - rx * 1.2, C[1] - ry * 1.2, rx * 2.4, ry * 2.4)

  // Surface shimmer: slow elongated highlight bands drifting across the basin
  // at incommensurable rates, so the surface is alive before any river lands.
  // Elliptical radial falloff — a linear gradient in a fillRect leaves hard
  // horizontal edges where the rect ends, which reads as stacked boxes.
  ctx.globalCompositeOperation = 'lighter'
  const BANDS = 5
  for (let b = 0; b < BANDS; b++) {
    const ph = b * 1.31
    const drift = Math.sin(time * (0.052 + b * 0.017) + ph)
    const y = C[1] + ry * (-0.58 + b * 0.28 + 0.05 * Math.sin(time * 0.083 + ph * 2.1))
    const halfW = rx * (0.36 + 0.19 * Math.sin(time * 0.041 + ph))
    const halfH = ry * (0.1 + 0.03 * Math.sin(time * 0.067 + ph * 1.4))
    const cx = C[0] + rx * 0.3 * drift
    const a = 0.03 + 0.018 * Math.sin(time * 0.11 + ph * 1.7)
    ctx.save()
    ctx.translate(cx, y)
    ctx.scale(1, halfH / halfW)
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, halfW)
    bg.addColorStop(0, `rgba(154,184,210,${a.toFixed(4)})`)
    bg.addColorStop(0.55, `rgba(150,180,205,${(a * 0.4).toFixed(4)})`)
    bg.addColorStop(1, 'rgba(150,180,205,0)')
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.arc(0, 0, halfW, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Absorption glow where each river lands — radius and brightness scale with
  // that river's net contribution, so the shore states the payoff again.
  for (const river of world.rivers) {
    const m = river.mouth
    if (!m) continue
    const pulse = 0.82 + 0.18 * Math.sin(time * 0.9 + m.phase)
    const r = Math.max(m.w * 3.4, 14) * pulse
    const sg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r)
    sg.addColorStop(0, `rgba(176,204,226,${(0.1 * pulse).toFixed(4)})`)
    sg.addColorStop(0.45, `rgba(160,192,218,${(0.038 * pulse).toFixed(4)})`)
    sg.addColorStop(1, 'rgba(150,185,214,0)')
    ctx.fillStyle = sg
    ctx.fillRect(m.x - r, m.y - r, r * 2, r * 2)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.restore()

  // Rim: a hairline of scattered light so the basin has an edge, not a cutout.
  ctx.save()
  lakePath(ctx, world, time)
  ctx.strokeStyle = 'rgba(126,158,184,0.13)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

// ── particles ───────────────────────────────────────────────────────────────
const out = [0, 0, 0, 0]
const res = { x: 0, y: 0, fade: 0, w: 0 }

function clamp1(v) {
  return v < -1 ? -1 : v > 1 ? 1 : v
}

function particleScreen(world, pool, i, time) {
  const river = world.rivers[pool.riverIdx[i]]
  const stage = pool.stage[i]

  if (stage === STAGE_MAIN) {
    const t = pool.t[i]
    sampleSpline(river.spline, t, out)
    const w = lerpTable(river.wTable, t)
    const latEff = clamp1(
      pool.lat[i] + 0.06 * Math.sin(pool.driftFreq[i] * time * Math.PI * 2 + pool.driftPhase[i]),
    )
    res.x = out[0] + out[2] * latEff * w
    res.y = out[1] + out[3] * latEff * w
    res.fade = lerpTable(river.alphaComp, t)
    res.w = w
    return
  }

  if (stage === STAGE_SIDE) {
    const b = river.bottlenecks[pool.sideIdx[i]]
    const t = pool.t[i]
    sampleSpline(b.side.spline, t, out)
    // Taper all the way to zero — money leaving has to actually dissipate, not
    // stop. Size follows this, so particles shrink as they fade.
    const w = b.sideW0 * Math.pow(1 - t, 0.75)
    const latEff = clamp1(
      pool.lat[i] + 0.06 * Math.sin(pool.driftFreq[i] * time * Math.PI * 2 + pool.driftPhase[i]),
    )
    res.x = out[0] + out[2] * latEff * w
    res.y = out[1] + out[3] * latEff * w
    // Fade across the last 60% so dissipation is legible rather than a pop.
    res.fade = t > 0.4 ? 1 - ss((t - 0.4) / 0.6) : 1
    res.w = w
    return
  }

  // lake
  res.x = pool.px[i]
  res.y = pool.py[i]
  const ageF = pool.age[i] / pool.life[i]
  const rampIn = Math.min(pool.age[i] / 0.6, 1)
  const rampOut = ageF > 0.62 ? 1 - ss((ageF - 0.62) / 0.38) : 1
  res.fade = 0.9 * rampIn * rampOut
  res.w = world.lakeParticleW
}

function drawParticles(ctx, world, pool, atlas, time, sizeScale, alphaScale, emphasis) {
  ctx.globalCompositeOperation = 'lighter'
  const n = pool.n
  for (let i = 0; i < n; i++) {
    particleScreen(world, pool, i, time)
    const a = pool.baseAlpha[i] * res.fade * alphaScale * emphasis[pool.riverIdx[i]]
    if (a < 0.006) continue
    let d = res.w * D_PER_W
    d = (d < D_MIN ? D_MIN : d > D_MAX ? D_MAX : d) * pool.size[i] * sizeScale
    const tier = tierFor(a)
    ctx.drawImage(atlas, tier * TILE, 0, TILE, TILE, res.x - d / 2, res.y - d / 2, d, d)
  }
  ctx.globalCompositeOperation = 'source-over'
}

export function renderFrame(ctx, world, pool, atlas, layers, opts) {
  const { dt, time, sizeScale, alphaScale, emphasis } = opts
  const { w, h } = world
  const acc = layers.acc
  const blur = layers.blur

  // Decay the accumulated field's ALPHA. destination-out is what makes this a
  // trail rather than a clear; fading toward a colour would tint the buffer.
  //
  // The decay is CLAMPED at 0.25/frame. In 8 bits, α·(1−k) rounds back to α
  // wherever α < 0.5/k, so small decays leave a permanent white deposit along
  // every path the water has touched — and the dt correction makes it worse on
  // fast displays (at 120Hz, k≈0.094 → floor 5/255, doubled by the two
  // additive layers and smeared by the bloom upscale). k=0.25 pins the floor
  // at 1/255 — at or below display noise — and removes the frame-rate
  // dependence. (A periodic stronger wipe does NOT work: a 4/255-alpha pass
  // still rounds 3·0.984 back to 3, and wipes pulse the trail.)
  const fade = Math.max(0.25, 1 - Math.pow(1 - FADE_BASE, dt * 60))
  acc.ctx.globalCompositeOperation = 'destination-out'
  acc.ctx.fillStyle = `rgba(0,0,0,${fade.toFixed(4)})`
  acc.ctx.fillRect(0, 0, w, h)

  drawParticles(acc.ctx, world, pool, atlas, time, sizeScale, alphaScale, emphasis)

  // Downsample to quarter res with a small blur — the bloom source. Blurring a
  // quarter-size buffer costs a quarter as much as blurring the full frame.
  blur.ctx.globalCompositeOperation = 'copy'
  blur.ctx.filter = 'blur(1.6px)'
  blur.ctx.drawImage(acc.c, 0, 0, w, h)
  blur.ctx.filter = 'none'
  blur.ctx.globalCompositeOperation = 'source-over'

  // Compose: ground, lake body, bloom halo, then the sharp core on top.
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = GROUND
  ctx.fillRect(0, 0, w, h)

  drawLake(ctx, world, time)

  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = BLOOM_ALPHA
  ctx.drawImage(blur.c, 0, 0, w, h)
  ctx.globalAlpha = 1
  ctx.drawImage(acc.c, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
}

// Reduced-motion: one composed frame. Ghost samples along each particle's
// recent path stand in for the trails the decay would have built up.
export function renderStill(ctx, world, pool, atlas, layers, time) {
  const { w, h, v0 } = world
  const acc = layers.acc
  const blur = layers.blur

  acc.ctx.globalCompositeOperation = 'copy'
  acc.ctx.fillStyle = 'rgba(0,0,0,0)'
  acc.ctx.fillRect(0, 0, w, h)
  acc.ctx.globalCompositeOperation = 'source-over'

  const GHOSTS = 5
  acc.ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < pool.n; i++) {
    const river = world.rivers[pool.riverIdx[i]]
    const stage = pool.stage[i]
    const tSaved = pool.t[i]
    for (let g = 0; g < GHOSTS; g++) {
      if (stage !== 2) {
        const L =
          stage === 0 ? river.spline.length : river.bottlenecks[pool.sideIdx[i]].side.spline.length
        pool.t[i] = Math.max(0, tSaved - (g * 0.05 * v0 * pool.speedJitter[i]) / L)
      }
      particleScreen(world, pool, i, time)
      const a = pool.baseAlpha[i] * res.fade * 1.9 * (1 - g * 0.19)
      if (a >= 0.006) {
        let d = res.w * D_PER_W
        d = (d < D_MIN ? D_MIN : d > D_MAX ? D_MAX : d) * pool.size[i]
        const tier = tierFor(a)
        acc.ctx.drawImage(atlas, tier * TILE, 0, TILE, TILE, res.x - d / 2, res.y - d / 2, d, d)
      }
      if (stage === 2) break // lake residents get a single stamp
    }
    pool.t[i] = tSaved
  }
  acc.ctx.globalCompositeOperation = 'source-over'

  blur.ctx.globalCompositeOperation = 'copy'
  blur.ctx.filter = 'blur(1.6px)'
  blur.ctx.drawImage(acc.c, 0, 0, w, h)
  blur.ctx.filter = 'none'
  blur.ctx.globalCompositeOperation = 'source-over'

  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = GROUND
  ctx.fillRect(0, 0, w, h)
  drawLake(ctx, world, time)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = BLOOM_ALPHA
  ctx.drawImage(blur.c, 0, 0, w, h)
  ctx.globalAlpha = 1
  ctx.drawImage(acc.c, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
}
