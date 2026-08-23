/**
 * The particle system.
 *
 * Three properties this file is built to hold, each one a line in Forge's definition of
 * done rather than a preference:
 *
 *   ALLOCATION-FREE STEADY STATE. The pool is four `Float32Array`s and one `Int32Array`,
 *   sized once at construction to the maximum density and never resized. Degradation
 *   lowers the *active* count, never the capacity, so stepping down and back up does not
 *   touch the allocator. `system.test.ts` asserts the buffer identities are unchanged
 *   after a level change and after ten thousand steps.
 *
 *   DETERMINISM. Seeded `mulberry32`, no `Math.random` anywhere. Two loads of the same
 *   filer produce the same picture, so nothing on screen moves that was not documented as
 *   moving.
 *
 *   NO PER-FLOW SPEED FIELD. There is no `speed` on a particle and none on a flow. Speed
 *   is one module constant in `density.ts`. Invariant 3.5's growth mapping and its open
 *   decision D9 are excluded from this workstream, and their absence is structural.
 */
import { BASELINE_FLOW_PX_PER_SEC, PARTICLE_POOL_CEILING, particleCountFor } from './density';
import { centreAt, halfWidthAt, type FlowField } from './field';

export interface FlowSource {
  readonly id: string;
  readonly field: FlowField;
  /** Plan area of the drawn silhouette. The only input to the particle count. */
  readonly surfacePx2: number;
}

/**
 * Cross-flow wobble. Uniform for every particle; expresses nothing. Re-homed to
 * `canvas-tokens.ts` on adoption (2026-08-21), values unchanged.
 */
import { WOBBLE_AMPLITUDE, WOBBLE_RATE } from '../../design/tokens/canvas-tokens';
/** Keeps a particle off the bank line so the silhouette edge stays clean. */
const CROSS_INSET = 0.9;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ParticleSystem {
  readonly capacity: number;
  private readonly flows: readonly FlowSource[];
  private readonly x: Float32Array;
  private readonly cross: Float32Array;
  private readonly phase: Float32Array;
  /**
   * Per-particle drift multiplier, so the field does not read as a marching grid. Drawn
   * from the same uniform distribution for every particle in every flow, so it is not a
   * per-flow speed and carries nothing. There is deliberately no flow-level speed value
   * anywhere in this class — see the header note on D9.
   */
  private readonly drift: Float32Array;
  private readonly flowOf: Int32Array;
  private readonly flowStart: Int32Array;
  private readonly flowCapacity: Int32Array;
  private readonly flowActive: Int32Array;
  private elapsedSec = 0;
  private densityScale = 1;

  constructor(flows: readonly FlowSource[], seed = 0x5f3759df) {
    this.flows = flows;
    const starts = new Int32Array(flows.length);
    const caps = new Int32Array(flows.length);
    let total = 0;
    flows.forEach((flow, i) => {
      const want = particleCountFor(flow.surfacePx2, 1);
      const room = Math.max(0, PARTICLE_POOL_CEILING - total);
      const cap = Math.min(want, room);
      starts[i] = total;
      caps[i] = cap;
      total += cap;
    });

    this.capacity = total;
    this.flowStart = starts;
    this.flowCapacity = caps;
    this.flowActive = Int32Array.from(caps);
    this.x = new Float32Array(total);
    this.cross = new Float32Array(total);
    this.phase = new Float32Array(total);
    this.drift = new Float32Array(total);
    this.flowOf = new Int32Array(total);

    const rand = mulberry32(seed);
    flows.forEach((flow, i) => {
      const start = starts[i] as number;
      const cap = caps[i] as number;
      const span = Math.max(1e-6, flow.field.endX - flow.field.startX);
      for (let k = 0; k < cap; k += 1) {
        const p = start + k;
        this.x[p] = flow.field.startX + rand() * span;
        this.cross[p] = (rand() * 2 - 1) * CROSS_INSET;
        this.phase[p] = rand() * Math.PI * 2;
        // ±8%, from one distribution shared by every flow, so it cannot be decoded as a
        // difference between segments.
        this.drift[p] = 0.92 + rand() * 0.16;
        this.flowOf[p] = i;
      }
    });
  }

  /** Total particles currently drawn. Reported by the perf harness. */
  activeCount(): number {
    let n = 0;
    for (let i = 0; i < this.flowActive.length; i += 1) n += this.flowActive[i] as number;
    return n;
  }

  /**
   * Global density multiplier, applied identically to every flow. There is no per-flow
   * override and there must not be one: it would make the degradation level readable as
   * a difference between segments.
   */
  setDensityScale(scale: number): void {
    const clamped = Math.min(1, Math.max(0, scale));
    if (clamped === this.densityScale) return;
    this.densityScale = clamped;
    this.flows.forEach((flow, i) => {
      const cap = this.flowCapacity[i] as number;
      this.flowActive[i] = Math.min(cap, particleCountFor(flow.surfacePx2, clamped));
    });
  }

  getDensityScale(): number {
    return this.densityScale;
  }

  /** Advance by `dtSec`. Wraps at the flow mouth; no allocation, no branch on flow id. */
  step(dtSec: number): void {
    this.elapsedSec += dtSec;
    const advance = BASELINE_FLOW_PX_PER_SEC * dtSec;
    for (let i = 0; i < this.flows.length; i += 1) {
      const flow = this.flows[i] as FlowSource;
      const start = this.flowStart[i] as number;
      const active = this.flowActive[i] as number;
      const from = flow.field.startX;
      const span = Math.max(1e-6, flow.field.endX - from);
      for (let k = 0; k < active; k += 1) {
        const p = start + k;
        let nx = (this.x[p] as number) + advance * (this.drift[p] as number);
        if (nx > from + span) nx -= span;
        this.x[p] = nx;
      }
    }
  }

  /**
   * Emit current positions into caller-owned output buffers. The renderer allocates these
   * once and hands the same pair in every frame, so drawing costs no garbage either.
   * Returns the number of points written.
   */
  writePositions(outX: Float32Array, outY: Float32Array): number {
    let n = 0;
    const t = this.elapsedSec;
    for (let i = 0; i < this.flows.length; i += 1) {
      const flow = this.flows[i] as FlowSource;
      const start = this.flowStart[i] as number;
      const active = this.flowActive[i] as number;
      for (let k = 0; k < active && n < outX.length; k += 1) {
        const p = start + k;
        const px = this.x[p] as number;
        const wobble = Math.sin((this.phase[p] as number) + t * WOBBLE_RATE) * WOBBLE_AMPLITUDE;
        let u = (this.cross[p] as number) + wobble;
        if (u > CROSS_INSET) u = CROSS_INSET;
        else if (u < -CROSS_INSET) u = -CROSS_INSET;
        outX[n] = px;
        outY[n] = centreAt(flow.field, px) + u * halfWidthAt(flow.field, px);
        n += 1;
      }
    }
    return n;
  }

  /** Buffer identities, for the allocation-stability test. Not part of the render path. */
  buffers(): readonly ArrayBufferLike[] {
    return [this.x.buffer, this.cross.buffer, this.phase.buffer, this.flowOf.buffer];
  }
}
