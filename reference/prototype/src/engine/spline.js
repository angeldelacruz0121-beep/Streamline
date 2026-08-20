// Cubic Bézier → arc-length-parameterized polyline.
//
// Naive sampling in Bézier parameter u moves particles fast through straight
// sections and slow through curves — the most obvious tell that a curve was not
// reparameterized. So: dense sample in u, cumulative arc-length table, resample
// to M points equally spaced in arc length. After that, t ∈ [0,1] IS normalized
// arc length and constant dt/dt is constant world-space speed.

const M = 384 // resampled points per spline

function bezierPoint(p0, p1, p2, p3, u) {
  const v = 1 - u
  const a = v * v * v
  const b = 3 * v * v * u
  const c = 3 * v * u * u
  const d = u * u * u
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ]
}

export function buildSpline(p0, p1, p2, p3) {
  // 1. Dense sample in u, count scaled by chord length.
  const chord =
    Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) +
    Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) +
    Math.hypot(p3[0] - p2[0], p3[1] - p2[1])
  const N = Math.min(1200, Math.max(400, Math.round(chord / 2)))

  const dense = new Float64Array((N + 1) * 2)
  for (let i = 0; i <= N; i++) {
    const [x, y] = bezierPoint(p0, p1, p2, p3, i / N)
    dense[i * 2] = x
    dense[i * 2 + 1] = y
  }

  // 2. Cumulative arc length.
  const cum = new Float64Array(N + 1)
  for (let i = 1; i <= N; i++) {
    const dx = dense[i * 2] - dense[(i - 1) * 2]
    const dy = dense[i * 2 + 1] - dense[(i - 1) * 2 + 1]
    cum[i] = cum[i - 1] + Math.hypot(dx, dy)
  }
  const L = cum[N]

  // 3. Resample equally spaced in arc length. Forward walk — targets are monotonic.
  const xs = new Float32Array(M)
  const ys = new Float32Array(M)
  let k = 0
  for (let j = 0; j < M; j++) {
    const s = (j / (M - 1)) * L
    while (k < N && cum[k + 1] < s) k++
    const seg = cum[k + 1] - cum[k]
    const f = seg > 1e-9 ? (s - cum[k]) / seg : 0
    xs[j] = dense[k * 2] + f * (dense[(k + 1) * 2] - dense[k * 2])
    ys[j] = dense[k * 2 + 1] + f * (dense[(k + 1) * 2 + 1] - dense[k * 2 + 1])
  }

  // 4. Normals from central differences (forward differences leave a visible
  //    shear where the normal field kinks), plus curvature for the offset guard.
  const nx = new Float32Array(M)
  const ny = new Float32Array(M)
  const curvature = new Float32Array(M)
  for (let j = 0; j < M; j++) {
    const a = Math.max(0, j - 1)
    const b = Math.min(M - 1, j + 1)
    const tx = xs[b] - xs[a]
    const ty = ys[b] - ys[a]
    const len = Math.hypot(tx, ty) || 1
    nx[j] = -ty / len
    ny[j] = tx / len
  }
  // Curvature via second differences on the (uniform arc-length) samples.
  const ds = L / (M - 1)
  for (let j = 1; j < M - 1; j++) {
    const ax = (xs[j + 1] - 2 * xs[j] + xs[j - 1]) / (ds * ds)
    const ay = (ys[j + 1] - 2 * ys[j] + ys[j - 1]) / (ds * ds)
    curvature[j] = Math.hypot(ax, ay)
  }
  curvature[0] = curvature[1]
  curvature[M - 1] = curvature[M - 2]

  return { xs, ys, nx, ny, curvature, length: L, M }
}

// Position + normal at t ∈ [0,1], lerped between samples.
// out = [x, y, nx, ny]; returns out to avoid allocation in the hot loop.
export function sampleSpline(sp, t, out) {
  const f = Math.min(Math.max(t, 0), 1) * (sp.M - 1)
  const i = Math.min(sp.M - 2, Math.floor(f))
  const r = f - i
  out[0] = sp.xs[i] + r * (sp.xs[i + 1] - sp.xs[i])
  out[1] = sp.ys[i] + r * (sp.ys[i + 1] - sp.ys[i])
  out[2] = sp.nx[i] + r * (sp.nx[i + 1] - sp.nx[i])
  out[3] = sp.ny[i] + r * (sp.ny[i + 1] - sp.ny[i])
  return out
}

export const SPLINE_SAMPLES = M
