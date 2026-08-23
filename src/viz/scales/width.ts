/**
 * The width scale. Invariants 3.1 and 3.2.
 *
 * ONE PIXEL OF RIVER WIDTH IS ONE BILLION DOLLARS PER PERIOD.
 *
 * Where the constant comes from, so that it is a derivation and not a preference:
 * a pixel is the smallest width that can render at all, so the constant states the
 * smallest quantity Streamline is willing to draw. One billion dollars is that floor
 * for the v1 technology cohort. Everything else follows linearly and nothing is tuned
 * per company. A segment below a billion dollars is a sub-pixel river and is *reported*
 * as below the legibility floor (see `legibility.ts`), never rescaled — Invariant 3.9.
 *
 * Verified against the real slice, Microsoft FY2026, accession 0001193125-26-323660:
 *
 *   segment operating income   83,879 / 56,972 / 14,386 $M  ->  83.879 / 56.972 / 14.386 px
 *   trunk arriving             155,237 $M                   ->  155.237 px
 *   trunk constriction          21,488 $M                   ->   21.488 px (10.744 per bank)
 *   trunk departing            133,749 $M                   ->  133.749 px
 *
 * That lands inside the legibility band record 0002 computed: the smallest river is
 * 14.4px (above the provisional 12px floor at which 0002 calls a river legible) and the
 * trunk constriction removes 21.488px (well above the provisional 8px step threshold).
 * The binding constraint is the smallest river, exactly as 0002 found.
 *
 * There is no zoom and no fit-to-viewport multiplier in this module, deliberately. Any
 * such multiplier is per-company rescaling wearing a camera's clothes, and 3.1 forbids
 * it. A company that does not fit is reported by `assessCrossAxisFit`, and an
 * accuracy-versus-legibility conflict escalates under protocol section 3.
 */
import type { ScaleManifestEntry } from './manifest';
import { assertNonNegative, USD_PER_BILLION, type Usd } from './units';

/** Dollars represented by one pixel of width. */
export const WIDTH_USD_PER_PX = USD_PER_BILLION;

/** Pixels of width per dollar. The 3.1 constant. */
export const WIDTH_PX_PER_USD = 1 / WIDTH_USD_PER_PX;

/**
 * Width of a flow carrying `usd`. Domain: [0, inf). Range: [0, inf) px.
 * Total width, not half-width — a river is symmetric about its centreline.
 */
export function widthPx(usd: Usd): number {
  assertNonNegative(usd, 'flow magnitude');
  // Division by the exactly-representable 10^9, not multiplication by an inexact 10^-9:
  // it makes $155,237M land on the nearest double to 155.237 rather than an ulp away.
  return usd / WIDTH_USD_PER_PX;
}

/**
 * Invariant 3.2: the reduction at a bottleneck is on the same scale as 3.1. Not "the
 * same kind of scale" — the same function. This alias exists so that call sites read
 * correctly and so that a test can assert the two are behaviourally identical for every
 * probe value. If these ever diverge, kill-list K2 (ratio-normalised constrictions) has
 * crept back in.
 */
export function removedWidthPx(costUsd: Usd): number {
  return widthPx(costUsd);
}

/** Half of `removedWidthPx` — a symmetric constriction closes in from both banks. */
export function removedPerBankPx(costUsd: Usd): number {
  return removedWidthPx(costUsd) / 2;
}

/** Inverse. Lets a test recover the dollars a rendered width claims. */
export function usdFromWidthPx(px: number): Usd {
  assertNonNegative(px, 'width');
  return px * WIDTH_USD_PER_PX;
}

export const WIDTH_SCALE: ScaleManifestEntry = {
  id: 'width',
  meaning: 'One pixel of river width is one billion dollars flowing in this period.',
  domain: 'Dollars per period, 0 or greater. Revenue at the head, operating income at the mouth.',
  range:
    'Pixels of total river width, 0 or greater. Unbounded above; overflow is reported, never rescaled.',
  constant: '1 px = $1,000,000,000',
  linear: true,
  misreading: {
    wrongConclusion:
      'That a thin river means an unimportant business rather than a smaller one, and that a ' +
      'narrow-looking pinch on a wide trunk removed less money than a wide-looking pinch on a ' +
      'narrow river.',
    defense:
      'One constant governs every width and every constriction on the canvas, so pixels removed ' +
      'are proportional to dollars removed regardless of what is being pinched. Ratio salience is ' +
      'answered by annotating the dollar figure at the constriction (0002 C2), never by resizing ' +
      'the pinch (kill-list K1) or normalising it (K2).',
  },
};
