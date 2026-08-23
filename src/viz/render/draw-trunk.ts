/**
 * Drawing the trunk: the merged flow, its one shared constriction, and the labels that
 * stop that constriction from being read as another operating cost.
 *
 * MISREADING-TESTS §3 names the expensive wrong conclusion — "that is another cost like
 * the others, so operations are less efficient than they look" — and states the defence:
 * `distinctTreatmentRequired`, carried on the geometry, rendered as a cue that is not
 * colour and not length. Here that cue is `rimCount: 2` plus outward throat ticks, both
 * from `CONSTRICTION_CUES`, plus the plain-language label Cartographer took as an input
 * because the final wording is Angel's (0002 C5).
 *
 * The trunk terminus is drawn FINISHED — a squared cap across the departing width. It is
 * not a torn edge and not a dashed stub. Q1 is answered (0017 option 1): the lake is
 * stated separately on principle, so the flow ends here on purpose and the drawing says
 * so. See `draw-junction-seam.ts`.
 */
import { drawConstrictionAnnotation, drawConstrictionCue, type DrawQuality } from './draw-river';
import { fillWith, line, strokeWith, text, traceBanks, type Ctx2D } from './draw-primitives';
import { TONES, TYPE } from './placeholders';
import type { TrunkSection } from './scene';

export function drawTrunkBody(ctx: Ctx2D, trunk: TrunkSection, quality: DrawQuality): void {
  traceBanks(ctx, trunk.banks);
  fillWith(ctx, TONES.water);
  if (quality.effectsQuality > 0) {
    traceBanks(ctx, trunk.banks);
    strokeWith(ctx, TONES.waterEdge, 1);
  }
}

/**
 * A finished end, not a broken one. When the constriction consumes the trunk entirely
 * (`departingWidthPx === 0`) there is no finished end to mark — the closure point where
 * the banks meet IS the terminus and the taper already draws it, so this draws nothing.
 * A zero-length bar would be a mark with no meaning. Approved by Angel 2026-08-21.
 */
export function drawTrunkTerminus(ctx: Ctx2D, trunk: TrunkSection): void {
  if (trunk.departingWidthPx === 0) return;
  const half = trunk.departingWidthPx / 2;
  line(
    ctx,
    { x: trunk.endX, y: trunk.centreY - half },
    { x: trunk.endX, y: trunk.centreY + half },
    TONES.waterEdge,
    1.5,
  );
}

export function drawTrunkLabels(ctx: Ctx2D, trunk: TrunkSection): void {
  const topAt = trunk.centreY - trunk.arrivingWidthPx / 2;
  text(
    ctx,
    'All segments combined',
    { x: trunk.startX + 6, y: topAt - 20 },
    { font: TYPE.label, tone: TONES.text, align: 'left', baseline: 'bottom' },
  );
  text(
    ctx,
    `${trunk.arrivingText} segment operating income`,
    { x: trunk.startX + 6, y: topAt - 7 },
    { font: TYPE.figure, tone: TONES.text, align: 'left', baseline: 'bottom' },
  );
  text(
    ctx,
    trunk.departingText,
    { x: trunk.endX - 6, y: trunk.centreY },
    { font: TYPE.figure, tone: TONES.text, align: 'right', baseline: 'middle' },
  );
  if (!trunk.itemizationProvided) {
    text(
      ctx,
      'Residual itemisation not supplied',
      { x: trunk.constriction.enterX, y: trunk.centreY + trunk.arrivingWidthPx / 2 + 16 },
      { font: TYPE.note, tone: TONES.textDim, align: 'center', baseline: 'top' },
    );
  }
}

export function drawTrunk(ctx: Ctx2D, trunk: TrunkSection, quality: DrawQuality): void {
  drawTrunkBody(ctx, trunk, quality);
  drawConstrictionCue(ctx, trunk.constriction);
  drawTrunkTerminus(ctx, trunk);
  drawConstrictionAnnotation(ctx, trunk.constriction);
  drawTrunkLabels(ctx, trunk);
}
