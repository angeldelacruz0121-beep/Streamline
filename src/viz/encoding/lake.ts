/**
 * The lake, and the drained basin. Invariants 3.3, 3.4, 3.10, 3.11; decision 0006 (D13).
 *
 * This is the file the product was missing: the lake rendered as a static ellipse
 * regardless of input. Here, plan area is the 3.3 area constant applied to consolidated
 * net earnings, one constant for both signs, so a -$10B basin and a +$10B lake occupy the
 * same footprint and are read through the same perceptual channel.
 *
 * Three of test record 0001's conditions are structural in this file rather than left to
 * whoever renders it:
 *   C2 — `netEarningsReadout` is a required field, not an optional one, and is marked
 *        persistent. The analyst's path to this number does not route through area.
 *   C3 — `fiscalPeriodLabel` is a required argument. Compose without one and the function
 *        refuses. A water body with no period invites the balance-sheet read that 0006
 *        names, and the defence is symmetric across a filled lake and a drained basin.
 *   C5 — the area constant is defined once, signed. Asserted by test.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO: place the lake. See `junction` below.
 */
import { basinDepthPx, equivalentDiscRadiusPx, planAreaPx2, waterSign, type Usd } from '../scales';
import { blocked, ok, type EncodingResult } from './blocked';
import type { LakeGeometry, UnresolvedJunction } from './types';

export interface LakeInput {
  readonly netEarningsUsd: Usd;
  /** Required. Test record 0001 C3 and decision 0006. */
  readonly fiscalPeriodLabel: string;
}

/**
 * The Q1 seam, as a value. Every composed lake carries it, so the junction cannot be
 * rendered by accident and no default can harden into a decision while nobody is looking.
 */
export const UNRESOLVED_JUNCTION: UnresolvedJunction = {
  resolved: false,
  blockedBy: 'Q1',
  question:
    'What rule fixes the lake size against the arriving trunk width, given that width is px per ' +
    'dollar and area is px squared per dollar and no invariant relates them?',
  forbidden: [
    'Deriving a placement from the ratio of the two scale constants. That ratio is 1000px and has ' +
      'no financial meaning.',
    'Choosing a lake diameter that composes against the trunk. Kill-list K3, Invariant 3.6.',
    'Setting the lake mouth equal to the trunk width. Dimensionally broken: with a fixed shape, ' +
      'area would then grow as the square of net earnings and 3.3 would fail.',
  ],
};

export function composeLake(input: LakeInput): EncodingResult<LakeGeometry> {
  if (input.fiscalPeriodLabel.trim().length === 0) {
    return blocked([
      {
        code: 'missing-fiscal-period',
        subject: 'lake',
        message:
          'A water body with no period label reads as a stock of money rather than one period of ' +
          'flow. Test record 0001 C3 makes the label mandatory on a filled lake, not only on a ' +
          'drained basin.',
        escalation: null,
        amountUsd: null,
      },
    ]);
  }

  const sign = waterSign(input.netEarningsUsd);
  const areaPx2 = planAreaPx2(input.netEarningsUsd);
  const radiusPx = equivalentDiscRadiusPx(areaPx2);

  return ok({
    waterBody: sign,
    netEarningsUsd: input.netEarningsUsd,
    planAreaPx2: areaPx2,
    equivalentDiscRadiusPx: radiusPx,
    equivalentDiscDiameterPx: radiusPx * 2,
    depthBelowShorelinePx: basinDepthPx(input.netEarningsUsd),
    silhouetteConstraint:
      'Any closed shape whose enclosed plan area equals planAreaPx2. The outline belongs to Atelier; ' +
      'the area is the quantitative claim and may not be adjusted for composition.',
    netEarningsReadout: {
      usd: input.netEarningsUsd,
      persistent: true,
      tabularNumerals: true,
    },
    fiscalPeriodLabel: input.fiscalPeriodLabel,
    // Invariant 3.4 and 3.10. Equal magnitudes of either sign now produce equally sized
    // shapes, so sign must be carried unmistakably by cues that are not size and not colour.
    signCues: sign === 'drained-basin' ? ['dry-floor', 'rim-treatment', 'label'] : ['label'],
    volumetricShadingForbidden: true,
    junction: UNRESOLVED_JUNCTION,
  });
}
