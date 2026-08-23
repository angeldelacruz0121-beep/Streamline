/**
 * One frame, in order: ground, water, particles, marks, type.
 *
 * `drawScene` is a pure function of `(Ctx2D, Scene, DrawOptions)`. It holds no state, so
 * a frame can be reproduced exactly from its inputs — which is what lets the geometry
 * invariance test compare two quality levels by replaying draw calls rather than by
 * comparing pixels.
 */
import { drawJunctionSeam } from './draw-junction-seam';
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
   * Draw-time substitution for a scene note's text, keyed by note code. Used only by the
   * reduced-motion path, which must not say "all rivers are drawn at one baseline flow
   * speed" when nothing is moving. It is a draw-time override rather than a layout input
   * so that `Scene` stays identical between the two paths and the geometry-invariance
   * test can compare them by deep equality.
   */
  readonly noteTextOverride: Readonly<Record<string, string>> | null;
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
  text(
    ctx,
    item.statement,
    { x: item.centre.x - half, y: item.centre.y + half + 12 },
    { font: TYPE.note, tone: TONES.text, align: 'left', baseline: 'top' },
  );
  text(
    ctx,
    item.constant,
    { x: item.centre.x - half, y: item.centre.y + half + 26 },
    { font: TYPE.note, tone: TONES.textDim, align: 'left', baseline: 'top' },
  );
}

export function drawNotes(
  ctx: Ctx2D,
  scene: Scene,
  override: Readonly<Record<string, string>> | null = null,
): void {
  for (const note of scene.notes) {
    const value = override === null ? note.text : (override[note.code] ?? note.text);
    text(ctx, value, note.anchor, {
      font: TYPE.note,
      tone: note.code === 'period' ? TONES.text : TONES.textDim,
      align: 'left',
      baseline: 'top',
    });
  }
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
  drawBackground(ctx, scene);
  for (const lane of scene.rivers) drawRiver(ctx, lane, options);
  drawTrunk(ctx, scene.trunk, options);
  drawParticles(ctx, options);
  drawJunctionSeam(ctx, scene);
  drawLegend(ctx, scene);
  drawNotes(ctx, scene, options.noteTextOverride);
  drawHighlight(ctx, scene, options.highlightId);
}
