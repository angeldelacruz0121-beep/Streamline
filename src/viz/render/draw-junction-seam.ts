/**
 * The river-to-lake junction, and the lake itself.
 *
 * Q1 IS ANSWERED. Decision 0017, option 1: the lake is a labelled readout, spatially
 * separated from the trunk, and the conservation read is never invited. This file renders
 * that decision as a STANCE, not as a gap.
 *
 * The difference matters on screen and it is the whole reason this module exists
 * separately. A pending junction would look like a broken pipe — a dangling connector, a
 * dashed stub, a "geometry TBD" note. None of that is drawn here and a test asserts it.
 * What is drawn is a panel divider: a full-height rule, the visual grammar of "these two
 * things are measured in different units and are not continuous", plus a caption that
 * says so in words. River width is dollars per pixel; lake area is dollars per square
 * pixel; the two do not convert. Refusing the comparison is the considered answer, and
 * the picture should look like someone decided that.
 *
 * `UNRESOLVED_JUNCTION` still travels on the model, carried through onto `Scene`, as the
 * record of WHY. `junction.test.ts` checks that none of the three closures it forbids has
 * been taken: no placement derived from the ratio of the two constants, no lake diameter
 * composed against the trunk, no lake mouth set to the trunk width. There is no lake
 * mouth at all.
 */
import {
  fillWith,
  line,
  strokeWith,
  text,
  tracePolygon,
  waterFill,
  type Ctx2D,
} from './draw-primitives';
import { css, TONES, TYPE, WORLD, WORLD_TONES } from './placeholders';
import type { LakeRegion, Pt, Scene } from './scene';

/**
 * Greedy word wrap. Uses the context's own metrics, so it is font-accurate.
 *
 * No longer called on the draw path — the one caption that needed wrapping moved to the
 * DOM, where the browser wraps. Kept because it is the only text measurement this layer
 * has, it is directly tested, and the vertical re-orientation (0033) will want it back.
 */
export function wrapText(ctx: Ctx2D, value: string, maxWidthPx: number): string[] {
  const words = value.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (ctx.measureText(candidate).width > maxWidthPx && current !== '') {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

/**
 * The separation. A vertical rule and a caption — nothing crosses it.
 *
 * The rule is vertical, i.e. constant in x, which is what stops it being read as flow:
 * every flow on this canvas runs along x, so a mark that has no extent along x cannot be
 * mistaken for one. The gap it sits in is `JUNCTION_SEPARATION_PX`, a constant that
 * varies with no quantity.
 */
export function drawSeparation(ctx: Ctx2D, scene: Scene): void {
  const x = (scene.separation.trunkTerminusX + scene.separation.lakeRegionX) / 2;
  const top = 8;
  const bottom = scene.contentHeightPx - 8;
  line(ctx, { x, y: top }, { x, y: bottom }, TONES.rule, 1);

  // The caption that used to wrap across the top of the lake region now reads in the DOM
  // margin. What it explains has not changed and neither has the decision: the rule above
  // IS the statement, and it is the half of it that belongs in the picture. Three lines of
  // prose printed over the lake region were the half that did not — they landed on the same
  // pixels as the lake readout at narrow viewports. `scene.separation.note` still carries
  // the sentences; `CanvasMargin` renders them verbatim.
}

/** Diagonal hatch inside a clipped region. The dry-floor sign cue for a drained basin. */
function hatch(ctx: Ctx2D, bounds: { x: number; y: number; w: number; h: number }): void {
  const step = 8;
  ctx.strokeStyle = css(TONES.basinHatch);
  ctx.lineWidth = 1;
  for (let offset = -bounds.h; offset < bounds.w; offset += step) {
    ctx.beginPath();
    ctx.moveTo(bounds.x + offset, bounds.y + bounds.h);
    ctx.lineTo(bounds.x + offset + bounds.h, bounds.y);
    ctx.stroke();
  }
}

export function drawLake(ctx: Ctx2D, region: LakeRegion): void {
  const lake = region.lake;
  if (lake.outline.length > 0) {
    if (lake.waterBody === 'drained-basin') {
      // 3.4: rivers still flow in and are still consumed; the loss is a void revenue
      // failed to fill. Dry floor, then hatch, then a doubled rim. Sign is carried by
      // these cues and by the label — never by colour (3.10) and never by size, since
      // 0006 gives a −$10B basin the same footprint as a +$10B lake.
      tracePolygon(ctx, lake.outline);
      fillWith(ctx, TONES.basinFloor);
      ctx.save();
      tracePolygon(ctx, lake.outline);
      ctx.clip();
      hatch(ctx, {
        x: region.x,
        y: region.y,
        w: region.widthPx,
        h: region.heightPx,
      });
      ctx.restore();
      tracePolygon(ctx, lake.outline);
      strokeWith(ctx, TONES.lakeEdge, 2);
      tracePolygon(ctx, lake.outline);
      strokeWith(ctx, TONES.rule, 4);
    } else {
      // The lake shares the flows' depth treatment (0037): sheen at the shore,
      // body tone at the middle, across the region's own vertical extent.
      tracePolygon(ctx, lake.outline);
      waterFill(ctx, region.y, region.y + region.heightPx);
      tracePolygon(ctx, lake.outline);
      strokeWith(ctx, WORLD_TONES.waterGlowOuter, WORLD.waterGlowWidthPx);
      tracePolygon(ctx, lake.outline);
      strokeWith(ctx, TONES.lakeEdge, 1);
    }
  }

  // 0001 C2. Persistent text, exact figure, tabular numerals. Not a hover reveal, and
  // never abbreviated — the analyst's path to this number does not route through area.
  text(ctx, lake.readoutText, lake.readoutAnchor, {
    font: TYPE.figure,
    tone: TONES.text,
    align: 'center',
    baseline: 'bottom',
  });
  // 0001 C3 and 0006. The period, on the water itself, on a filled lake exactly as on a
  // drained basin — a body of water with no period invites the balance-sheet read.
  const kindWord =
    lake.waterBody === 'drained-basin'
      ? 'net loss'
      : lake.waterBody === 'dry'
        ? 'break-even'
        : 'net earnings';
  // Full ink, not textDim: this label sits on the water body, where textDim composites
  // below AA (Art Director's usage note on adoption, 2026-08-21 — bed and plates only).
  text(ctx, `${lake.periodLabel} ${kindWord}`, lake.periodAnchor, {
    font: TYPE.note,
    tone: TONES.text,
    align: 'center',
    baseline: 'bottom',
  });

  if (lake.depthGauge !== null) {
    // Redundant channel only (0006). Plan area carries the magnitude; this reinforces the
    // number. Never a volumetric cue — K13, because volume grows as the square.
    line(ctx, lake.depthGauge.from, lake.depthGauge.to, TONES.rule, 1);
    for (const end of [lake.depthGauge.from, lake.depthGauge.to] as Pt[]) {
      line(ctx, { x: end.x - 4, y: end.y }, { x: end.x + 4, y: end.y }, TONES.rule, 1);
    }
    // The gauge itself stays; its caption reads on hover. The mark is the redundant
    // channel 0006 asks for — the sentence describing the mark is not, and it was the
    // longest string on the basin side.
  }
}

export function drawJunctionSeam(ctx: Ctx2D, scene: Scene): void {
  drawSeparation(ctx, scene);
  drawLake(ctx, scene.lakeRegion);
}
