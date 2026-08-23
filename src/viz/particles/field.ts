/**
 * A flow field: the sampled centreline and half-width of one flow, as flat typed arrays.
 *
 * Built once per layout and reused for every frame thereafter. The point is allocation
 * discipline — the hot loop does two array reads and a lerp per particle and allocates
 * nothing, which is what keeps a ten-minute idle session flat on the heap.
 *
 * This reads the banks Forge already laid out. It never recomputes a width; a width is
 * Cartographer's quantity and the field is a resampling of the same numbers.
 */

export interface FlowField {
  readonly startX: number;
  readonly endX: number;
  readonly stepPx: number;
  /** Centreline y at each sample. */
  readonly centreY: Float32Array;
  /** Half-width at each sample. Exactly half the width Cartographer stated, resampled. */
  readonly halfWidth: Float32Array;
}

export interface BankPoint {
  readonly x: number;
  readonly y: number;
}

/** Resolution of the lookup table. Legibility/perf choice; encodes nothing. */
export const FIELD_STEP_PX = 4;

function interpolateAt(points: readonly BankPoint[], x: number): number {
  // Points are ordered by x. Linear scan with a cursor is fine: this runs at layout time.
  let lo = 0;
  let hi = points.length - 1;
  if (hi < 0) return 0;
  const first = points[0] as BankPoint;
  const last = points[hi] as BankPoint;
  if (x <= first.x) return first.y;
  if (x >= last.x) return last.y;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((points[mid] as BankPoint).x <= x) lo = mid;
    else hi = mid;
  }
  const a = points[lo] as BankPoint;
  const b = points[hi] as BankPoint;
  const span = b.x - a.x;
  return span === 0 ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / span;
}

export function buildFlowField(
  top: readonly BankPoint[],
  bottom: readonly BankPoint[],
  stepPx = FIELD_STEP_PX,
): FlowField {
  if (top.length === 0 || bottom.length === 0) {
    return {
      startX: 0,
      endX: 0,
      stepPx,
      centreY: new Float32Array(0),
      halfWidth: new Float32Array(0),
    };
  }
  const startX = (top[0] as BankPoint).x;
  const endX = (top[top.length - 1] as BankPoint).x;
  const samples = Math.max(2, Math.ceil((endX - startX) / stepPx) + 1);
  const centreY = new Float32Array(samples);
  const halfWidth = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const x = Math.min(endX, startX + i * stepPx);
    const ty = interpolateAt(top, x);
    const by = interpolateAt(bottom, x);
    centreY[i] = (ty + by) / 2;
    halfWidth[i] = Math.abs(by - ty) / 2;
  }
  return { startX, endX, stepPx, centreY, halfWidth };
}

/** Centreline y at x. Hot path: no allocation, no branching beyond the clamp. */
export function centreAt(field: FlowField, x: number): number {
  const n = field.centreY.length;
  if (n === 0) return 0;
  const t = (x - field.startX) / field.stepPx;
  const i = t <= 0 ? 0 : t >= n - 1 ? n - 2 : Math.floor(t);
  const f = t <= 0 ? 0 : t >= n - 1 ? 1 : t - i;
  const a = field.centreY[i] as number;
  const b = field.centreY[i + 1] as number;
  return a + (b - a) * f;
}

/** Half-width at x. Hot path. */
export function halfWidthAt(field: FlowField, x: number): number {
  const n = field.halfWidth.length;
  if (n === 0) return 0;
  const t = (x - field.startX) / field.stepPx;
  const i = t <= 0 ? 0 : t >= n - 1 ? n - 2 : Math.floor(t);
  const f = t <= 0 ? 0 : t >= n - 1 ? 1 : t - i;
  const a = field.halfWidth[i] as number;
  const b = field.halfWidth[i + 1] as number;
  return a + (b - a) * f;
}
