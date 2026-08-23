// @vitest-environment node
/**
 * Rivers and their filer-shaped cost constrictions. Invariants 3.1, 3.2; decision 0005.
 *
 * NOTE ON THE NUMBERS. Microsoft's segment REVENUES were not available to this session —
 * Ledger is extracting them — so the quantities below are probe values exercising a pure
 * function, not any company's figures, and nothing here claims to be reported data. The
 * real revenues drop in with no change to any function under test, because every function
 * here takes quantities rather than a company.
 */
import { describe, expect, it } from 'vitest';
import { usdFromBillions, widthPx } from '../scales';
import { composeRiver, type RiverInput } from './river';
import { CONSTRICTION_SPAN_PX } from './types';

/** Two disclosed cost categories — the shape Microsoft's disclosure produces (0005). */
const twoCategories: RiverInput = {
  id: 'probe-two',
  label: 'Probe segment, two disclosed cost categories',
  revenueUsd: usdFromBillions(100),
  costs: [
    { id: 'cost-of-revenue', label: 'Cost of revenue', amountUsd: usdFromBillions(19) },
    { id: 'operating-expenses', label: 'Operating expenses', amountUsd: usdFromBillions(41) },
  ],
  operatingIncomeUsd: usdFromBillions(40),
};

/** One disclosed category — the shape Oracle's and Intuit's disclosure produces (0005). */
const oneCategory: RiverInput = {
  id: 'probe-one',
  label: 'Probe segment, one combined expense line',
  revenueUsd: usdFromBillions(100),
  costs: [{ id: 'combined-expense', label: 'Combined expense', amountUsd: usdFromBillions(60) }],
  operatingIncomeUsd: usdFromBillions(40),
};

function unwrap<T>(result: { ok: true; value: T } | { ok: false; blocked: unknown }): T {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.blocked)}`);
  return result.value;
}

describe('a river narrows by exactly the dollars it loses', () => {
  it('starts at revenue width and ends at operating income width', () => {
    const river = unwrap(composeRiver(twoCategories));
    expect(river.headWidthPx).toBe(100);
    expect(river.mouthWidthPx).toBe(40);
  });

  it('removes width at each constriction equal to that cost on the width scale', () => {
    const river = unwrap(composeRiver(twoCategories));
    const [first, second] = river.constrictions;
    expect(first?.removedWidthPx).toBe(widthPx(usdFromBillions(19)));
    expect(second?.removedWidthPx).toBe(widthPx(usdFromBillions(41)));
    expect(first?.widthBeforePx).toBe(100);
    expect(first?.widthAfterPx).toBeCloseTo(81, 9);
    expect(second?.widthBeforePx).toBeCloseTo(81, 9);
    expect(second?.widthAfterPx).toBeCloseTo(40, 9);
  });

  it('closes symmetrically, half the removed width from each bank', () => {
    const river = unwrap(composeRiver(twoCategories));
    for (const constriction of river.constrictions) {
      expect(constriction.removedPerBankPx * 2).toBeCloseTo(constriction.removedWidthPx, 12);
    }
  });

  it('arrives at the mouth with no drift left over', () => {
    // Any difference here is IEEE754 rounding, not an encoding gap.
    const river = unwrap(composeRiver(twoCategories));
    const last = river.constrictions.at(-1);
    expect(last?.widthAfterPx).toBeCloseTo(river.mouthWidthPx, 9);
  });

  it('gives every constriction the same longitudinal extent, so length encodes nothing', () => {
    const river = unwrap(composeRiver(twoCategories));
    for (const constriction of river.constrictions) {
      expect(constriction.spanPx).toBe(CONSTRICTION_SPAN_PX);
    }
  });

  it('carries a required dollar annotation on every constriction (0002 C2)', () => {
    const river = unwrap(composeRiver(twoCategories));
    for (const constriction of river.constrictions) {
      expect(constriction.annotation.required).toBe(true);
      expect(constriction.annotation.valueUsd).toBe(constriction.costUsd);
      expect(constriction.annotation.dimensionedWidthPx).toBe(constriction.removedWidthPx);
    }
  });
});

describe('the constriction set is filer-shaped — decision 0005', () => {
  it('renders exactly the categories disclosed, no more and no fewer', () => {
    expect(unwrap(composeRiver(twoCategories)).constrictions).toHaveLength(2);
    expect(unwrap(composeRiver(oneCategory)).constrictions).toHaveLength(1);
  });

  it('reaches the same mouth width from a different disclosure depth', () => {
    // Same revenue, same operating income, different taxonomy. Invariant 3.1 requires the
    // geometry that carries a financial claim to be identical; only the count differs.
    const deep = unwrap(composeRiver(twoCategories));
    const shallow = unwrap(composeRiver(oneCategory));
    expect(deep.headWidthPx).toBe(shallow.headWidthPx);
    expect(deep.mouthWidthPx).toBe(shallow.mouthWidthPx);
    expect(deep.disclosure.costCategoriesDisclosed).toBe(2);
    expect(shallow.disclosure.costCategoriesDisclosed).toBe(1);
  });

  it('marks the count as requiring a label, per Invariant 3.2', () => {
    expect(unwrap(composeRiver(oneCategory)).disclosure.labelRequired).toBe(true);
  });

  it('does not mark a filer-shaped river as aggregated', () => {
    expect(unwrap(composeRiver(twoCategories)).aggregated).toBe(false);
  });
});

describe('the river refuses rather than approximating', () => {
  it('blocks when disclosed costs and operating income do not reconcile to revenue', () => {
    const result = composeRiver({ ...twoCategories, operatingIncomeUsd: usdFromBillions(45) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blocked[0]?.code).toBe('segment-does-not-reconcile');
    expect(result.blocked[0]?.escalation).toBe('D18');
    expect(result.blocked[0]?.amountUsd).toBeCloseTo(-usdFromBillions(5), 0);
  });

  it('accepts a stated tolerance rather than inventing one', () => {
    const nudged: RiverInput = {
      ...oneCategory,
      operatingIncomeUsd: oneCategory.operatingIncomeUsd + 400_000,
    };
    expect(composeRiver(nudged).ok).toBe(false);
    expect(composeRiver(nudged, 500_000).ok).toBe(true);
  });

  it('blocks a segment operating loss instead of clamping the river to zero width', () => {
    const result = composeRiver({
      id: 'probe-loss',
      label: 'Probe segment at an operating loss',
      revenueUsd: usdFromBillions(10),
      costs: [{ id: 'cost', label: 'Cost', amountUsd: usdFromBillions(14) }],
      operatingIncomeUsd: -usdFromBillions(4),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blocked.map((reason) => reason.code)).toContain('segment-operating-loss');
    expect(result.blocked.find((r) => r.code === 'segment-operating-loss')?.escalation).toContain(
      'metaphor break',
    );
  });

  it('blocks a negative cost, which would widen a river mid-course', () => {
    const result = composeRiver({
      ...oneCategory,
      costs: [
        { id: 'a', label: 'A', amountUsd: usdFromBillions(70) },
        { id: 'b', label: 'B', amountUsd: -usdFromBillions(10) },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blocked.find((r) => r.code === 'negative-cost')?.escalation).toBe('Q2');
  });
});

describe('the river is a pure function of its quantities', () => {
  it('produces identical geometry for identical dollars, whatever the label or id', () => {
    const left = unwrap(composeRiver(oneCategory));
    const right = unwrap(
      composeRiver({ ...oneCategory, id: 'other-filer-segment', label: 'A different company' }),
    );
    expect(right.headWidthPx).toBe(left.headWidthPx);
    expect(right.mouthWidthPx).toBe(left.mouthWidthPx);
    expect(right.constrictions[0]?.removedWidthPx).toBe(left.constrictions[0]?.removedWidthPx);
  });

  it('does not mutate its input', () => {
    const snapshot = JSON.stringify(twoCategories);
    composeRiver(twoCategories);
    expect(JSON.stringify(twoCategories)).toBe(snapshot);
  });
});
