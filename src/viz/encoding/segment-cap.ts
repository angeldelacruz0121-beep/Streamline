/**
 * The top 5-8 cap and the "More" control. Invariant 3.7; decision D6.
 *
 * "Hidden segments still flow into the lake. The lake always encodes total net earnings
 * across all segments, including those not currently drawn. Collapsing is a display
 * decision, never a data decision."
 *
 * This module only partitions. It decides which segments get their own river and which
 * fall behind "More"; it never touches the trunk or the lake, both of which are computed
 * from the full set in `compose.ts`. That separation is what makes the 3.7 assertion —
 * lake area identical whether "More" is expanded or collapsed — true by construction
 * rather than by a test that happens to pass today.
 *
 * The collapsed segments are still DRAWN, as one aggregate river carrying their combined
 * revenue, their combined cost, and their combined operating income. This is a reading of
 * 3.7 rather than its letter: 3.7 says the remainder collapses behind a control and says
 * nothing about drawing it, but the trunk is computed from every segment, so leaving the
 * remainder undrawn would make the trunk visibly wider than the rivers feeding it and
 * break the conservation the whole picture rests on. The aggregate river is marked
 * `aggregated` and its single constriction is a sum of reported figures across several
 * segments, never a filer-shaped one, so it cannot be mistaken for disclosure.
 */
import type { Usd } from '../scales';
import type { Blocked } from './blocked';
import type { RiverInput } from './river';

export const SEGMENT_DISPLAY_CAP = {
  min: 5,
  max: 8,
  /** Used when a caller does not state one. */
  default: 8,
} as const;

export interface SegmentPartition {
  readonly visible: readonly RiverInput[];
  readonly collapsed: readonly RiverInput[];
}

export function validateDisplayCap(cap: number): Blocked | null {
  if (!Number.isInteger(cap) || cap < SEGMENT_DISPLAY_CAP.min || cap > SEGMENT_DISPLAY_CAP.max) {
    return {
      code: 'display-cap-out-of-range',
      subject: 'display-cap',
      message:
        `Segment display cap must be an integer between ${SEGMENT_DISPLAY_CAP.min} and ` +
        `${SEGMENT_DISPLAY_CAP.max} (Invariant 3.7); received ${String(cap)}.`,
      escalation: null,
      amountUsd: null,
    };
  }
  return null;
}

/**
 * Top `cap` segments by revenue; the rest collapse. Deterministic: revenue descending,
 * ties broken by id ascending, so the same filer produces the same picture every load.
 */
export function partitionSegments(
  segments: readonly RiverInput[],
  cap: number = SEGMENT_DISPLAY_CAP.default,
): SegmentPartition {
  const ordered = [...segments].sort((left, right) => {
    if (right.revenueUsd !== left.revenueUsd) return right.revenueUsd - left.revenueUsd;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });

  if (ordered.length <= cap) {
    return { visible: ordered, collapsed: [] };
  }
  return { visible: ordered.slice(0, cap), collapsed: ordered.slice(cap) };
}

/**
 * The one river standing in for everything behind "More". Every figure in it is a sum of
 * reported figures; nothing is estimated. It carries a single combined constriction
 * because the collapsed segments have different filer-shaped cost categories and merging
 * those taxonomies would invent geometry (kill-list K9).
 */
export function aggregateRiverInput(collapsed: readonly RiverInput[]): RiverInput | null {
  if (collapsed.length === 0) return null;

  const revenueUsd: Usd = collapsed.reduce((sum, segment) => sum + segment.revenueUsd, 0);
  const operatingIncomeUsd: Usd = collapsed.reduce(
    (sum, segment) => sum + segment.operatingIncomeUsd,
    0,
  );

  return {
    id: 'more',
    label: `${collapsed.length} more segments, combined`,
    revenueUsd,
    costs: [
      {
        id: 'combined-cost',
        label: `Combined costs of ${collapsed.length} segments`,
        amountUsd: revenueUsd - operatingIncomeUsd,
      },
    ],
    operatingIncomeUsd,
  };
}
