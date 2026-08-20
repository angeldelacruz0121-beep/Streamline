// Seeded PRNG (mulberry32) — reproducible still frames for reduced motion,
// and no dependency. One instance per concern so streams don't interleave.

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Center-weighted draw in [-1, 1]: sum of three uniforms, approximately normal.
// Real channels run densest mid-stream; a uniform draw reads as a flat ribbon.
export function centerWeighted(rand) {
  return (rand() + rand() + rand()) / 1.5 - 1
}
