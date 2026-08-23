/**
 * The confluence and the trunk constriction. Invariants 1, 3.2, 3.3; decision 0007 (D16).
 *
 * The trunk arrives carrying the sum of every segment's operating income — including
 * segments hidden behind "More", because collapsing is a display decision and never a
 * data decision (3.7). It then passes through one shared constriction carrying tax,
 * non-operating items and any unallocated corporate remainder, and departs as
 * consolidated net earnings.
 *
 * ONE SCALE, ASSERTED. The trunk's arriving width, its constriction, and every river
 * constriction all come from the same `widthPx`. That is test record 0002's condition C1
 * and it is what makes the "is the residual decoration?" question falsifiable rather than
 * a matter of opinion.
 *
 * Microsoft FY2026, accession 0001193125-26-323660:
 *   155,237 - 21,488 = 133,749 $M   ->   155.237 - 21.488 = 133.749 px
 * The residual is fully explained by two reported facts, with nothing left over:
 *   us-gaap:IncomeTaxExpenseBenefit 32,185 less us-gaap:NonoperatingIncomeExpense 10,697
 *   = 21,488. Unexplained: $0. Nothing here is allocated or estimated.
 * The constriction removes 13.84% of the trunk's width, the smallest narrowing on the
 * canvas as a ratio — and absolutely it removes 1.494x the entire operating income of the
 * smallest reportable segment, and a bite wider than that segment's whole river
 * (13.84% against 9.27%). Invariant 3.1 makes the absolute comparison the correct one.
 * The smallness is not a defect and must not be corrected: kill-list K1 forbids enlarging
 * it, K2 forbids normalising it, K5 forbids drawing attention to it with an effect. The
 * only permitted answer is the annotation carried on the geometry (0002 C2).
 *
 * A LOSS-MAKING FILER. Invariants 3.4 and 3.2; decision 0006.
 * When consolidated net earnings are negative the residual is `arriving + |net|` — the
 * claim is wider than the whole trunk. A cost cannot remove more width than exists, so the
 * constriction closes the trunk completely: it departs 0px wide carrying $0, and the part
 * of the claim no width could carry is exactly `|net|`, which is the magnitude the basin
 * already holds by plan area. That is 3.4's own sentence implemented — "rivers still flow
 * in and are still consumed; the loss is shown as a void that revenue failed to fill" —
 * and 3.2 is satisfied in sum, because removed width plus unrepresented width equals
 * `widthPx(residual)` on one constant and the shortfall re-enters the picture as the
 * basin's depth on that same constant. Nothing is clamped away in silence: `costUsd` and
 * the annotation keep the full claim and `ConstrictionOverdraw` names the difference.
 *
 * The naive alternative is worth stating so nobody re-invents it: setting the departing
 * width to `widthPx(|net|)` would draw a -$10B year as a 10px trunk flowing onward. Width
 * has no sign channel, so that reads as $10B of earnings. Departing width is 0, not |net|.
 *
 * WHAT THIS FILE WILL NOT DO IS THROW. `composeTrunk` is total for every finite input:
 * every shape the metaphor does not carry comes back as a `Blocked` reason. A throw is
 * neither a designed refusal nor a rendered picture, which is the worst of both.
 */
import { removedPerBankPx, removedWidthPx, widthPx, type Usd } from '../scales';
import { blocked, ok, type Blocked, type EncodingResult } from './blocked';
import {
  CONSTRICTION_SPAN_PX,
  type ConstrictionOverdraw,
  type TrunkGeometry,
  type WidthStation,
} from './types';

export interface ResidualComponent {
  readonly id: string;
  readonly label: string;
  readonly amountUsd: Usd;
}

export interface TrunkInput {
  /** Every segment's operating income, hidden ones included. Invariant 3.7. */
  readonly segmentOperatingIncomeUsd: readonly Usd[];
  readonly netEarningsUsd: Usd;
  /**
   * Tax, non-operating items and any unallocated corporate remainder, itemised. Test
   * record 0002 C3 requires the detail panel to itemise rather than total. Supply an
   * empty list when the split is not yet extracted; the requirement still travels on the
   * geometry, marked unmet.
   */
  readonly residualComponents: readonly ResidualComponent[];
  /** Plain-language name for the constriction. Final wording is Angel's (0002 C5). */
  readonly label: string;
}

export const DEFAULT_RESIDUAL_TOLERANCE_USD = 0;

/** What one cost claim does to one flow. Widths in px, quantities in dollars. */
export interface ConstrictionClosure {
  /** The width the claim would occupy if the flow were wide enough to give it. */
  readonly claimedWidthPx: number;
  /** What is actually removed: the claim, or the whole flow when the claim exceeds it. */
  readonly removedWidthPx: number;
  /** What is left. Never negative; exactly zero when the flow is fully consumed. */
  readonly widthAfterPx: number;
  readonly overdraw: ConstrictionOverdraw | null;
}

/**
 * Apply one cost claim to one flow, in dollars, and report what the width channel can and
 * cannot carry.
 *
 * KEYED ON (arriving, cost) AND NOT ON THE TRUNK, deliberately. Open question Q4 asks
 * whether the trunk stays one net pinch or decomposes into its reported components. If it
 * decomposes, each component is a call to this function against the flow arriving at it,
 * and nothing here has to change. Q4 is not answered by this file and must not be
 * foreclosed by it.
 *
 * Q2 is not answered here either: a negative `costUsd` (a claim that would WIDEN the flow)
 * is refused by the caller before this is reached, and `widthPx` would refuse it anyway.
 */
export function closeConstriction(arrivingUsd: Usd, costUsd: Usd): ConstrictionClosure {
  // `removedWidthPx` is the 3.2 alias of `widthPx` — same function, so that a claim is
  // measured by the identical scale wherever it appears. Test record 0002 C1.
  const claimedWidthPx = removedWidthPx(costUsd);
  const unrepresentedUsd = Math.max(costUsd - arrivingUsd, 0);

  if (unrepresentedUsd === 0) {
    return {
      claimedWidthPx,
      removedWidthPx: claimedWidthPx,
      widthAfterPx: widthPx(arrivingUsd - costUsd),
      overdraw: null,
    };
  }

  const widthBeforePx = widthPx(arrivingUsd);
  return {
    claimedWidthPx,
    removedWidthPx: widthBeforePx,
    widthAfterPx: 0,
    overdraw: {
      claimedCostUsd: costUsd,
      representedCostUsd: arrivingUsd,
      unrepresentedUsd,
      unrepresentedWidthPx: widthPx(unrepresentedUsd),
      carriedBy: 'basin-plan-area-and-depth',
      annotationRequired: true,
      note:
        `This claim is wider than the flow arriving at it, so the width channel saturates: it ` +
        `removes the whole ${widthBeforePx.toFixed(3)}px that arrived and ${widthPx(unrepresentedUsd).toFixed(3)}px ` +
        `of it has no width left to take. That shortfall is the magnitude the basin carries by ` +
        `plan area on the 3.3 constant, and it is numerically the basin's depth below grade, ` +
        `because the depth constant is pinned to the width constant by identity. State the ` +
        `shortfall in dollars at the constriction: the full claim is ${costUsd}, of which ` +
        `${arrivingUsd} is drawn.`,
    },
  };
}

export function composeTrunk(
  input: TrunkInput,
  toleranceUsd: number = DEFAULT_RESIDUAL_TOLERANCE_USD,
): EncodingResult<TrunkGeometry> {
  const reasons: Blocked[] = [];

  const arrivingUsd = input.segmentOperatingIncomeUsd.reduce((sum, value) => sum + value, 0);
  const residualUsd = arrivingUsd - input.netEarningsUsd;

  if (arrivingUsd < 0) {
    reasons.push({
      code: 'trunk-arriving-negative',
      subject: 'trunk',
      message:
        `The segments sum to ${arrivingUsd} of operating income, so the trunk would arrive at the ` +
        `confluence with negative width. Each losing segment has already refused on its own ` +
        `("segment-operating-loss"); this is the same shape the metaphor does not carry, seen ` +
        `from the confluence. Angel's call, per Cartographer's escalation clause.`,
      escalation: 'metaphor break — segments sum to an operating loss',
      amountUsd: arrivingUsd,
    });
  }

  if (residualUsd < 0) {
    reasons.push({
      code: 'trunk-residual-positive',
      subject: 'trunk',
      message:
        `Consolidated net earnings (${input.netEarningsUsd}) exceed the sum of segment operating ` +
        `income (${arrivingUsd}), so the trunk would have to widen by ${-residualUsd}. ` +
        `"Constriction" has no widening behaviour and a river that fattens with no tributary ` +
        `reads as "where did that water come from". Open question Q2; unanswered.`,
      escalation: 'Q2',
      amountUsd: -residualUsd,
    });
  }

  if (input.residualComponents.length > 0) {
    const componentTotal = input.residualComponents.reduce((sum, part) => sum + part.amountUsd, 0);
    if (Math.abs(componentTotal - residualUsd) > toleranceUsd) {
      reasons.push({
        code: 'residual-components-do-not-sum',
        subject: 'trunk',
        message:
          `The itemised residual components sum to ${componentTotal} but the residual is ` +
          `${residualUsd}. An itemisation that does not tie is worse than none — it invites the ` +
          `analyst to trust a breakdown that is wrong.`,
        escalation: null,
        amountUsd: componentTotal - residualUsd,
      });
    }
  }

  if (reasons.length > 0) return blocked(reasons);

  const arrivingWidthPx = widthPx(arrivingUsd);
  const closure = closeConstriction(arrivingUsd, residualUsd);
  const removed = closure.removedWidthPx;
  const departingWidthPx = closure.widthAfterPx;
  // Width has no sign. A loss departs $0 through a 0px trunk; the signed figure is the
  // lake's readout, and the magnitude the trunk could not carry is `closure.overdraw`.
  const departingUsd: Usd = Math.max(input.netEarningsUsd, 0);

  const stations: WidthStation[] = [
    { id: 'trunk/head', kind: 'head', widthPx: arrivingWidthPx, halfWidthPx: arrivingWidthPx / 2 },
    {
      id: 'trunk/residual/enter',
      kind: 'constriction-enter',
      widthPx: arrivingWidthPx,
      halfWidthPx: arrivingWidthPx / 2,
    },
    {
      id: 'trunk/residual/exit',
      kind: 'constriction-exit',
      widthPx: departingWidthPx,
      halfWidthPx: departingWidthPx / 2,
    },
    {
      id: 'trunk/mouth',
      kind: 'mouth',
      widthPx: departingWidthPx,
      halfWidthPx: departingWidthPx / 2,
    },
  ];

  return ok({
    arrivingWidthPx,
    arrivingUsd,
    departingWidthPx,
    departingUsd,
    terminatesAtConstriction: departingWidthPx === 0,
    stations,
    constriction: {
      id: 'trunk/residual',
      label: input.label,
      kind: 'trunk-residual',
      costUsd: residualUsd,
      widthBeforePx: arrivingWidthPx,
      widthAfterPx: departingWidthPx,
      removedWidthPx: removed,
      // Half of what is REMOVED, not half of what is claimed: a constriction closes in from
      // both banks and cannot close past the centreline.
      removedPerBankPx: closure.overdraw === null ? removedPerBankPx(residualUsd) : removed / 2,
      spanPx: CONSTRICTION_SPAN_PX,
      // The full claim, always. `dimensionedWidthPx` is the width that claim occupies on the
      // width constant, which exceeds `removedWidthPx` exactly when `overdraw` is non-null.
      annotation: {
        valueUsd: residualUsd,
        dimensionedWidthPx: closure.claimedWidthPx,
        required: true,
      },
      overdraw: closure.overdraw,
      // 0002 C4. Distinct in kind from a segment cost constriction, by a cue that is not
      // colour alone (3.10), and labelled as applying to the whole company. Position after
      // the confluence is not sufficient: a beginner does not know what that position means.
      distinctTreatmentRequired: true,
    },
    itemization: {
      required: true,
      provided: input.residualComponents.length > 0,
      components: input.residualComponents,
    },
  });
}
