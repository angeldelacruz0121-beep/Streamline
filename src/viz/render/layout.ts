/**
 * `CanvasModel` -> `Scene`. Positions, and nothing but positions.
 *
 * WHAT THIS FUNCTION IS FORBIDDEN TO DO, and each refusal is asserted by test:
 *
 *   1. Change a width. Every `widthPx` in the output is copied through from
 *      Cartographer. There is no multiplier, no fit-to-viewport scale, no rounding of a
 *      quantitative dimension. A filer that does not fit produces an overflow report and
 *      a pan, because `scales/legibility.ts` is explicit that a fit multiplier is
 *      per-company rescaling and Invariant 3.1 forbids it.
 *
 *   2. Take a quality level as input. It is not a parameter. That is what makes
 *      "geometry accuracy is never degraded" (Invariant 4.1) structural.
 *
 *   3. Bridge the junction. Q1 is answered as 0017 option 1 — the lake is a labelled
 *      readout, separated on principle. The gap is a constant that varies with nothing,
 *      no connector is emitted, and none of the three closures in
 *      `UNRESOLVED_JUNCTION.forbidden` is taken.
 *
 * Length along the flow axis is the one dimension Forge is free with, and
 * `encoding/types.ts` grants it in as many words: "A river's length, its centreline and
 * its silhouette encode nothing and are Forge's and Atelier's." The one exception it
 * carves out — uniform `CONSTRICTION_SPAN_PX` for every constriction including the
 * trunk's — is honoured by copying `spanPx` through rather than computing one.
 */
import type { CanvasModel, ConstrictionGeometry, RiverGeometry, WidthStation } from '../encoding';
import { formatUsdScaled } from './format';
import { COPY, JUNCTION_SEPARATION_PX, SPACING } from './placeholders';
import { lakeOutline, outlineBounds } from './silhouette';
import type {
  Banks,
  JunctionSeparation,
  LakeBody,
  LakeRegion,
  LegendItem,
  PlacedAnnotation,
  PlacedConstriction,
  PlacedStation,
  Pt,
  RiverLane,
  Scene,
  SceneNote,
  TrunkSection,
  Viewport,
} from './scene';

/** Smoothstep. Used for centreline easing only; never applied to a width at a station. */
function ease(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Samples per interpolated run when building bank polylines. Legibility, not encoding. */
const SAMPLES_PER_RUN = 12;

interface Run {
  readonly fromX: number;
  readonly toX: number;
  readonly fromWidth: number;
  readonly toWidth: number;
  /** True for a constriction throat: the banks close in over the uniform span. */
  readonly taper: boolean;
}

/**
 * Trapezoidal plan area of a run sequence. Used only to budget particles at a uniform
 * areal density; it is never presented and never compared to the 3.3 area constant.
 */
function runsArea(runs: readonly Run[]): number {
  let area = 0;
  for (const run of runs) {
    area += ((run.fromWidth + run.toWidth) / 2) * (run.toX - run.fromX);
  }
  return area;
}

function buildBanks(runs: readonly Run[], centreYAt: (x: number) => number): Banks {
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  for (const run of runs) {
    const steps = run.fromWidth === run.toWidth ? 1 : SAMPLES_PER_RUN;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = run.fromX + (run.toX - run.fromX) * t;
      // A taper eases; a straight run is linear. Neither changes the width AT a station,
      // which is where the quantitative claim lives.
      const w = run.fromWidth + (run.toWidth - run.fromWidth) * (run.taper ? ease(t) : t);
      const cy = centreYAt(x);
      const last = top[top.length - 1];
      if (last !== undefined && last.x === x) continue;
      top.push({ x, y: cy - w / 2 });
      bottom.push({ x, y: cy + w / 2 });
    }
  }
  return { top, bottom };
}

function annotate(
  constriction: ConstrictionGeometry,
  throatX: number,
  centreY: number,
  widthAtThroat: number,
  above: boolean,
): PlacedAnnotation {
  const edgeY = centreY + (above ? -1 : 1) * (widthAtThroat / 2);
  const anchorY = edgeY + (above ? -1 : 1) * SPACING.annotationOffsetPx;
  return {
    valueUsd: constriction.annotation.valueUsd,
    text: formatUsdScaled(constriction.annotation.valueUsd),
    anchor: { x: throatX, y: anchorY },
    leaderFrom: { x: throatX, y: anchorY + (above ? 3 : -3) },
    leaderTo: { x: throatX, y: edgeY },
  };
}

function layoutRiver(
  river: RiverGeometry,
  headX: number,
  laneLengthPx: number,
  headCentreY: number,
  mouthCentreY: number,
  confluenceEndX: number,
): RiverLane {
  const n = river.constrictions.length;
  const mouthX = headX + laneLengthPx;
  const spanTotal = river.constrictions.reduce((sum, c) => sum + c.spanPx, 0);
  const free = laneLengthPx - SPACING.headRunPx - SPACING.mouthRunPx - spanTotal;
  const gap = free / (n + 1);

  const runs: Run[] = [];
  const stations: PlacedStation[] = [];
  const placed: PlacedConstriction[] = [];

  let x = headX;
  let w = river.headWidthPx;
  stations.push({ id: `${river.id}/head`, kind: 'head', x, centreY: headCentreY, widthPx: w });

  const headRunEnd = x + SPACING.headRunPx;
  runs.push({ fromX: x, toX: headRunEnd, fromWidth: w, toWidth: w, taper: false });
  x = headRunEnd;

  river.constrictions.forEach((c, index) => {
    const enterX = x + gap;
    const exitX = enterX + c.spanPx;
    runs.push({ fromX: x, toX: enterX, fromWidth: w, toWidth: w, taper: false });
    runs.push({
      fromX: enterX,
      toX: exitX,
      fromWidth: c.widthBeforePx,
      toWidth: c.widthAfterPx,
      taper: true,
    });
    stations.push({
      id: `${river.id}/${c.id}/enter`,
      kind: 'constriction-enter',
      x: enterX,
      centreY: headCentreY,
      widthPx: c.widthBeforePx,
    });
    stations.push({
      id: `${river.id}/${c.id}/exit`,
      kind: 'constriction-exit',
      x: exitX,
      centreY: headCentreY,
      widthPx: c.widthAfterPx,
    });
    placed.push({
      id: c.id,
      label: c.label,
      kind: c.kind,
      enterX,
      exitX,
      centreY: headCentreY,
      widthBeforePx: c.widthBeforePx,
      widthAfterPx: c.widthAfterPx,
      removedWidthPx: c.removedWidthPx,
      spanPx: c.spanPx,
      // Alternate sides so two constrictions on one lane cannot overlap their figures.
      annotation: annotate(
        c,
        (enterX + exitX) / 2,
        headCentreY,
        (c.widthBeforePx + c.widthAfterPx) / 2,
        index % 2 === 0,
      ),
      overdraw: c.overdraw,
      distinctTreatmentRequired: c.distinctTreatmentRequired,
    });
    x = exitX;
    w = c.widthAfterPx;
  });

  runs.push({ fromX: x, toX: mouthX, fromWidth: w, toWidth: river.mouthWidthPx, taper: false });
  stations.push({
    id: `${river.id}/mouth`,
    kind: 'mouth',
    x: mouthX,
    centreY: headCentreY,
    widthPx: river.mouthWidthPx,
  });

  // The confluence tail: the centreline eases from the lane's spread position to its
  // packed position at the trunk. WIDTH IS HELD CONSTANT through it — a river may not
  // narrow or widen because of where it is being drawn.
  runs.push({
    fromX: mouthX,
    toX: confluenceEndX,
    fromWidth: river.mouthWidthPx,
    toWidth: river.mouthWidthPx,
    taper: false,
  });

  const centreYAt = (px: number): number => {
    if (px <= mouthX) return headCentreY;
    const t = ease((px - mouthX) / Math.max(1e-9, confluenceEndX - mouthX));
    return headCentreY + (mouthCentreY - headCentreY) * t;
  };

  return {
    id: river.id,
    label: river.label,
    aggregated: river.aggregated,
    headX,
    mouthX,
    headCentreY,
    mouthCentreY,
    headWidthPx: river.headWidthPx,
    mouthWidthPx: river.mouthWidthPx,
    revenueUsd: river.revenueUsd,
    operatingIncomeUsd: river.operatingIncomeUsd,
    headText: formatUsdScaled(river.revenueUsd),
    mouthText: formatUsdScaled(river.operatingIncomeUsd),
    stations,
    banks: buildBanks(runs, centreYAt),
    constrictions: placed,
    disclosureNote: disclosureNoteFor(river),
    surfacePx2: runsArea(runs),
  };
}

function requiredLaneLength(rivers: readonly RiverGeometry[]): number {
  let longest = 0;
  for (const river of rivers) {
    const spanTotal = river.constrictions.reduce((sum, c) => sum + c.spanPx, 0);
    const length =
      SPACING.headRunPx +
      spanTotal +
      (river.constrictions.length + 1) * SPACING.betweenConstrictionsPx +
      SPACING.mouthRunPx;
    if (length > longest) longest = length;
  }
  return longest === 0 ? SPACING.headRunPx + SPACING.mouthRunPx : longest;
}

function layoutTrunk(model: CanvasModel, startX: number, centreY: number): TrunkSection {
  const c = model.trunk.constriction;
  const enterX = startX + SPACING.trunkHeadRunPx;
  const exitX = enterX + c.spanPx;
  // Approved by Angel 2026-08-21: a trunk consumed at its constriction ends AT the
  // closure point. The taper already brings both banks to the centreline at `exitX`;
  // a tail run past it would be length with no dollars behind it, so the tail
  // collapses to zero and the departing station coincides with the constriction exit.
  const terminates = model.trunk.departingWidthPx === 0;
  const endX = terminates ? exitX : exitX + SPACING.trunkTailRunPx;
  const xs = [startX, enterX, exitX, endX];

  const runs: Run[] = [
    {
      fromX: startX,
      toX: enterX,
      fromWidth: model.trunk.arrivingWidthPx,
      toWidth: model.trunk.arrivingWidthPx,
      taper: false,
    },
    { fromX: enterX, toX: exitX, fromWidth: c.widthBeforePx, toWidth: c.widthAfterPx, taper: true },
  ];
  if (!terminates) {
    runs.push({
      fromX: exitX,
      toX: endX,
      fromWidth: model.trunk.departingWidthPx,
      toWidth: model.trunk.departingWidthPx,
      taper: false,
    });
  }

  const stations: PlacedStation[] = model.trunk.stations.map(
    (station: WidthStation, index): PlacedStation => ({
      id: station.id,
      kind: station.kind,
      x: xs[index] ?? endX,
      centreY,
      widthPx: station.widthPx,
    }),
  );

  return {
    startX,
    endX,
    centreY,
    arrivingWidthPx: model.trunk.arrivingWidthPx,
    departingWidthPx: model.trunk.departingWidthPx,
    arrivingUsd: model.trunk.arrivingUsd,
    departingUsd: model.trunk.departingUsd,
    arrivingText: formatUsdScaled(model.trunk.arrivingUsd),
    departingText: formatUsdScaled(model.trunk.departingUsd),
    stations,
    banks: buildBanks(runs, () => centreY),
    constriction: {
      id: c.id,
      label: c.label,
      kind: c.kind,
      enterX,
      exitX,
      centreY,
      widthBeforePx: c.widthBeforePx,
      widthAfterPx: c.widthAfterPx,
      removedWidthPx: c.removedWidthPx,
      spanPx: c.spanPx,
      // BELOW the trunk, and that is structural rather than aesthetic. The trunk states its
      // own name and arriving figure above its top bank (`drawTrunkLabels`), so an annotation
      // placed above lands in an occupied band every time — the figure at `topAt - 12` and
      // its label at `topAt - 25`, interleaved with captions at `topAt - 20` and `topAt - 7`.
      // Nothing below the trunk competes. Same reasoning as the `index % 2` alternation on a
      // river: a fixed structural choice, decided once, not a measured one.
      annotation: annotate(c, (enterX + exitX) / 2, centreY, c.widthBeforePx, false),
      overdraw: c.overdraw,
      distinctTreatmentRequired: c.distinctTreatmentRequired,
    },
    surfacePx2: runsArea(runs),
    itemizationProvided: model.trunk.itemization.provided,
  };
}

function layoutLake(model: CanvasModel, regionX: number, shorelineY: number): LakeRegion {
  const lake = model.lake;
  // Sized from `planAreaPx2` and from nothing else — not from the trunk width, not from
  // the ratio of the two scale constants, and with no mouth. All three entries of
  // `UNRESOLVED_JUNCTION.forbidden`, refused structurally rather than by comment.
  const probe = lakeOutline({ x: 0, y: 0 }, Math.max(lake.planAreaPx2, 1));
  const probeBounds = outlineBounds(probe);
  const halfW = (probeBounds.maxX - probeBounds.minX) / 2;
  const halfH = (probeBounds.maxY - probeBounds.minY) / 2;
  const centre: Pt = { x: regionX + halfW, y: shorelineY };
  const outline = lake.planAreaPx2 === 0 ? [] : lakeOutline(centre, lake.planAreaPx2);

  const body: LakeBody = {
    waterBody: lake.waterBody,
    centre,
    outline,
    planAreaPx2: lake.planAreaPx2,
    equivalentDiscRadiusPx: lake.equivalentDiscRadiusPx,
    depthBelowShorelinePx: lake.depthBelowShorelinePx,
    signCues: lake.signCues,
    netEarningsUsd: lake.netEarningsUsd,
    // 0001 C2 holds unchanged. The figure is still persistent text in tabular numerals and
    // it is still EXACT — `$133,749M` and `$133.749B` are the same number, and the scaled
    // form is the one a reader can take in without arithmetic. Nothing here is rounded, so
    // the objection `kill-list.md` records against `$133,700M` does not apply.
    readoutText: formatUsdScaled(lake.netEarningsReadout.usd),
    readoutAnchor: { x: centre.x, y: centre.y - halfH - 30 },
    periodLabel: lake.fiscalPeriodLabel,
    periodAnchor: { x: centre.x, y: centre.y - halfH - 13 },
    depthGauge:
      lake.depthBelowShorelinePx > 0
        ? {
            from: { x: centre.x + halfW + 24, y: shorelineY },
            to: { x: centre.x + halfW + 24, y: shorelineY + lake.depthBelowShorelinePx },
            text: `${lake.depthBelowShorelinePx.toFixed(1)}px below grade — redundant channel`,
          }
        : null,
  };

  return { x: regionX, y: shorelineY - halfH, widthPx: halfW * 2, heightPx: halfH * 2, lake: body };
}

/**
 * Invariant 3.2 / 3.8's labelling duty, as one sentence per river.
 *
 * Still carried on `RiverLane.disclosureNote` so nothing downstream lost it, and now also
 * read out by `marginContent` for the DOM plate that renders it. One function so the two
 * cannot drift apart.
 */
function disclosureNoteFor(river: RiverGeometry): string {
  return river.aggregated
    ? `${river.label}. Combined across segments, not filer-shaped.`
    : COPY.disclosure(river.disclosure.costCategoriesDisclosed);
}

/** Everything the DOM margin renders. Strings only, and every one of them already existed. */
export interface MarginContent {
  readonly scales: readonly { readonly id: string; readonly constant: string }[];
  readonly disclosures: readonly {
    readonly id: string;
    readonly label: string;
    readonly note: string;
  }[];
  readonly separation: string;
  readonly notes: readonly ModelNote[];
}

/**
 * The prose that used to be painted on the canvas, gathered for the margin plate.
 *
 * Viewport-free and pure, so it is safe to call from React on every render, and it carries
 * no financial object — `canvas-adapter.ts` stripped provenance long before `CanvasModel`
 * reached here, which is Invariant 4.3 holding by construction rather than by promise.
 *
 * The `overflow` note is deliberately absent: it is the one note that depends on the
 * viewport, it lives on `Scene`, and the scroll bar already says the same thing.
 */
export function marginContent(model: CanvasModel): MarginContent {
  return {
    scales: model.scales.map((scale) => ({ id: scale.id, constant: scale.constant })),
    disclosures: model.rivers.map((river) => ({
      id: river.id,
      label: river.label,
      note: disclosureNoteFor(river),
    })),
    separation: COPY.separationRule,
    notes: modelNotes(model),
  };
}

/** A note before it has a position. The text is the model's; the anchor is the scene's. */
export interface ModelNote {
  readonly code: string;
  readonly text: string;
}

/**
 * Every note the model itself justifies, in order, with no viewport in the argument list.
 *
 * Split out of `layoutScene` because these sentences are no longer painted on the canvas —
 * they read in the DOM margin beside it, where they are selectable and screen-readable. The
 * canvas keeps the figures; the prose keeps the reader. `layoutScene` still anchors exactly
 * this list and still appends the one viewport-dependent note (`overflow`), so `Scene.notes`
 * is unchanged and `layout.test.ts` holds as written.
 *
 * Pure, and deliberately so: `CanvasModel` has already had provenance stripped by
 * `canvas-adapter.ts`, so handing this result to React carries no financial object across
 * the boundary Invariant 4.3 draws.
 */
export function modelNotes(model: CanvasModel): readonly ModelNote[] {
  const notes: ModelNote[] = [];
  const push = (code: string, text: string): void => {
    notes.push({ code, text });
  };

  push('period', model.fiscalPeriodLabel);
  // Invariant 3.5: a flow with no prior-period comparison renders at baseline speed and
  // is labelled as such. Nothing here varies with growth; D9 is open and excluded.
  push('baseline-flow', COPY.baselineFlow);
  if (model.rivers.filter((r) => !r.aggregated).length === 1) {
    push('single-segment', 'This filer reports a single revenue segment. Invariant 3.8.');
  }
  if (model.collapsed !== null) {
    push(
      'collapsed',
      `${COPY.moreControl(model.collapsed.count)}. Hidden segments still flow into the lake.`,
    );
  }
  if (!model.trunk.itemization.provided) {
    push('itemization-missing', 'Trunk residual itemisation not supplied by the data layer.');
  }
  for (const finding of model.legibility.findings) {
    push(`legibility/${finding.code}`, finding.message);
  }

  return notes;
}

export function layoutScene(model: CanvasModel, viewport: Viewport): Scene {
  const headExtent =
    model.rivers.reduce((sum, r) => sum + r.headWidthPx, 0) +
    Math.max(0, model.rivers.length - 1) * SPACING.laneGapPx;

  const laneLength = requiredLaneLength(model.rivers);
  const headX = SPACING.marginPx;
  const mouthX = headX + laneLength;
  const trunkStartX = mouthX + SPACING.confluenceRunPx;

  // Two probe passes: the flow-axis extents do not depend on the cross-axis centre, so
  // the trunk and lake are laid out once at y = 0 purely to learn how tall the band and
  // how wide the content must be, then laid out for real. No quantity is touched twice.
  const probeTrunk = layoutTrunk(model, trunkStartX, 0);
  const lakeRegionX = probeTrunk.endX + JUNCTION_SEPARATION_PX;
  const probeLake = layoutLake(model, lakeRegionX, 0);

  const bandHeight = Math.max(
    headExtent,
    model.trunk.arrivingWidthPx,
    probeLake.heightPx + 64,
    120,
  );
  // Decision 0038: the world's sky band sits above the content; all content shifts
  // down by exactly skyBandPx. Widths and the flow axis are untouched.
  const shorelineY = SPACING.marginPx + SPACING.skyBandPx + bandHeight / 2;

  let headCursor = shorelineY - headExtent / 2;
  let packCursor = shorelineY - model.trunk.arrivingWidthPx / 2;
  const rivers: RiverLane[] = model.rivers.map((river) => {
    const headCentreY = headCursor + river.headWidthPx / 2;
    const mouthCentreY = packCursor + river.mouthWidthPx / 2;
    headCursor += river.headWidthPx + SPACING.laneGapPx;
    packCursor += river.mouthWidthPx;
    return layoutRiver(river, headX, laneLength, headCentreY, mouthCentreY, trunkStartX);
  });

  const trunk = layoutTrunk(model, trunkStartX, shorelineY);
  const lakeRegion = layoutLake(model, lakeRegionX, shorelineY);

  const separation: JunctionSeparation = {
    kind: 'stated-separation',
    decision: 'Q1 / 0017 option 1',
    trunkTerminusX: trunk.endX,
    lakeRegionX,
    gapPx: JUNCTION_SEPARATION_PX,
    connectorDrawn: false,
    note: COPY.separationRule,
    noteAnchor: { x: (trunk.endX + lakeRegionX) / 2, y: shorelineY },
  };

  const contentWidthPx = lakeRegion.x + lakeRegion.widthPx + SPACING.marginPx + 96;
  const contentHeightPx =
    SPACING.marginPx * 2 + SPACING.skyBandPx + bandHeight + SPACING.legendHeightPx;

  const legendY = SPACING.marginPx + SPACING.skyBandPx + bandHeight + SPACING.legendHeightPx / 2;
  const widthScale = model.scales.find((s) => s.id === 'width');
  const areaScale = model.scales.find((s) => s.id === 'area');
  const legend: LegendItem[] = [
    {
      kind: 'reference-bar',
      centre: { x: SPACING.marginPx + model.indicators.width.lengthPx / 2, y: legendY },
      radiusPx: 0,
      lengthPx: model.indicators.width.lengthPx,
      statement: model.indicators.width.statement,
      constant: widthScale === undefined ? '' : widthScale.constant,
    },
    {
      kind: 'reference-disc',
      centre: {
        x:
          SPACING.marginPx + model.indicators.width.lengthPx + 260 + model.indicators.area.radiusPx,
        y: legendY,
      },
      radiusPx: model.indicators.area.radiusPx,
      lengthPx: 0,
      statement: model.indicators.area.statement,
      constant: areaScale === undefined ? '' : areaScale.constant,
    },
  ];

  const notes: SceneNote[] = [];
  const push = (code: string, text: string): void => {
    notes.push({ code, text, anchor: { x: SPACING.marginPx, y: 18 + notes.length * 15 } });
  };

  for (const note of modelNotes(model)) push(note.code, note.text);

  const crossOverflow = Math.max(0, contentHeightPx - viewport.heightPx);
  const flowOverflow = Math.max(0, contentWidthPx - viewport.widthPx);
  if (crossOverflow > 0 || flowOverflow > 0) {
    push(
      'overflow',
      `Content is ${Math.round(contentWidthPx)}×${Math.round(contentHeightPx)}px at the fixed ` +
        `scale; the viewport is ${Math.round(viewport.widthPx)}×${Math.round(viewport.heightPx)}px. ` +
        `Pan to see the rest. Scaling to fit would be per-company rescaling (Invariant 3.1).`,
    );
  }

  return {
    viewport,
    contentWidthPx,
    contentHeightPx,
    rivers,
    trunk,
    separation,
    lakeRegion,
    legend,
    notes,
    overflow: {
      crossAxisPx: crossOverflow,
      flowAxisPx: flowOverflow,
      panRequired: crossOverflow > 0 || flowOverflow > 0,
    },
    unresolvedJunction: model.lake.junction,
    indicators: model.indicators,
  };
}
