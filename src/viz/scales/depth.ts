/**
 * Basin depth. Invariant 3.4; decision 0006 (D13).
 *
 * THE BASIN IS AS DEEP AS A RIVER CARRYING THE SAME DOLLARS IS WIDE.
 *
 * 3.4 requires depth to be linear in the magnitude of the loss "on its own documented
 * scale", while kill-list K12 forbids that scale from being a free constant chosen
 * because it looks right, and forbids it having a second on-screen indicator. Those two
 * are satisfiable together in exactly one clean way: depth is px per dollar and width is
 * px per dollar, so their ratio is DIMENSIONLESS and can be set to 1 by a stated
 * identity rather than by eye. There is no free parameter here to tune, and the width
 * scale indicator already documents the constant, so no second indicator appears.
 *
 * Contrast this with the depth-versus-area question 0006 dissolved: THAT ratio has units
 * of pixels and cannot be pinned without inventing a reference length. This one can.
 *
 * Depth is a REDUNDANT channel per 0006 — it reinforces the number, it does not carry
 * it. Plan area carries the magnitude. No volumetric shading may be derived from depth
 * (3.4, kill-list K13): volume would grow as the square of the magnitude.
 *
 * Worked: a -$133,749M year renders a basin 133.749px deep below the shoreline plane.
 */
import type { ScaleManifestEntry } from './manifest';
import { assertFinite, type Usd } from './units';
import { WIDTH_PX_PER_USD, WIDTH_USD_PER_PX } from './width';

/** Pinned to the width constant by the identity above. Not independently tunable. */
export const DEPTH_USD_PER_PX = WIDTH_USD_PER_PX;
export const DEPTH_PX_PER_USD = WIDTH_PX_PER_USD;

/**
 * Depth below the shoreline plane. Domain: all finite dollars; a non-negative result
 * (a lake, not a basin) has zero depth below grade. Range: [0, inf) px.
 */
export function basinDepthPx(netEarningsUsd: Usd): number {
  assertFinite(netEarningsUsd, 'net earnings');
  if (netEarningsUsd >= 0) return 0;
  return Math.abs(netEarningsUsd) / DEPTH_USD_PER_PX;
}

export const DEPTH_SCALE: ScaleManifestEntry = {
  id: 'depth',
  meaning:
    'A basin is as deep as a river carrying the same dollars is wide — one pixel per billion lost.',
  domain: 'Consolidated net earnings in dollars. Zero depth for any result at or above zero.',
  range: 'Pixels below the shoreline plane, 0 or greater.',
  constant: '1 px = $1,000,000,000, pinned by identity to the width scale',
  linear: true,
  misreading: {
    wrongConclusion:
      'That the hole is a permanent condition — "this company is $10B in the hole" — which is a ' +
      'balance-sheet reading of one period of flow; or that a deep basin means a bigger loss than ' +
      'a wide one, treating depth as a second magnitude.',
    defense:
      'The period is labelled on the rim and changing the period visibly re-fills or re-drains ' +
      'the basin (0006). Plan area carries the magnitude on the 3.3 constant; depth is redundant ' +
      'reinforcement of the same number, and no volumetric cue is derived from it (K13).',
  },
};
