/**
 * Drawing one river: water body, banks, constriction cues, the mandatory dollar
 * annotation on every constriction, the segment label and the disclosure note.
 *
 * Nothing in here computes a quantity. Every number it draws with came out of
 * `layoutScene`, which in turn copied it from Cartographer. The draw pass is deliberately
 * dumb about finance — that is what makes "geometry accuracy is never degraded" checkable
 * by reading one file.
 *
 * The constriction cue comes from `CONSTRICTION_CUES` in `placeholders.ts`, keyed by
 * Cartographer's `kind`, so test record 0002 C4 — the trunk constriction must differ IN
 * KIND from a segment cost, by a cue that is not colour alone — is satisfied by a lookup
 * rather than by a special case buried in a branch. ATELIER-REPLACE the cue's appearance.
 */
import { CONSTRICTION_CUES, TONES, TYPE } from './placeholders';
import {
  fillWith,
  leader,
  line,
  strokeWith,
  text,
  traceBanks,
  type Ctx2D,
} from './draw-primitives';
import type { PlacedConstriction, RiverLane } from './scene';

export interface DrawQuality {
  /** 1 full, 0 off. Currently only gates the bank highlight. ATELIER-REPLACE. */
  readonly effectsQuality: number;
}

/**
 * The constriction marker. `rimCount` carries the segment-cost / trunk-residual
 * distinction as SHAPE, never as colour (Invariant 3.10) and never as length — the rims
 * sit inside the uniform `spanPx` that Cartographer fixed, so the distinction cannot leak
 * into the quantitative channel.
 */
export function drawConstrictionCue(ctx: Ctx2D, c: PlacedConstriction): void {
  const cue = CONSTRICTION_CUES[c.kind];
  const throatX = c.exitX;
  const half = c.widthAfterPx / 2;

  for (let i = 0; i < cue.rimCount; i += 1) {
    const x = throatX - i * cue.rimGapPx;
    line(
      ctx,
      { x, y: c.centreY - half },
      { x, y: c.centreY + half },
      TONES.constrictionRim,
      cue.rimWidthPx,
    );
  }

  if (cue.throatTicks) {
    // Second, independent non-colour cue for the trunk residual: short outward ticks on
    // both banks. Two cues rather than one because 0002 C4 refuses to accept position
    // after the confluence as sufficient — a beginner does not know what that means.
    for (const dir of [-1, 1]) {
      line(
        ctx,
        { x: throatX, y: c.centreY + dir * half },
        { x: throatX, y: c.centreY + dir * (half + 6) },
        TONES.constrictionRim,
        1,
      );
    }
  }
}

/** The mandatory figure (0002 C2) plus the filer's own label for the category. */
export function drawConstrictionAnnotation(ctx: Ctx2D, c: PlacedConstriction): void {
  const a = c.annotation;
  leader(ctx, a.leaderFrom, a.leaderTo, TONES.rule);
  const above = a.anchor.y < c.centreY;
  text(ctx, a.text, a.anchor, {
    font: TYPE.figure,
    tone: TONES.text,
    align: 'center',
    baseline: above ? 'bottom' : 'top',
  });
  text(
    ctx,
    c.label,
    { x: a.anchor.x, y: a.anchor.y + (above ? -13 : 13) },
    { font: TYPE.note, tone: TONES.textDim, align: 'center', baseline: above ? 'bottom' : 'top' },
  );
}

export function drawRiverBody(ctx: Ctx2D, lane: RiverLane, quality: DrawQuality): void {
  traceBanks(ctx, lane.banks);
  fillWith(ctx, TONES.water);
  if (quality.effectsQuality > 0) {
    traceBanks(ctx, lane.banks);
    strokeWith(ctx, TONES.waterEdge, 1);
  }
}

export function drawRiverLabels(ctx: Ctx2D, lane: RiverLane): void {
  const insideHead = lane.headWidthPx >= 34;
  const labelY = insideHead ? lane.headCentreY - 6 : lane.headCentreY - lane.headWidthPx / 2 - 20;
  const at = { x: lane.headX + 10, y: labelY };
  text(ctx, lane.label, at, {
    font: TYPE.label,
    tone: TONES.text,
    align: 'left',
    baseline: 'middle',
  });
  text(
    ctx,
    `${lane.headText} revenue`,
    { x: at.x, y: at.y + 14 },
    { font: TYPE.figure, tone: TONES.text, align: 'left', baseline: 'middle' },
  );
  text(
    ctx,
    lane.disclosureNote,
    { x: at.x, y: at.y + 28 },
    // Full ink, not textDim: this row overlaps the river head at every realistic width,
    // and textDim passes AA on the bed only (Art Director's usage note, 2026-08-21).
    { font: TYPE.note, tone: TONES.text, align: 'left', baseline: 'middle' },
  );

  // Segment operating income, at the mouth. The figure the river's mouth width states.
  text(
    ctx,
    lane.mouthText,
    { x: lane.mouthX - 6, y: lane.headCentreY },
    { font: TYPE.figure, tone: TONES.text, align: 'right', baseline: 'middle' },
  );
}

export function drawRiver(ctx: Ctx2D, lane: RiverLane, quality: DrawQuality): void {
  drawRiverBody(ctx, lane, quality);
  for (const c of lane.constrictions) drawConstrictionCue(ctx, c);
  for (const c of lane.constrictions) drawConstrictionAnnotation(ctx, c);
  drawRiverLabels(ctx, lane);
}
