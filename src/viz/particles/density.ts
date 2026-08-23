/**
 * How many particles express a flow.
 *
 * INVARIANT 3.6 IS THE WHOLE DESIGN OF THIS FILE. "Particle density, flow speed, and
 * colour either encode something real and documented here, or they are removed." Density
 * is not currently assigned an encoding, so it must not be readable as one. The only way
 * to have particles at all under that rule is to make density carry no information:
 *
 *   PARTICLES PER SQUARE PIXEL IS ONE CONSTANT FOR EVERY FLOW ON THE CANVAS.
 *
 * A wide river therefore has more particles than a narrow one for exactly the same reason
 * it has more pixels, which is a consequence of the 3.1 width encoding and not a second
 * channel layered on top of it. Nothing about a segment other than its already-encoded
 * size can change its particle count. `no-encoding-leak.test.ts` asserts that two flows
 * of equal surface area receive equal counts and that the recovered areal density is
 * identical across every lane, the trunk included.
 *
 * DEGRADATION SCALES THE CONSTANT GLOBALLY. When the ladder reduces density it multiplies
 * one number that applies to every flow, so the ratio between any two flows is unchanged
 * and the channel stays uninformative at every quality level. Per-flow degradation is not
 * implemented and must not be: it would make quality level a data channel.
 */

/**
 * Re-homed to `canvas-tokens.ts` on adoption (2026-08-21), value unchanged, and
 * re-exported so every existing consumer keeps one import point. The value is Atelier's
 * to raise or lower with Angel on sight; its UNIFORMITY across flows stays this module's
 * and is asserted below.
 */
import { PARTICLES_PER_1000_PX2 } from '../../design/tokens/canvas-tokens';

export { PARTICLES_PER_1000_PX2 } from '../../design/tokens/canvas-tokens';

/** Hard ceiling on the pool, so a pathological filer cannot allocate without bound. */
export const PARTICLE_POOL_CEILING = 24_000;

/**
 * Baseline flow speed, in CSS pixels per second along the flow axis.
 *
 * NOT THE INVARIANT 3.5 ENCODING. 3.5 maps year-over-year segment growth to speed, and
 * open decision D9 fixes the bounds of that mapping; both are excluded from this
 * workstream. This is a single module-level constant that varies with nothing — there is
 * deliberately no per-flow speed field anywhere in this directory, so a growth mapping
 * cannot be introduced by accident, only by a change that has to declare itself.
 *
 * 3.5's own rule for this case is the one being followed: "A segment with no prior-period
 * comparison renders at baseline speed and is labelled as such." The label is emitted by
 * `render/layout.ts` as the `baseline-flow` scene note.
 */
export const BASELINE_FLOW_PX_PER_SEC = 26;

/** Particle count for a flow of `surfacePx2`, at a global density multiplier. */
export function particleCountFor(surfacePx2: number, densityScale = 1): number {
  if (!Number.isFinite(surfacePx2) || surfacePx2 <= 0) return 0;
  return Math.max(1, Math.round((surfacePx2 / 1000) * PARTICLES_PER_1000_PX2 * densityScale));
}

/** Recovered areal density. A test asserts this is the same number for every flow. */
export function arealDensity(count: number, surfacePx2: number): number {
  return surfacePx2 === 0 ? 0 : count / surfacePx2;
}
