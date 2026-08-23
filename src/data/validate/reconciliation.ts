/**
 * Does it add up. Invariant 2.4 on the revenue side, D16 on the profit side.
 *
 * **Revenue.** The sum of segment revenues must reach consolidated revenue
 * within 0.5%. Outside that, the company does not render: it shows a
 * data-quality state naming the discrepancy. Inside it, any gap is still
 * rendered as an explicit unallocated amount rather than absorbed into the
 * rivers.
 *
 * **Profit.** Segment reporting stops at operating income, so the gap between
 * the sum of segment profit and consolidated net earnings is real and belongs to
 * no segment. It becomes the trunk constriction. What fills it — tax,
 * non-operating items — is read from the filing, and whatever the reported
 * components fail to account for stays visible as `unexplained` rather than
 * being rounded into one of them.
 *
 * There is deliberately no tolerance rule on the profit side. Invariant 2.4
 * mandates one on revenue only, and D18 — whether a profit-side rule is needed
 * and what it should be — is open. This module therefore reports the profit
 * arithmetic exactly and refuses nothing on it.
 */
import {
  differenceOfReportedFigures,
  reportedBridgeRemainder,
  sumOfReportedFigures,
  type DerivationOutcome,
} from '../model/derivations.ts';
import { roundingTolerance, type Figure } from '../model/figure.ts';
import type { Constriction, RevenueReconciliation, TrunkConstriction } from '../model/company.ts';

/** Invariant 2.4, as written. Changing it requires an amendment, not a patch. */
export const REVENUE_RECONCILIATION_TOLERANCE = 0.005;

export type ReconciliationResult =
  | { readonly kind: 'ok'; readonly reconciliation: RevenueReconciliation }
  | { readonly kind: 'uncomputable'; readonly detail: string };

/**
 * Reconciles segment revenue to consolidated revenue.
 *
 * `unallocated` carries whatever the filer itself discloses as corporate or
 * eliminations on the segment axis; it is rendered whether or not the check
 * passes. The ratio is taken against consolidated revenue, which is the
 * denominator Invariant 2.4 names.
 */
export function reconcileRevenue(
  segmentRevenues: readonly Figure[],
  consolidatedRevenue: Figure,
  unallocated: readonly Constriction[] = [],
): ReconciliationResult {
  const total = sumOfReportedFigures(segmentRevenues);

  if (!total.ok) return { kind: 'uncomputable', detail: total.detail };

  const difference = differenceOfReportedFigures(consolidatedRevenue, total.figure);

  if (!difference.ok) return { kind: 'uncomputable', detail: difference.detail };

  if (consolidatedRevenue.value === 0) {
    return {
      kind: 'uncomputable',
      detail: 'Consolidated revenue is zero, so a percentage reconciliation has no denominator.',
    };
  }

  const ratio = Math.abs(difference.figure.value) / Math.abs(consolidatedRevenue.value);

  return {
    kind: 'ok',
    reconciliation: {
      segmentRevenueTotal: total.figure,
      consolidatedRevenue,
      difference: difference.figure,
      ratio,
      tolerance: REVENUE_RECONCILIATION_TOLERANCE,
      withinTolerance: ratio <= REVENUE_RECONCILIATION_TOLERANCE,
      unallocated,
    },
  };
}

export interface TrunkInput {
  readonly segmentOperatingIncome: readonly Figure[];
  readonly consolidatedOperatingIncome: Figure | null;
  readonly netEarnings: Figure;
  /** Reported items between operating income and net earnings, already signed. */
  readonly components: readonly Constriction[];
}

export type TrunkResult =
  | { readonly kind: 'ok'; readonly trunk: TrunkConstriction }
  | { readonly kind: 'uncomputable'; readonly detail: string };

/**
 * Builds the trunk constriction (D16).
 *
 * `residual` is segment operating income less consolidated net earnings: the
 * amount the rivers lose after they merge. `components` are the reported items
 * that explain it, each signed as a reduction — income tax expense reduces,
 * non-operating income increases, so a non-operating gain enters as a negative
 * reduction. `unexplained` is the residual less the components, and it is kept
 * on the object even when it is zero, because a reader is entitled to see that
 * it is zero rather than take it on trust.
 *
 * `fullyExplained` compares the unexplained amount against the rounding slack
 * the filer's own `decimals` implies, not against an arbitrary epsilon: figures
 * reported to the million cannot be reconciled more finely than the million.
 */
export function composeTrunkConstriction(input: TrunkInput): TrunkResult {
  const total = sumOfReportedFigures(input.segmentOperatingIncome);

  if (!total.ok) return { kind: 'uncomputable', detail: total.detail };

  const residual = differenceOfReportedFigures(total.figure, input.netEarnings);

  if (!residual.ok) return { kind: 'uncomputable', detail: residual.detail };

  const unexplained = reportedBridgeRemainder(
    residual.figure,
    input.components.map((component) => ({
      amount: component.amount,
      direction: component.direction,
    })),
  );

  if (!unexplained.ok) return { kind: 'uncomputable', detail: unexplained.detail };

  const slack = roundingTolerance(unexplained.figure.decimals);

  return {
    kind: 'ok',
    trunk: {
      segmentOperatingIncomeTotal: total.figure,
      consolidatedOperatingIncome: input.consolidatedOperatingIncome,
      netEarnings: input.netEarnings,
      residual: residual.figure,
      components: input.components,
      unexplained: unexplained.figure,
      fullyExplained: Math.abs(unexplained.figure.value) <= slack,
    },
  };
}

/**
 * Whether a segment's disclosed costs carry its revenue down to its reported
 * profit. A non-zero residual means the filer's disclosed categories are not the
 * whole reduction — common, and honest to say so. It is never folded into a
 * constriction, because a constriction's width is a quantitative claim
 * (Invariant 3.1) and widening one to close an arithmetic gap would be drawing
 * an invented number to scale.
 */
export function bridgeSegment(
  revenue: Figure,
  costs: readonly Figure[],
  profit: Figure,
): DerivationOutcome {
  const totalCost = costs.length === 0 ? null : sumOfReportedFigures(costs);

  if (totalCost !== null && !totalCost.ok) return totalCost;

  const afterCosts =
    totalCost === null
      ? { ok: true as const, figure: revenue }
      : differenceOfReportedFigures(revenue, totalCost.figure);

  if (!afterCosts.ok) return afterCosts;

  return differenceOfReportedFigures(afterCosts.figure, profit);
}
