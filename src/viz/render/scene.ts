/**
 * The laid-out scene: Cartographer's geometry with positions attached, and nothing else.
 *
 * The split this file defends is the one `encoding/types.ts` states from the other side.
 * Cartographer owns every quantity that carries a financial claim — widths, plan area,
 * constriction span. Forge owns position along the flow axis, centreline, silhouette and
 * spacing, all of which encode nothing. So every WIDTH in this file is copied through
 * from `CanvasModel` unchanged, and every X and Y is computed here.
 *
 * A `Scene` is a pure function of `(CanvasModel, Viewport)`. Quality level is NOT an
 * input, which is what makes the Invariant 4.1 rule "geometry accuracy is never
 * degraded" structural rather than a promise: there is no code path by which a
 * degradation level can reach a coordinate. `geometry-invariance.test.ts` proves it by
 * deep-equality across every level.
 */
import type { ConstrictionKind, ConstrictionOverdraw, LakeGeometry, WaterBody } from '../encoding';
import type { AreaScaleIndicator, WidthScaleIndicator, Usd } from '../scales';

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export interface Viewport {
  /** CSS pixels. Device pixel ratio is a quality concern and lives in the renderer. */
  readonly widthPx: number;
  readonly heightPx: number;
}

/** Both banks of a flow, head to mouth. `top` and `bottom` are the same length. */
export interface Banks {
  readonly top: readonly Pt[];
  readonly bottom: readonly Pt[];
}

export interface PlacedStation {
  readonly id: string;
  readonly kind: 'head' | 'constriction-enter' | 'constriction-exit' | 'mouth';
  readonly x: number;
  readonly centreY: number;
  /** Copied from Cartographer. Never recomputed here. */
  readonly widthPx: number;
}

/** A dollar figure written against the geometry. Presence is mandatory (0002 C2). */
export interface PlacedAnnotation {
  readonly valueUsd: Usd;
  readonly text: string;
  readonly anchor: Pt;
  readonly leaderFrom: Pt;
  readonly leaderTo: Pt;
}

export interface PlacedConstriction {
  readonly id: string;
  readonly label: string;
  readonly kind: ConstrictionKind;
  readonly enterX: number;
  readonly exitX: number;
  readonly centreY: number;
  readonly widthBeforePx: number;
  readonly widthAfterPx: number;
  readonly removedWidthPx: number;
  /** Uniform across every constriction on the canvas, trunk included. */
  readonly spanPx: number;
  readonly annotation: PlacedAnnotation;
  /**
   * Copied from Cartographer, never recomputed. Non-null only when the claim was wider
   * than the flow, so the conservation identity
   * `widthPx(annotation.valueUsd) === removedWidthPx + overdraw.unrepresentedWidthPx`
   * holds on the placed geometry exactly as it does on the encoding.
   */
  readonly overdraw: ConstrictionOverdraw | null;
  readonly distinctTreatmentRequired: boolean;
}

export interface RiverLane {
  readonly id: string;
  readonly label: string;
  readonly aggregated: boolean;
  readonly headX: number;
  readonly mouthX: number;
  readonly headCentreY: number;
  readonly mouthCentreY: number;
  readonly headWidthPx: number;
  readonly mouthWidthPx: number;
  /** Copied through so the analyst reads the figure, not the pixel. Invariant 1. */
  readonly revenueUsd: Usd;
  readonly operatingIncomeUsd: Usd;
  readonly headText: string;
  readonly mouthText: string;
  readonly stations: readonly PlacedStation[];
  readonly banks: Banks;
  readonly constrictions: readonly PlacedConstriction[];
  /** Invariant 3.2 / 3.8: disclosure depth is labelled, never left to be misread. */
  readonly disclosureNote: string;
  /** Enclosed plan area of the drawn silhouette, for uniform particle density only. */
  readonly surfacePx2: number;
}

export interface TrunkSection {
  readonly startX: number;
  readonly endX: number;
  readonly centreY: number;
  readonly arrivingWidthPx: number;
  readonly departingWidthPx: number;
  readonly arrivingUsd: Usd;
  readonly departingUsd: Usd;
  readonly arrivingText: string;
  readonly departingText: string;
  readonly stations: readonly PlacedStation[];
  readonly banks: Banks;
  readonly constriction: PlacedConstriction;
  readonly surfacePx2: number;
  readonly itemizationProvided: boolean;
}

/**
 * Q1, answered: Option 1. The lake is a labelled readout, spatially separated from the
 * trunk, and the conservation read is never invited.
 *
 * This is a considered refusal, not a gap. `UNRESOLVED_JUNCTION` stays on the model as
 * the record of *why* the two scales do not convert; the render expresses the decision.
 * Concretely, and asserted in `junction.test.ts`: no connector is drawn, the gap is a
 * constant that varies with nothing, and none of the three closures barred by
 * `UNRESOLVED_JUNCTION.forbidden` is taken.
 */
export interface JunctionSeparation {
  readonly kind: 'stated-separation';
  readonly decision: 'Q1 / 0017 option 1';
  /** Trunk terminus. The flow ends here, finished, not torn. */
  readonly trunkTerminusX: number;
  /** Left edge of the lake region. */
  readonly lakeRegionX: number;
  readonly gapPx: number;
  readonly connectorDrawn: false;
  readonly note: string;
  readonly noteAnchor: Pt;
}

export interface LakeBody {
  readonly waterBody: WaterBody;
  readonly centre: Pt;
  /** Closed polygon. Its enclosed area equals `planAreaPx2` exactly (asserted). */
  readonly outline: readonly Pt[];
  readonly planAreaPx2: number;
  readonly equivalentDiscRadiusPx: number;
  readonly depthBelowShorelinePx: number;
  readonly signCues: readonly ('dry-floor' | 'rim-treatment' | 'label')[];
  readonly netEarningsUsd: Usd;
  readonly readoutText: string;
  readonly readoutAnchor: Pt;
  readonly periodLabel: string;
  readonly periodAnchor: Pt;
  /** Present only for a drained basin. Redundant channel; never volumetric (K13). */
  readonly depthGauge: { readonly from: Pt; readonly to: Pt; readonly text: string } | null;
}

/**
 * The lake's own coordinate region. Self-contained on purpose: option 3 of 0017 (a
 * revenue-sized basin the lake partially fills, so fill fraction reads as margin) would
 * add a second shape inside this region and would not move a single coordinate on the
 * river side. Option 1 is implemented; option 3 is not foreclosed.
 */
export interface LakeRegion {
  readonly x: number;
  readonly y: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly lake: LakeBody;
}

export interface LegendItem {
  readonly kind: 'reference-disc' | 'reference-bar';
  readonly centre: Pt;
  readonly radiusPx: number;
  readonly lengthPx: number;
  readonly statement: string;
  readonly constant: string;
}

export interface SceneNote {
  readonly code: string;
  readonly text: string;
  readonly anchor: Pt;
}

export interface Scene {
  readonly viewport: Viewport;
  /** Full extent of the drawn content. Exceeds the viewport when the filer does not fit. */
  readonly contentWidthPx: number;
  readonly contentHeightPx: number;
  readonly rivers: readonly RiverLane[];
  readonly trunk: TrunkSection;
  readonly separation: JunctionSeparation;
  readonly lakeRegion: LakeRegion;
  readonly legend: readonly LegendItem[];
  readonly notes: readonly SceneNote[];
  /**
   * Invariant 3.1 and 3.9. Overflow is reported and resolved by panning, never by a
   * fit-to-viewport multiplier — that is per-company rescaling wearing a camera's
   * clothes, and `scales/legibility.ts` says so in as many words.
   */
  readonly overflow: {
    readonly crossAxisPx: number;
    readonly flowAxisPx: number;
    readonly panRequired: boolean;
  };
  /** Carried through untouched so nothing downstream can inherit a resolved junction. */
  readonly unresolvedJunction: LakeGeometry['junction'];
  readonly indicators: {
    readonly area: AreaScaleIndicator;
    readonly width: WidthScaleIndicator;
  };
}
