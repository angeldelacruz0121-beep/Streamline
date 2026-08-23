/**
 * The lake outline.
 *
 * `encoding/lake.ts` states the constraint: "Any closed shape whose enclosed plan area
 * equals planAreaPx2. The outline belongs to Atelier; the area is the quantitative claim
 * and may not be adjusted for composition." So this module does exactly two things —
 * it produces a closed polygon that reads as a body of water rather than as a pie chart
 * (Invariant §5, naturalism through silhouette), and it normalises that polygon so its
 * enclosed area is the target to floating-point exactness.
 *
 * THE SHAPE IS FIXED, ONLY THE SCALE VARIES. `HARMONICS` is a constant set. Every lake
 * Streamline draws is the same outline at a different scale, so the shape itself carries
 * no information and cannot be read as one — the same argument that keeps particle
 * density off the encoding channel. A per-company outline would be an undocumented
 * channel and an Invariant 3.6 breach.
 *
 * The harmonic set is Atelier's, re-homed to `canvas-tokens.ts` on adoption
 * (2026-08-21) with values unchanged. The area normalisation stays here and is not
 * Atelier's to replace.
 */
import { LAKE_HARMONICS as HARMONICS } from '../../design/tokens/canvas-tokens';
import type { Pt } from './scene';

/** Vertex count. A legibility choice, not an encoding one. */
export const OUTLINE_VERTICES = 128;

/** Shoelace area of a closed polygon given as an ordered vertex list. */
export function polygonArea(points: readonly Pt[]): number {
  let twice = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i] as Pt;
    const b = points[(i + 1) % points.length] as Pt;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

/**
 * A closed outline centred on `centre` whose enclosed area is exactly `targetAreaPx2`.
 *
 * Deterministic: same inputs, same vertices, every load. No randomness anywhere, because
 * a lake that changed shape between reloads would be motion nobody documented.
 */
export function lakeOutline(centre: Pt, targetAreaPx2: number, vertices = OUTLINE_VERTICES): Pt[] {
  if (!Number.isFinite(targetAreaPx2) || targetAreaPx2 < 0) {
    throw new RangeError(`Lake area must be finite and non-negative; received ${targetAreaPx2}.`);
  }
  if (targetAreaPx2 === 0) return [];

  const unit: Pt[] = [];
  for (let i = 0; i < vertices; i += 1) {
    const theta = (i / vertices) * Math.PI * 2;
    let r = 1;
    for (const h of HARMONICS) r += h.amp * Math.cos(h.k * theta + h.phase);
    // Squash slightly across the flow axis so it reads as a basin rather than a disc.
    unit.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r * 0.78 });
  }

  // Normalise: the unit outline has some area A; scaling every radius by s scales area by
  // s^2, so s = sqrt(target / A) lands the enclosed area on the target exactly.
  const scale = Math.sqrt(targetAreaPx2 / polygonArea(unit));
  return unit.map((p) => ({ x: centre.x + p.x * scale, y: centre.y + p.y * scale }));
}

/** Axis-aligned bounds of an outline. Used for layout extents and hit-test culling. */
export function outlineBounds(points: readonly Pt[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Even-odd point-in-polygon. Hit testing only; never used to derive a quantity. */
export function pointInPolygon(point: Pt, polygon: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i] as Pt;
    const b = polygon[j] as Pt;
    const straddles = a.y > point.y !== b.y > point.y;
    if (straddles && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}
