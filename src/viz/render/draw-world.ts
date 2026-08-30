/**
 * The world's painter (decision 0038). Draws UNDER everything data-bearing:
 * `drawScene` calls this first, so terrain, sky, hills and mist can never sit over a
 * river, a figure, or a refusal surface.
 *
 * THE RE-TRACE LAW: everything gated by `effectsQuality` here re-traces coordinates
 * already emitted unconditionally in the same frame, so the geometry-invariance suite
 * sees an identical coordinate set at every quality rung. Mist is UNCONDITIONAL for the
 * same reason — its rectangles are part of the invariant picture, not an effect.
 *
 * Gradients are memoized by extent (the 0037 lesson — fresh gradient objects per frame
 * cost a 33ms outlier frame and a heap creep before they were cached).
 */
import { WORLD, WORLD_TONES, css } from './placeholders';
import { tracePolygon, type Ctx2D } from './draw-primitives';
import type { DrawQuality } from './draw-river';
import type { WorldModel } from './world';

const skyGradients = new Map<string, CanvasGradient>();

function skyFill(ctx: Ctx2D, horizonY: number): CanvasGradient {
  const key = `0|${horizonY}`;
  let gradient = skyGradients.get(key);
  if (gradient === undefined) {
    if (skyGradients.size > 16) skyGradients.clear();
    gradient = ctx.createLinearGradient(0, 0, 0, horizonY);
    gradient.addColorStop(0, css(WORLD_TONES.skyZenith));
    gradient.addColorStop(0.55, css(WORLD_TONES.skyMid));
    gradient.addColorStop(1, css(WORLD_TONES.skyGlow));
    skyGradients.set(key, gradient);
  }
  return gradient;
}

export function drawWorld(ctx: Ctx2D, world: WorldModel, quality: DrawQuality): void {
  // Terrain first, past the content's right edge (overscan), so a canvas wider
  // than the content never shows bare backing store beside the world.
  const paintWidth = world.widthPx + WORLD.overscanPx;
  ctx.fillStyle = css(WORLD_TONES.terrainBase);
  ctx.fillRect(0, 0, paintWidth, world.heightPx);

  // The sky band, fenced above the horizon. No text ever sits here.
  ctx.fillStyle = skyFill(ctx, world.horizonY);
  ctx.fillRect(0, 0, paintWidth, world.horizonY);

  // Hill silhouettes, far then near.
  tracePolygon(ctx, world.ridgeFar);
  ctx.fillStyle = css(WORLD_TONES.hillFar);
  ctx.fill();
  tracePolygon(ctx, world.ridgeNear);
  ctx.fillStyle = css(WORLD_TONES.hillNear);
  ctx.fill();

  // Mist: unconditional, so the coordinate set is identical at every rung.
  for (const band of world.mist) {
    ctx.fillStyle = css(band.dense ? WORLD_TONES.mistDense : WORLD_TONES.mistSoft);
    ctx.fillRect(band.x, band.y, band.widthPx, band.heightPx);
  }

  // Effects rung: a hairline crest on the near ridge — a RE-TRACE of coordinates
  // already emitted above, per the re-trace law.
  if (quality.effectsQuality > 0) {
    tracePolygon(ctx, world.ridgeNear);
    ctx.strokeStyle = css(WORLD_TONES.terrainShade);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
