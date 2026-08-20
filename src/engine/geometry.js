// Layout is derived, not placed.
//
// The lake is an ellipse centered in the lower-middle third. The incoming arc
// above it is partitioned into angular wedges, one per segment, weighted by
// √gross so wide rivers get room. Rivers and their side channels are constrained
// to their own wedge — crossings are impossible by construction, and everything
// recomputes on resize.
//
// Angle convention: direction from lake center = (cosθ, −sinθ), so θ=90° is
// straight up in canvas coords. Wedges run left (152°) → right (28°).

import { buildSpline, sampleSpline } from './spline.js'

const DEG = Math.PI / 180
const SPAN_L = 152 * DEG
const SPAN_R = 28 * DEG

export function buildLayout(w, h, segments) {
  const C = [w * 0.5, h * 0.64]
  const rx = Math.min(Math.max(w * 0.19, 96), 320)
  const ry = rx * 0.52

  // Farthest viewport corner from the lake center — river sources sit beyond it.
  const cornerDist = Math.max(
    Math.hypot(C[0], C[1]),
    Math.hypot(w - C[0], C[1]),
    Math.hypot(C[0], h - C[1]),
    Math.hypot(w - C[0], h - C[1]),
  )

  // Wedge partition weighted by gross (floored so no lane collapses) — lanes
  // by √gross visually contradict widths drawn ∝ gross and compress the
  // hierarchy the whole piece exists to show.
  const grossTotal = segments.reduce((s, x) => s + x.grossRevenue, 0)
  const weights = segments.map((s) => Math.max(s.grossRevenue, grossTotal * 0.09))
  const wSum = weights.reduce((a, b) => a + b, 0)
  const span = SPAN_L - SPAN_R

  let edge = SPAN_L
  const rivers = segments.map((seg, i) => {
    const width = (span * weights[i]) / wSum
    const a0 = edge // left (high) edge
    const a1 = edge - width // right (low) edge
    edge = a1
    const ac = (a0 + a1) / 2
    const half = width / 2

    const ray = [Math.cos(ac), -Math.sin(ac)]
    const perp = [Math.sin(ac), Math.cos(ac)]

    // Shore point on the ellipse at the wedge's center angle.
    const P3 = [C[0] + rx * Math.cos(ac) * 0.97, C[1] - ry * Math.sin(ac) * 0.97]
    // Source just beyond where this wedge's ray exits the viewport — keeps the
    // visible course (and the bottleneck window) on-screen instead of spending
    // 40% of the spline out of frame.
    const R0 = rayExitDist(C, ray, w, h) + 130
    const P0 = [C[0] + ray[0] * R0, C[1] + ray[1] * R0]
    const dist = Math.hypot(P3[0] - P0[0], P3[1] - P0[1])

    // Straight entry along the ray (the source is barely off-frame — an early
    // bend hooks visibly on-screen), then one gentle curve carried by P2,
    // bounded by the wedge half-angle so the course cannot leave it.
    const bendSign = i % 2 === 0 ? 1 : -1
    const bend = Math.min(dist * 0.1, Math.tan(half * 0.5) * (R0 * 0.45))
    const P1 = [P0[0] - ray[0] * dist * 0.34, P0[1] - ray[1] * dist * 0.34]
    const P2 = [
      P3[0] + ray[0] * dist * 0.34 - perp[0] * bend * bendSign,
      P3[1] + ray[1] * dist * 0.34 - perp[1] * bend * bendSign,
    ]

    const spline = buildSpline(P0, P1, P2, P3)

    // Which perpendicular side the spill channels take: away from the lake's
    // vertical axis, so left wedges spill left and right wedges spill right.
    // (+1 selects (−T̂y, T̂x); for a river flowing down-right that perp points
    // down-left, WITH the flow — the wrong sign makes spills curl upstream
    // like thorns.)
    const mid = sampleSpline(spline, 0.5, [0, 0, 0, 0])
    let channelSide
    if (Math.abs(mid[0] - C[0]) > 4) channelSide = mid[0] < C[0] ? 1 : -1
    else channelSide = i < segments.length / 2 ? 1 : -1

    // Bottleneck positions derived from cost count, never placed. The window
    // sits downstream (0.44–0.8) so the UNTOUCHED entry width gets real
    // on-screen run — with costs at t=0.39 the full ratio between rivers only
    // ever existed off-frame, and the visible comparison collapsed to ~2.4×.
    const k = seg.costs.length
    const bottlenecks = seg.costs.map((cost, j) => {
      const t = 0.44 + ((j + 0.5) * (0.8 - 0.44)) / k
      return { t, cost, side: null } // side spline built below
    })

    return {
      segment: seg,
      wedge: { a0, a1, ac, half },
      spline,
      channelSide,
      bottlenecks,
      P0,
      P3,
    }
  })

  // Side channels — built after the main splines so they can read tangents.
  for (const river of rivers) {
    const sp = river.spline
    const L = sp.length
    const out = [0, 0, 0, 0]
    for (const b of river.bottlenecks) {
      sampleSpline(sp, b.t, out)
      const Q0 = [out[0], out[1]]
      // Tangent (downstream) from the normal: n = (−t̂y, t̂x) ⇒ t̂ = (ny, −nx).
      const T = [out[3], -out[2]]
      const P = [-T[1] * river.channelSide, T[0] * river.channelSide]
      const Rout = norm2(Q0[0] - C[0], Q0[1] - C[1])

      const cFrac = b.cost.amount / river.segment.grossRevenue
      const d1 = L * 0.045
      // The spill's reach is capped by the wedge's LINEAR half-width at the
      // branch radius — otherwise narrow wedges force the clamp to fold the
      // channel into a tight crook along the wedge edge. Long enough that the
      // taper-to-nothing is legible as dissipation rather than a glitch.
      const rQ0 = Math.hypot(Q0[0] - C[0], Q0[1] - C[1])
      const wedgeRoom = rQ0 * Math.tan(river.wedge.half * 0.84)
      const sideLen = Math.min(L * (0.2 + 0.16 * cFrac), 300, wedgeRoom * 0.92)

      // Q1 along the main tangent gives C¹ continuity at the split — without it
      // the divergence reads as a teleport. The channel then veers mostly
      // sideways with only a mild outward drift — a strong radial component
      // reads as water hooking back uphill.
      const Q1 = [Q0[0] + T[0] * d1, Q0[1] + T[1] * d1]
      let Q2 = [
        Q0[0] + T[0] * d1 * 1.7 + P[0] * sideLen * 0.5,
        Q0[1] + T[1] * d1 * 1.7 + P[1] * sideLen * 0.5,
      ]
      let Q3 = [
        Q0[0] + T[0] * d1 * 1.2 + P[0] * sideLen + Rout[0] * sideLen * 0.15,
        Q0[1] + T[1] * d1 * 1.2 + P[1] * sideLen + Rout[1] * sideLen * 0.15,
      ]
      // Wedge clamp — the named-risk mitigation. Angles clamped inside the
      // wedge minus a margin; radius preserved.
      Q2 = clampToWedge(Q2, C, river.wedge)
      Q3 = clampToWedge(Q3, C, river.wedge)

      b.side = { spline: buildSpline(Q0, Q1, Q2, Q3) }
    }
  }

  return { w, h, C, rx, ry, cornerDist, rivers }
}

// Where each river meets the shore — the anchor for the absorption glow, so
// the lake brightens in proportion to what actually arrives.
export function attachMouths(world) {
  const out = [0, 0, 0, 0]
  world.rivers.forEach((river, i) => {
    sampleSpline(river.spline, 1, out)
    river.mouth = {
      x: out[0],
      y: out[1],
      w: river.wTable[river.wTable.length - 1],
      phase: i * 1.87, // incommensurable-ish offsets so the glows never pulse in unison
    }
  })
}

function norm2(x, y) {
  const l = Math.hypot(x, y) || 1
  return [x / l, y / l]
}

// Distance along direction d from point C to the viewport rectangle's edge.
function rayExitDist(C, d, w, h) {
  let best = Infinity
  if (d[0] > 1e-9) best = Math.min(best, (w - C[0]) / d[0])
  if (d[0] < -1e-9) best = Math.min(best, -C[0] / d[0])
  if (d[1] > 1e-9) best = Math.min(best, (h - C[1]) / d[1])
  if (d[1] < -1e-9) best = Math.min(best, -C[1] / d[1])
  return Number.isFinite(best) ? best : Math.hypot(w, h)
}

function clampToWedge(p, C, wedge) {
  const dx = p[0] - C[0]
  const dy = p[1] - C[1]
  const theta = Math.atan2(-dy, dx)
  const m = wedge.half * 0.16
  const lo = wedge.a1 + m
  const hi = wedge.a0 - m
  if (theta >= lo && theta <= hi) return p
  const cl = Math.min(Math.max(theta, lo), hi)
  const r = Math.hypot(dx, dy)
  return [C[0] + Math.cos(cl) * r, C[1] - Math.sin(cl) * r]
}

// Label anchor: where the river crosses the upper part of the frame — the fan
// is widest there, so anchors separate by construction; staggered heights keep
// neighbours off a shared line. Offset to the side opposite the spill channels
// so the label never sits in the spray.
const LABEL_Y = [0.34, 0.2, 0.38, 0.26]

export function labelAnchor(river, world, wTable, idx = 0) {
  const sp = river.spline
  const out = [0, 0, 0, 0]
  const yTarget = world.h * LABEL_Y[idx % LABEL_Y.length]
  let jA = sp.M - 1
  for (let j = 0; j < sp.M; j++) {
    if (sp.ys[j] >= yTarget && sp.xs[j] > 0 && sp.xs[j] < world.w) {
      jA = j
      break
    }
  }
  const t = jA / (sp.M - 1)
  sampleSpline(sp, t, out)
  const wHalf = wTable[jA]
  const s = -river.channelSide
  return {
    x: Math.min(Math.max(out[0] + out[2] * s * (wHalf + 18), 20), world.w - 165),
    y: Math.min(Math.max(out[1] + out[3] * s * (wHalf + 18), 20), world.h - 40),
    t,
  }
}
