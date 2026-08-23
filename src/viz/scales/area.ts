/**
 * The area scale. Invariants 3.3 and 3.4; decision 0006 (D13).
 *
 * ONE SQUARE PIXEL OF WATER SURFACE IS ONE MILLION DOLLARS OF NET EARNINGS.
 * A 100 x 100 px square is $10 billion.
 *
 * Where the constant comes from, so that it is a derivation and not a preference: the
 * smallest result Streamline commits to rendering as a visible body of water is $100M,
 * and "visible" is taken as a 10px equivalent diameter. pi * 5^2 = 78.5 px^2, giving
 * $1.27M per px^2, rounded to the nearest stateable decimal constant, $1M. It is chosen
 * against a legibility floor at the small end, which is what the constant is for, and
 * *not* against how the lake composes next to the trunk — that is kill-list K3.
 *
 * SIGNED, ONCE. Decision 0006: a -$10B basin and a +$10B lake occupy the same plan area
 * on this same constant. `planAreaPx2` therefore takes the magnitude. Sign is carried by
 * `waterSign` and rendered by non-size cues, per 3.4, and never by colour alone (3.10).
 *
 * Verified against the real slice, Microsoft FY2026: net income $133,749M
 * -> 133,749 px^2 -> a 206.33px equivalent radius, a 412.67px equivalent diameter.
 *
 * ---------------------------------------------------------------------------
 * Q1 SEAM — READ BEFORE USING THIS MODULE NEXT TO `width.ts`.
 *
 * AREA_PX2_PER_USD divided by WIDTH_PX_PER_USD is 1e-6 / 1e-9 = 1000, and its unit is
 * pixels. That length is a pure artefact of two independently derived constants. It has
 * no financial meaning, nothing in the invariants pins it, and it MUST NOT be used to
 * decide how large the lake looks next to the arriving trunk. Doing so puts arbitrary
 * geometry on the channel a beginner reads first, which is an Invariant 3.6 breach and
 * is killed at kill-list K3. The question is open as `docs/product/open-questions.md`
 * Q1 and is Angel's to answer. `encoding/lake.ts` exposes the junction as an
 * unresolved value rather than a default, so nothing downstream can inherit a guess.
 * ---------------------------------------------------------------------------
 */
import type { ScaleManifestEntry } from './manifest';
import { assertFinite, assertNonNegative, USD_PER_MILLION, type Usd } from './units';

/** Dollars represented by one square pixel of water-surface plan area. */
export const AREA_USD_PER_PX2 = USD_PER_MILLION;

/** Square pixels of plan area per dollar. The 3.3 constant. */
export const AREA_PX2_PER_USD = 1 / AREA_USD_PER_PX2;

/** Which body of water a signed net-earnings figure produces. */
export type WaterSign = 'lake' | 'drained-basin' | 'dry';

/**
 * Plan area for a signed net-earnings figure. Domain: all finite dollars, either sign.
 * Range: [0, inf) px^2. Equal magnitudes of either sign return the identical area —
 * decision 0006, and test record 0001 condition C5.
 */
export function planAreaPx2(netEarningsUsd: Usd): number {
  assertFinite(netEarningsUsd, 'net earnings');
  // Division by the exactly-representable 10^6, for the reason given in `width.ts`.
  return Math.abs(netEarningsUsd) / AREA_USD_PER_PX2;
}

/**
 * The radius of the circle with this plan area.
 *
 * The lake's actual silhouette is Atelier's (section 5, naturalism): any closed shape is
 * permitted so long as its enclosed area equals `planAreaPx2`. This function exists so
 * that the scale indicator and the legibility check have one canonical length to reason
 * about, not to mandate a circular lake.
 */
export function equivalentDiscRadiusPx(areaPx2: number): number {
  assertNonNegative(areaPx2, 'plan area');
  return Math.sqrt(areaPx2 / Math.PI);
}

/** Convenience: magnitude straight to equivalent radius. */
export function equivalentDiscRadiusForUsd(netEarningsUsd: Usd): number {
  return equivalentDiscRadiusPx(planAreaPx2(netEarningsUsd));
}

/** Inverse. Lets a test recover the dollars a rendered area claims. */
export function usdMagnitudeFromPlanAreaPx2(areaPx2: number): Usd {
  assertNonNegative(areaPx2, 'plan area');
  return areaPx2 * AREA_USD_PER_PX2;
}

export function waterSign(netEarningsUsd: Usd): WaterSign {
  assertFinite(netEarningsUsd, 'net earnings');
  if (netEarningsUsd > 0) return 'lake';
  if (netEarningsUsd < 0) return 'drained-basin';
  return 'dry';
}

export const AREA_SCALE: ScaleManifestEntry = {
  id: 'area',
  meaning: 'One square pixel of water surface is one million dollars the company kept this period.',
  domain: 'Consolidated net earnings in dollars, either sign. Magnitude is what the area carries.',
  range:
    'Square pixels of plan area, 0 or greater. Same constant for a lake and for a drained basin.',
  constant: '1 px² = $1,000,000  (a 100 × 100 px square = $10,000,000,000)',
  linear: true,
  misreading: {
    wrongConclusion:
      'That the lake is a stock of money the company holds, and that a lake twice as large means ' +
      'twice the earnings — area is perceived at an exponent near 0.7, so a doubling reads as ' +
      'about 1.6x.',
    defense:
      'The exact figure renders as persistent text beside the water (0001 C2) and the fiscal ' +
      'period is labelled on the water itself (0001 C3), so magnitude is read from the number and ' +
      'the period is unmistakable. The scale stays linear; perceptual correction is killed at K4 ' +
      'because a corrected area makes the 3.3 scale indicator false.',
  },
};
