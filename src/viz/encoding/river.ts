/**
 * One river: revenue at the head, filer-shaped cost constrictions along it, segment
 * operating income at the mouth. Invariants 3.1, 3.2; decision 0005 (D11).
 *
 * The cost list is whatever the filer disclosed for that segment, in the order it
 * disclosed them — two constrictions for Microsoft (cost of revenue, then operating
 * expenses), one for Oracle, none for a filer that discloses no segment expense. Nothing
 * is invented to fill a template (kill-list K9) and nothing reported is collapsed away
 * (K10). The count varies between filers and that variation is labelled as disclosure
 * depth rather than read as operational simplicity.
 *
 * The river is a pure function of the quantities passed in. It has no idea which company
 * it belongs to, which is what makes "equal dollars produce equal geometry across two
 * different companies" true by construction rather than by convention.
 *
 * RECONCILIATION IS ENFORCED, NOT ASSUMED. Disclosed costs plus operating income must
 * equal revenue. When they do not, the difference is an unallocated segment remainder
 * that no invariant authorises anything to draw, so the river refuses. That refusal is
 * the mechanical trigger for open decision D18, which the invariants say to escalate on
 * the first failing filer — this is that trip wire, in code, ahead of the filer.
 */
import { removedPerBankPx, removedWidthPx, widthPx, type Usd } from '../scales';
import { blocked, ok, type Blocked, type EncodingResult } from './blocked';
import {
  CONSTRICTION_SPAN_PX,
  type ConstrictionGeometry,
  type RiverGeometry,
  type WidthStation,
} from './types';

export interface DisclosedCost {
  readonly id: string;
  readonly label: string;
  readonly amountUsd: Usd;
}

export interface RiverInput {
  readonly id: string;
  readonly label: string;
  readonly revenueUsd: Usd;
  /** Exactly the categories this filer discloses for this segment, in disclosure order. */
  readonly costs: readonly DisclosedCost[];
  readonly operatingIncomeUsd: Usd;
}

/**
 * Dollars of slack allowed when checking that costs plus operating income equal revenue.
 * Zero by default: Microsoft's segment table ties exactly, and a tolerance that exists
 * "just in case" is how a real discrepancy gets absorbed. A caller with figures at mixed
 * XBRL precision passes the coarsest input's rounding tolerance explicitly.
 */
export const DEFAULT_RECONCILIATION_TOLERANCE_USD = 0;

export function composeRiver(
  input: RiverInput,
  toleranceUsd: number = DEFAULT_RECONCILIATION_TOLERANCE_USD,
): EncodingResult<RiverGeometry> {
  const reasons: Blocked[] = [];

  if (input.revenueUsd < 0) {
    reasons.push({
      code: 'negative-revenue',
      subject: input.id,
      message: `Segment ${input.id} reports negative revenue. There is no river for a negative flow.`,
      escalation: null,
      amountUsd: input.revenueUsd,
    });
  }

  for (const cost of input.costs) {
    if (cost.amountUsd < 0) {
      reasons.push({
        code: 'negative-cost',
        subject: `${input.id}/${cost.id}`,
        message:
          `Cost category ${cost.label} is negative, so the river would widen mid-course. ` +
          `A constriction has no widening behaviour; this is the per-segment sibling of ` +
          `open question Q2 and is not defined.`,
        escalation: 'Q2',
        amountUsd: cost.amountUsd,
      });
    }
  }

  if (input.operatingIncomeUsd < 0) {
    reasons.push({
      code: 'segment-operating-loss',
      subject: input.id,
      message:
        `Segment ${input.id} has negative operating income, so its river would reach the ` +
        `confluence with negative width. Clamping to zero would draw a false number to scale. ` +
        `This is a shape the metaphor does not carry and it is Angel's call, per Cartographer's ` +
        `escalation clause.`,
      escalation: 'metaphor break — segment operating loss',
      amountUsd: input.operatingIncomeUsd,
    });
  }

  const costTotalUsd = input.costs.reduce((sum, cost) => sum + cost.amountUsd, 0);
  const residualUsd = input.revenueUsd - costTotalUsd - input.operatingIncomeUsd;
  if (Math.abs(residualUsd) > toleranceUsd) {
    reasons.push({
      code: 'segment-does-not-reconcile',
      subject: input.id,
      message:
        `Segment ${input.id}: disclosed costs (${costTotalUsd}) plus operating income ` +
        `(${input.operatingIncomeUsd}) differ from revenue (${input.revenueUsd}) by ` +
        `${residualUsd}. Nothing may absorb that silently — Invariant 3.2 renders an ` +
        `unallocated remainder explicitly or not at all. Open decision D18.`,
      escalation: 'D18',
      amountUsd: residualUsd,
    });
  }

  if (reasons.length > 0) return blocked(reasons);

  const headWidthPx = widthPx(input.revenueUsd);
  const stations: WidthStation[] = [
    { id: `${input.id}/head`, kind: 'head', widthPx: headWidthPx, halfWidthPx: headWidthPx / 2 },
  ];
  const constrictions: ConstrictionGeometry[] = [];

  let currentWidthPx = headWidthPx;
  for (const cost of input.costs) {
    const removed = removedWidthPx(cost.amountUsd);
    const after = currentWidthPx - removed;
    stations.push({
      id: `${input.id}/${cost.id}/enter`,
      kind: 'constriction-enter',
      widthPx: currentWidthPx,
      halfWidthPx: currentWidthPx / 2,
    });
    stations.push({
      id: `${input.id}/${cost.id}/exit`,
      kind: 'constriction-exit',
      widthPx: after,
      halfWidthPx: after / 2,
    });
    constrictions.push({
      id: `${input.id}/${cost.id}`,
      label: cost.label,
      kind: 'segment-cost',
      costUsd: cost.amountUsd,
      widthBeforePx: currentWidthPx,
      widthAfterPx: after,
      removedWidthPx: removed,
      removedPerBankPx: removedPerBankPx(cost.amountUsd),
      spanPx: CONSTRICTION_SPAN_PX,
      annotation: { valueUsd: cost.amountUsd, dimensionedWidthPx: removed, required: true },
      // Structurally impossible on a river, and that is why it is a literal null rather
      // than a computed one: the reconciliation above forces costs + operating income =
      // revenue with every term non-negative, so no partial sum of costs can exceed the
      // head width and no river constriction can ever claim more width than it is given.
      // The trunk has no such guarantee — see `closeConstriction` in `trunk.ts`.
      overdraw: null,
      distinctTreatmentRequired: false,
    });
    currentWidthPx = after;
  }

  const mouthWidthPx = widthPx(input.operatingIncomeUsd);
  stations.push({
    id: `${input.id}/mouth`,
    kind: 'mouth',
    widthPx: mouthWidthPx,
    halfWidthPx: mouthWidthPx / 2,
  });

  return ok({
    id: input.id,
    label: input.label,
    revenueUsd: input.revenueUsd,
    operatingIncomeUsd: input.operatingIncomeUsd,
    headWidthPx,
    mouthWidthPx,
    stations,
    constrictions,
    disclosure: { costCategoriesDisclosed: input.costs.length, labelRequired: true },
    aggregated: false,
  });
}
