/**
 * The geometry contract Forge renders from.
 *
 * The split between this directory and `src/viz/render/` is: Cartographer owns every
 * quantity that carries a financial claim; Forge owns everything that does not. So this
 * file states WIDTHS in absolute pixels and says nothing about where anything sits along
 * the flow axis, what curve the banks follow, or what the water looks like. A river's
 * length, its centreline and its silhouette encode nothing and are Forge's and Atelier's.
 *
 * One exception, and it is an encoding rule rather than a layout one: the longitudinal
 * extent of a constriction must be IDENTICAL for every constriction on the canvas,
 * including the trunk's. If pinches differ in length, length becomes a channel a reader
 * will decode, and Invariant 3.6 forbids anything that looks like data being arbitrary.
 * `CONSTRICTION_SPAN_PX` is that shared extent. Its value is Atelier's to choose; its
 * uniformity is not negotiable and is asserted by test.
 */
import type { Usd } from '../scales';

/**
 * Shared longitudinal extent of every constriction, in pixels along the flow axis.
 * Uniform by rule (see the note above). Encodes nothing.
 */
export const CONSTRICTION_SPAN_PX = 24;

/** A point on a river where the width is defined. Ordered head to mouth. */
export interface WidthStation {
  readonly id: string;
  readonly kind: 'head' | 'constriction-enter' | 'constriction-exit' | 'mouth';
  /** Total width across the flow. */
  readonly widthPx: number;
  /** Distance from the centreline to either bank. */
  readonly halfWidthPx: number;
}

/**
 * Where a dollar figure must be written against the geometry. Test record 0002 C2 makes
 * the annotation's presence mandatory and its presentation Atelier's. This carries the
 * quantity and the dimension to be annotated; it does not choose a typeface or a side.
 */
export interface ConstrictionAnnotation {
  readonly valueUsd: Usd;
  /** The dimension being annotated: the width the constriction removes. */
  readonly dimensionedWidthPx: number;
  readonly required: true;
}

export type ConstrictionKind = 'segment-cost' | 'trunk-residual';

/**
 * What a constriction claims but cannot take, because the claim is wider than the flow
 * arriving at it. Invariant 3.4, and Invariant 3.2 read in sum rather than per channel.
 *
 * A cost cannot remove more width than exists. When the claim exceeds the flow, the width
 * channel saturates at the arriving width and the remainder has to go somewhere honest.
 * It goes exactly where 3.4 already puts it: "rivers still flow in and are still consumed
 * — the loss is shown as a void that revenue failed to fill". The void is the basin, and
 * the arithmetic is not approximate. For the trunk, the claim is the residual
 * `arriving - net`, so the part the width channel could not take is `-net`, which is the
 * magnitude the basin already carries by plan area on the 3.3 constant.
 *
 * NOTHING IS LOST, AND THAT IS TESTABLE:
 *   widthPx(claimedCostUsd) === removedWidthPx + unrepresentedWidthPx
 * on one constant. And because `depth.ts` pins the depth constant to the width constant
 * by identity, `unrepresentedWidthPx` is numerically the basin's depth below grade: the
 * width the constriction could not remove IS the depth the basin sinks. That is a
 * derivation, not a clamp chosen because it looked tidy, and it fails loudly if anyone
 * ever unpins the depth constant.
 *
 * `costUsd` and `annotation.valueUsd` still state the FULL claim. The reader is never told
 * the pinch cost less than it did; only the geometry saturates, and this block is what
 * makes the saturation legible instead of merely present in the data.
 */
export interface ConstrictionOverdraw {
  /** The whole cost, as reported. Equal to the constriction's `costUsd`. */
  readonly claimedCostUsd: Usd;
  /** The part the width channel could take — the flow that arrived, all of it. */
  readonly representedCostUsd: Usd;
  /** The part no width could carry. For the trunk this is the magnitude of the loss. */
  readonly unrepresentedUsd: Usd;
  /** That shortfall on the width constant. Numerically the basin's depth below grade. */
  readonly unrepresentedWidthPx: number;
  readonly carriedBy: 'basin-plan-area-and-depth';
  /**
   * The shortfall must be stated in dollars at the constriction, not left in the model.
   * Presentation is Atelier's; the requirement travels on the geometry so it cannot be
   * lost between agents.
   */
  readonly annotationRequired: true;
  readonly note: string;
}

export interface ConstrictionGeometry {
  readonly id: string;
  readonly label: string;
  readonly kind: ConstrictionKind;
  readonly costUsd: Usd;
  readonly widthBeforePx: number;
  readonly widthAfterPx: number;
  /**
   * widthBefore - widthAfter: the width this constriction actually removes.
   *
   * Equal to the width scale applied to `costUsd` in every ordinary case, and BOUNDED BY
   * `widthBeforePx` when the claim exceeds the flow — a cost cannot remove more width than
   * exists. When it is bounded, `overdraw` is non-null and states the difference, so that
   * `widthPx(costUsd) === removedWidthPx + overdraw.unrepresentedWidthPx` always holds.
   */
  readonly removedWidthPx: number;
  readonly removedPerBankPx: number;
  readonly spanPx: number;
  readonly annotation: ConstrictionAnnotation;
  /**
   * Non-null only when the claim was wider than the flow. Null on every river
   * constriction by construction: `river.ts` enforces costs + operating income = revenue
   * with every term non-negative, so no partial sum of costs can exceed the head width.
   */
  readonly overdraw: ConstrictionOverdraw | null;
  /**
   * Test record 0002 C4: the trunk constriction must differ IN KIND from a segment cost
   * constriction, by a cue that is not colour alone (3.10). The cue itself is Atelier's;
   * the requirement travels with the geometry so it cannot be lost between agents.
   */
  readonly distinctTreatmentRequired: boolean;
}

export interface RiverGeometry {
  readonly id: string;
  readonly label: string;
  readonly revenueUsd: Usd;
  readonly operatingIncomeUsd: Usd;
  readonly headWidthPx: number;
  readonly mouthWidthPx: number;
  readonly stations: readonly WidthStation[];
  readonly constrictions: readonly ConstrictionGeometry[];
  /**
   * Invariant 3.2: the constriction count is filer-shaped and the variation is itself
   * information about disclosure depth, to be labelled the way 3.8 labels a
   * single-segment filer. Carried here so the label cannot be forgotten.
   */
  readonly disclosure: {
    readonly costCategoriesDisclosed: number;
    readonly labelRequired: true;
  };
  /**
   * True only for the river standing in for segments collapsed behind "More". Its costs
   * are a sum of reported figures across several segments, so it is aggregated rather
   * than filer-shaped and must say so.
   */
  readonly aggregated: boolean;
}

export interface TrunkGeometry {
  /** Sum of every segment's operating income, including segments hidden behind "More". */
  readonly arrivingWidthPx: number;
  readonly arrivingUsd: Usd;
  readonly constriction: ConstrictionGeometry;
  /** Zero when the residual claims the whole trunk — see `terminatesAtConstriction`. */
  readonly departingWidthPx: number;
  /**
   * What the departing width claims, which is consolidated net earnings when that figure
   * is positive and $0 when it is not. A negative result is NOT carried here: width has no
   * sign channel, and a trunk drawn `widthPx(|net|)` wide flowing onward would read as
   * earnings. The signed figure lives on the lake's readout, where 0001 C2 put it.
   */
  readonly departingUsd: Usd;
  /**
   * True when the residual consumes the trunk entirely, so nothing departs. Invariant 3.4:
   * the rivers still arrive at full width and are still consumed; what they failed to fill
   * is the basin. Continuous through zero — a filer that breaks exactly even terminates
   * here too, with no shortfall.
   */
  readonly terminatesAtConstriction: boolean;
  readonly stations: readonly WidthStation[];
  /**
   * Test record 0002 C3: the detail panel must itemise the residual into its reported
   * components rather than total it. The components are Ledger's to supply; when they
   * are absent the requirement is still carried, and `provided` is false.
   */
  readonly itemization: {
    readonly required: true;
    readonly provided: boolean;
    readonly components: readonly {
      readonly id: string;
      readonly label: string;
      readonly amountUsd: Usd;
    }[];
  };
}

/**
 * Q1. UNRESOLVED AND NOT DEFAULTED.
 *
 * River width is px per dollar and lake area is px squared per dollar, so the ratio of
 * the two constants has units of pixels and nothing in the invariants pins it. Choosing
 * it by eye puts arbitrary geometry on the channel a beginner reads first — Invariant
 * 3.6, kill-list K3. Angel answers this, not Cartographer.
 *
 * This is a value, not a comment, so that Forge cannot render the junction without
 * handling it, and so that no plausible default can quietly harden into a decision.
 */
export interface UnresolvedJunction {
  readonly resolved: false;
  readonly blockedBy: 'Q1';
  readonly question: string;
  readonly forbidden: readonly string[];
}

export type WaterBody = 'lake' | 'drained-basin' | 'dry';

export interface LakeGeometry {
  readonly waterBody: WaterBody;
  readonly netEarningsUsd: Usd;
  /** On the 3.3 area constant, identical for either sign (decision 0006, 0001 C5). */
  readonly planAreaPx2: number;
  /** The radius of the circle of that area. The silhouette need not be circular. */
  readonly equivalentDiscRadiusPx: number;
  readonly equivalentDiscDiameterPx: number;
  /** Zero unless the result is negative. Redundant channel; area carries the magnitude. */
  readonly depthBelowShorelinePx: number;
  readonly silhouetteConstraint: string;
  /** Test record 0001 C2. Persistent text, not a hover reveal. */
  readonly netEarningsReadout: {
    readonly usd: Usd;
    readonly persistent: true;
    readonly tabularNumerals: true;
  };
  /** Test record 0001 C3 and decision 0006. Attached to a filled lake, not only a basin. */
  readonly fiscalPeriodLabel: string;
  /** Invariant 3.4 and 3.10: sign is carried by these, never by colour alone. */
  readonly signCues: readonly ('dry-floor' | 'rim-treatment' | 'label')[];
  /** Kill-list K13 and Invariant 3.4. */
  readonly volumetricShadingForbidden: true;
  readonly junction: UnresolvedJunction;
}

export interface CollapsedSummary {
  readonly count: number;
  readonly revenueUsd: Usd;
  readonly operatingIncomeUsd: Usd;
  readonly segmentIds: readonly string[];
}
