/**
 * The whole canvas, as one pure function of one period of one filer's reported figures.
 *
 * Rivers -> confluence -> trunk -> trunk constriction -> lake. Every width on the same
 * 3.1 constant, the lake on the 3.3 area constant, both indicators derived from those
 * same constants so the legend cannot disagree with the picture.
 *
 * Two things this function refuses to do, and both refusals are the point:
 *
 *   1. It will not place the lake. `junction` is an unresolved value carried on the
 *      model, not a coordinate. Open question Q1, Angel's to answer, kill-list K3.
 *
 *   2. It will not rescale anything to make it fit or make it legible. It measures and
 *      reports. Invariants 3.1 and 3.9; protocol section 3 makes the trade an escalation.
 *
 * A LOSS COMPOSES. It does not throw and it is not a refusal. When net earnings are
 * negative the trunk's residual claims more than the whole trunk, so the trunk terminates
 * at its constriction (`terminatesAtConstriction`, `departingUsd` $0) and the lake becomes
 * the drained basin of Invariant 3.4, with the magnitude the trunk could not carry stated
 * on `trunk.constriction.overdraw`. `totals.netEarningsUsd` stays SIGNED — it is the
 * reported figure, not a width — while `trunk.departingUsd` is what the departing width
 * claims and is therefore never negative. Those two disagreeing on a loss-making filer is
 * the encoding working, not a bug: one is the number, the other is the geometry.
 *
 * Also absent, deliberately: flow speed (open decision D9) and every colour (open
 * decision D15). Nothing in the model returned here carries a colour, which is also how
 * the deuteranopia and protanopia requirement of 3.10 is met for what ships today —
 * there is no hue to confuse, and a test asserts the model stays colourless.
 */
import {
  assessCrossAxisFit,
  assessLegibility,
  defaultAreaIndicator,
  defaultWidthIndicator,
  SCALE_MANIFEST,
  type AreaScaleIndicator,
  type CrossAxisFitReport,
  type LegibilityReport,
  type ScaleManifestEntry,
  type Usd,
  type WidthScaleIndicator,
} from '../scales';
import { blocked, ok, type Blocked, type EncodingResult } from './blocked';
import { composeLake, UNRESOLVED_JUNCTION } from './lake';
import { composeRiver, DEFAULT_RECONCILIATION_TOLERANCE_USD, type RiverInput } from './river';
import {
  aggregateRiverInput,
  partitionSegments,
  SEGMENT_DISPLAY_CAP,
  validateDisplayCap,
} from './segment-cap';
import { composeTrunk, type ResidualComponent } from './trunk';
import type {
  CollapsedSummary,
  ConstrictionGeometry,
  LakeGeometry,
  RiverGeometry,
  TrunkGeometry,
  UnresolvedJunction,
} from './types';

export interface CanvasInput {
  readonly fiscalPeriodLabel: string;
  /** Every reportable segment. Not the visible ones — every one. Invariant 3.7. */
  readonly segments: readonly RiverInput[];
  readonly netEarningsUsd: Usd;
  /** Plain-language name for the trunk constriction. Final wording is Angel's (0002 C5). */
  readonly trunkConstrictionLabel: string;
  readonly residualComponents?: readonly ResidualComponent[];
  readonly displayCap?: number;
  readonly toleranceUsd?: number;
  /** Cross-axis room available, for the fit report only. Never used to rescale. */
  readonly availableCrossAxisPx?: number;
}

export interface CanvasTotals {
  readonly segmentRevenueUsd: Usd;
  readonly segmentOperatingIncomeUsd: Usd;
  readonly trunkResidualUsd: Usd;
  readonly netEarningsUsd: Usd;
}

export interface CanvasModel {
  readonly fiscalPeriodLabel: string;
  /** Visible rivers, plus one aggregate river when segments are collapsed. */
  readonly rivers: readonly RiverGeometry[];
  readonly collapsed: CollapsedSummary | null;
  readonly trunk: TrunkGeometry;
  readonly lake: LakeGeometry;
  readonly indicators: {
    readonly area: AreaScaleIndicator;
    readonly width: WidthScaleIndicator;
  };
  readonly scales: readonly ScaleManifestEntry[];
  readonly legibility: LegibilityReport;
  readonly crossAxisFit: CrossAxisFitReport | null;
  /** Sum of drawn river head widths and the lake diameter. Excludes spacing, which is Forge's. */
  readonly requiredCrossAxisPx: number;
  readonly junction: UnresolvedJunction;
  readonly totals: CanvasTotals;
}

export function composeCanvas(input: CanvasInput): EncodingResult<CanvasModel> {
  const reasons: Blocked[] = [];
  const cap = input.displayCap ?? SEGMENT_DISPLAY_CAP.default;
  const toleranceUsd = input.toleranceUsd ?? DEFAULT_RECONCILIATION_TOLERANCE_USD;

  const capIssue = validateDisplayCap(cap);
  if (capIssue !== null) reasons.push(capIssue);
  if (reasons.length > 0) return blocked(reasons);

  const partition = partitionSegments(input.segments, cap);
  const aggregate = aggregateRiverInput(partition.collapsed);
  const drawn: RiverInput[] = [...partition.visible];
  if (aggregate !== null) drawn.push(aggregate);

  const rivers: RiverGeometry[] = [];
  for (const riverInput of drawn) {
    const result = composeRiver(riverInput, toleranceUsd);
    if (!result.ok) {
      reasons.push(...result.blocked);
      continue;
    }
    // Reference identity, not id equality: a filer is entitled to name a segment "more".
    rivers.push(riverInput === aggregate ? { ...result.value, aggregated: true } : result.value);
  }

  // The trunk is computed from EVERY segment, never from the drawn ones. This is the line
  // that makes Invariant 3.7 structural: expanding or collapsing "More" cannot move it.
  const trunkResult = composeTrunk(
    {
      segmentOperatingIncomeUsd: input.segments.map((segment) => segment.operatingIncomeUsd),
      netEarningsUsd: input.netEarningsUsd,
      residualComponents: input.residualComponents ?? [],
      label: input.trunkConstrictionLabel,
    },
    toleranceUsd,
  );
  if (!trunkResult.ok) reasons.push(...trunkResult.blocked);

  const lakeResult = composeLake({
    netEarningsUsd: input.netEarningsUsd,
    fiscalPeriodLabel: input.fiscalPeriodLabel,
  });
  if (!lakeResult.ok) reasons.push(...lakeResult.blocked);

  if (!trunkResult.ok || !lakeResult.ok || reasons.length > 0) return blocked(reasons);

  const trunk: TrunkGeometry = trunkResult.value;
  const lake: LakeGeometry = lakeResult.value;

  const allConstrictions: ConstrictionGeometry[] = [
    ...rivers.flatMap((river) => river.constrictions),
    trunk.constriction,
  ];

  const indicators = {
    area: defaultAreaIndicator(),
    width: defaultWidthIndicator(),
  };

  const legibility = assessLegibility({
    rivers: rivers.map((river) => ({ id: river.id, mouthWidthPx: river.mouthWidthPx })),
    constrictions: allConstrictions.map((constriction) => ({
      id: constriction.id,
      removedWidthPx: constriction.removedWidthPx,
    })),
    lakeEquivalentDiameterPx: lake.equivalentDiscDiameterPx,
    indicatorValueUsd: indicators.area.valueUsd,
    subjectUsd: input.netEarningsUsd,
  });

  const stackedHeadWidthPx = rivers.reduce((sum, river) => sum + river.headWidthPx, 0);
  const requiredCrossAxisPx = Math.max(stackedHeadWidthPx, lake.equivalentDiscDiameterPx);
  const crossAxisFit =
    input.availableCrossAxisPx === undefined
      ? null
      : assessCrossAxisFit(requiredCrossAxisPx, input.availableCrossAxisPx);

  const collapsed: CollapsedSummary | null =
    partition.collapsed.length === 0
      ? null
      : {
          count: partition.collapsed.length,
          revenueUsd: partition.collapsed.reduce((sum, segment) => sum + segment.revenueUsd, 0),
          operatingIncomeUsd: partition.collapsed.reduce(
            (sum, segment) => sum + segment.operatingIncomeUsd,
            0,
          ),
          segmentIds: partition.collapsed.map((segment) => segment.id),
        };

  return ok({
    fiscalPeriodLabel: input.fiscalPeriodLabel,
    rivers,
    collapsed,
    trunk,
    lake,
    indicators,
    scales: SCALE_MANIFEST,
    legibility,
    crossAxisFit,
    requiredCrossAxisPx,
    junction: UNRESOLVED_JUNCTION,
    totals: {
      segmentRevenueUsd: input.segments.reduce((sum, segment) => sum + segment.revenueUsd, 0),
      segmentOperatingIncomeUsd: trunk.arrivingUsd,
      trunkResidualUsd: trunk.constriction.costUsd,
      netEarningsUsd: input.netEarningsUsd,
    },
  });
}
