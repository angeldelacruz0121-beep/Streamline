/**
 * One frame, in order: ground, water, particles, marks, type.
 *
 * `Scene.notes` is NOT drawn here. Those sentences read in the DOM margin beside the
 * canvas, where they are selectable, screen-readable and out of the picture's way. The
 * scene still carries them — `modelNotes` in `layout.ts` is their source, and
 * `Scene.notes` is unchanged — so nothing downstream lost access to them.
 *
 * `drawScene` is a pure function of `(Ctx2D, Scene, DrawOptions)`. It holds no state, so
 * a frame can be reproduced exactly from its inputs — which is what lets the geometry
 * invariance test compare two quality levels by replaying draw calls rather than by
 * comparing pixels.
 */
import { drawJunctionSeam } from './draw-junction-seam';
import { drawWorld } from './draw-world';
import { worldFor } from './world';
import { fillWith, line, strokeWith, text, tracePolygon, type Ctx2D } from './draw-primitives';
import { drawRiver, type DrawQuality } from './draw-river';
import { drawTrunk } from './draw-trunk';
import { TONES, TYPE, css } from './placeholders';
import type { LegendItem, Scene } from './scene';

export interface DrawOptions extends DrawQuality {
  /** Particle positions, written by `ParticleSystem.writePositions`. */
  readonly particleX: Float32Array;
  readonly particleY: Float32Array;
  readonly particleCount: number;
  /** Element id under the pointer, or null. Drawn as an outline, never as a hue. */
  readonly highlightId: string | null;
  /**
   * Seed text for the world's scenery (decision 0038) — the filer's CIK string,
   * plumbed from the surface. IDENTITY ONLY, never a financial value; the same
   * company gets the same hills forever. Absent (tests, harness) the world still
   * draws, deterministically, under the default seed.
   */
  readonly worldSeed?: string;
}

export const NO_PARTICLES: Pick<DrawOptions, 'particleX' | 'particleY' | 'particleCount'> = {
  particleX: new Float32Array(0),
  particleY: new Float32Array(0),
  particleCount: 0,
};

export function drawBackground(ctx: Ctx2D, scene: Scene): void {
  ctx.fillStyle = css(TONES.canvas);
  ctx.fillRect(0, 0, scene.contentWidthPx, scene.contentHeightPx);
}

/**
 * Particles as 1px squares rather than arcs. `fillRect` on a 1px box is materially
 * cheaper than `arc` + `fill` per particle in Canvas 2D, and at one pixel the two are
 * visually indistinguishable. This is the single largest cost in the frame at the
 * reference load; see `CANVAS-VS-WEBGL.md`.
 */
export function drawParticles(ctx: Ctx2D, options: DrawOptions): void {
  if (options.particleCount === 0) return;
  ctx.fillStyle = css(TONES.particle);
  const { particleX, particleY } = options;
  for (let i = 0; i < options.particleCount; i += 1) {
    ctx.fillRect(particleX[i] as number, particleY[i] as number, 1.2, 1.2);
  }
}

export function drawLegend(ctx: Ctx2D, scene: Scene): void {
  for (const item of scene.legend) drawLegendItem(ctx, item);
}

function drawLegendItem(ctx: Ctx2D, item: LegendItem): void {
  if (item.kind === 'reference-bar') {
    // A length read against a length. Correct for the width channel, and correct only
    // for the width channel — 0001 C6.
    ctx.fillStyle = css(TONES.waterEdge);
    ctx.fillRect(item.centre.x - item.lengthPx / 2, item.centre.y - 3, item.lengthPx, 6);
  } else {
    // A reference DISC, not a bar. An area cannot be read against a length (0001 C6).
    ctx.beginPath();
    ctx.arc(item.centre.x, item.centre.y, item.radiusPx, 0, Math.PI * 2);
    fillWith(ctx, TONES.lakeFill);
    ctx.beginPath();
    ctx.arc(item.centre.x, item.centre.y, item.radiusPx, 0, Math.PI * 2);
    strokeWith(ctx, TONES.lakeEdge, 1);
  }
  const half = item.kind === 'reference-bar' ? item.lengthPx / 2 : item.radiusPx;
  // Invariant 3.3 requires the scale to state itself, and the statement is what does that:
  // "a river this wide carries $X a year" is readable by someone who has never seen a
  // px/$ constant. The constant itself is reference material for the analyst and reads in
  // the margin, where it does not sit under the legend competing with the notes stack.
  text(
    ctx,
    item.statement,
    { x: item.centre.x - half, y: item.centre.y + half + 12 },
    { font: TYPE.note, tone: TONES.text, align: 'left', baseline: 'top' },
  );
}

/**
 * Hover feedback drawn on the canvas. This is the SECOND acknowledgement of a pointer,
 * not the first: `renderer.ts` commits an overlay synchronously in the event handler so
 * that interaction latency is never gated behind the frame (Invariant 4.1). By the time
 * this runs the user has already been answered.
 */
export function drawHighlight(ctx: Ctx2D, scene: Scene, id: string | null): void {
  if (id === null) return;
  for (const lane of scene.rivers) {
    if (lane.id === id) {
      tracePolygon(ctx, [...lane.banks.top, ...[...lane.banks.bottom].reverse()]);
      strokeWith(ctx, TONES.text, 1.5);
      return;
    }
    for (const c of lane.constrictions) {
      if (c.id === id) {
        line(
          ctx,
          { x: c.exitX, y: c.centreY - c.widthAfterPx / 2 - 4 },
          { x: c.exitX, y: c.centreY + c.widthAfterPx / 2 + 4 },
          TONES.text,
          2,
        );
        return;
      }
    }
  }
  if (scene.trunk.constriction.id === id) {
    const c = scene.trunk.constriction;
    line(
      ctx,
      { x: c.exitX, y: c.centreY - c.widthBeforePx / 2 - 4 },
      { x: c.exitX, y: c.centreY + c.widthBeforePx / 2 + 4 },
      TONES.text,
      2,
    );
    return;
  }
  if (id === 'lake') {
    tracePolygon(ctx, scene.lakeRegion.lake.outline);
    strokeWith(ctx, TONES.text, 1.5);
  }
}

export function drawScene(ctx: Ctx2D, scene: Scene, options: DrawOptions): void {
  // The world underlies everything data-bearing (0038). `drawBackground` survives as
  // the world-free ground for surfaces that must render with NO world painted — the
  // refusal arms compose no Scene, so they never reach here at all.
  drawWorld(ctx, worldFor(scene, options.worldSeed ?? 'no-company'), options);
  for (const lane of scene.rivers) drawRiver(ctx, lane, options);
  drawTrunk(ctx, scene.trunk, options);
  drawParticles(ctx, options);
  drawJunctionSeam(ctx, scene);
  drawLegend(ctx, scene);
  drawHighlight(ctx, scene, options.highlightId);
}
