/**
 * HARNESS ONLY. A canvas model with one lane per segment, cap ignored.
 *
 * Invariant 3.7 caps the display at 5–8 segments plus a "More" control, and
 * `encoding/segment-cap.ts` enforces it. That cap is correct and it ships. But Invariant
 * 4.1 states the performance reference load as TWELVE segments, and under the cap twelve
 * segments render as nine lanes — so measuring only the capped path would leave the
 * worst-case lane count unmeasured and the 4.1 reference load unmet on its own terms.
 *
 * This module builds the twelve-lane case out of Cartographer's own exported functions.
 * Nothing in `src/viz/encoding` is edited, nothing is reimplemented, and every width still
 * comes from `composeRiver`. The only thing stepped around is the display cap, and only
 * inside the harness. The application never imports this file, and the capped path is
 * measured alongside it so the shipping configuration is the headline number.
 */
import {
  composeCanvas,
  composeRiver,
  type CanvasInput,
  type CanvasModel,
  type RiverGeometry,
} from '../../encoding';

export function uncappedModel(input: CanvasInput): CanvasModel {
  // The trunk, lake, indicators, scales and legibility report all come from the real
  // compose, which computes them from EVERY segment regardless of the cap. Only the
  // `rivers` array is replaced, so conservation still holds exactly: the sum of the drawn
  // mouth widths is still the trunk's arriving width.
  const capped = composeCanvas(input);
  if (!capped.ok) {
    throw new Error(
      `Uncapped harness model failed: ${capped.blocked.map((b) => b.message).join(' | ')}`,
    );
  }

  const rivers: RiverGeometry[] = [];
  for (const segment of input.segments) {
    const result = composeRiver(segment, input.toleranceUsd ?? 0);
    if (!result.ok) {
      throw new Error(
        `Uncapped harness river ${segment.id} failed: ${result.blocked.map((b) => b.message).join(' | ')}`,
      );
    }
    rivers.push(result.value);
  }

  return { ...capped.value, rivers, collapsed: null };
}
