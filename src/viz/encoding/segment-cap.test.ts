// @vitest-environment node
/**
 * The top 5-8 cap and "More". Invariant 3.7.
 *
 * Probe quantities. No real filer in the v1 cohort has enough segments to exercise the
 * cap, so these are inputs to a pure partition function rather than anyone's figures.
 */
import { describe, expect, it } from 'vitest';
import { usdFromBillions } from '../scales';
import type { RiverInput } from './river';
import {
  aggregateRiverInput,
  partitionSegments,
  SEGMENT_DISPLAY_CAP,
  validateDisplayCap,
} from './segment-cap';

function segment(id: string, revenueBillions: number, marginRatio = 0.4): RiverInput {
  const revenueUsd = usdFromBillions(revenueBillions);
  const operatingIncomeUsd = revenueUsd * marginRatio;
  return {
    id,
    label: id,
    revenueUsd,
    costs: [{ id: 'cost', label: 'Cost', amountUsd: revenueUsd - operatingIncomeUsd }],
    operatingIncomeUsd,
  };
}

const twelve: readonly RiverInput[] = Array.from({ length: 12 }, (_value, index) =>
  segment(`s${String(index).padStart(2, '0')}`, 120 - index * 10),
);

describe('the cap', () => {
  it('accepts only 5 through 8, per Invariant 3.7', () => {
    expect(validateDisplayCap(5)).toBeNull();
    expect(validateDisplayCap(8)).toBeNull();
    expect(validateDisplayCap(4)?.code).toBe('display-cap-out-of-range');
    expect(validateDisplayCap(9)?.code).toBe('display-cap-out-of-range');
    expect(validateDisplayCap(6.5)?.code).toBe('display-cap-out-of-range');
  });

  it('defaults to 8', () => {
    expect(SEGMENT_DISPLAY_CAP.default).toBe(8);
    expect(partitionSegments(twelve).visible).toHaveLength(8);
  });
});

describe('the partition is deterministic', () => {
  it('takes the largest by revenue, descending', () => {
    const { visible, collapsed } = partitionSegments(twelve, 5);
    expect(visible.map((item) => item.id)).toEqual(['s00', 's01', 's02', 's03', 's04']);
    expect(collapsed).toHaveLength(7);
  });

  it('breaks revenue ties by id so the picture does not shuffle between loads', () => {
    const tied = [segment('zebra', 10), segment('alpha', 10), segment('mango', 10)];
    const first = partitionSegments(tied, 5).visible.map((item) => item.id);
    const second = partitionSegments([...tied].reverse(), 5).visible.map((item) => item.id);
    expect(first).toEqual(['alpha', 'mango', 'zebra']);
    expect(second).toEqual(first);
  });

  it('collapses nothing when the filer is inside the cap', () => {
    const three = twelve.slice(0, 3);
    expect(partitionSegments(three, 5).collapsed).toHaveLength(0);
    expect(partitionSegments(three, 5).visible).toHaveLength(3);
  });

  it('does not mutate the input array', () => {
    const order = twelve.map((item) => item.id);
    partitionSegments(twelve, 5);
    expect(twelve.map((item) => item.id)).toEqual(order);
  });
});

describe('the aggregate river is a sum of reported figures, never an estimate', () => {
  it('carries the combined revenue and combined operating income exactly', () => {
    const { collapsed } = partitionSegments(twelve, 5);
    const aggregate = aggregateRiverInput(collapsed);
    expect(aggregate?.revenueUsd).toBe(collapsed.reduce((sum, item) => sum + item.revenueUsd, 0));
    expect(aggregate?.operatingIncomeUsd).toBe(
      collapsed.reduce((sum, item) => sum + item.operatingIncomeUsd, 0),
    );
  });

  it('reconciles by construction — one combined constriction, no invented taxonomy', () => {
    const { collapsed } = partitionSegments(twelve, 5);
    const aggregate = aggregateRiverInput(collapsed);
    expect(aggregate?.costs).toHaveLength(1);
    const costTotal = (aggregate?.costs ?? []).reduce((sum, cost) => sum + cost.amountUsd, 0);
    expect((aggregate?.revenueUsd ?? 0) - costTotal).toBeCloseTo(
      aggregate?.operatingIncomeUsd ?? 0,
      3,
    );
  });

  it('says how many segments it stands for', () => {
    const aggregate = aggregateRiverInput(partitionSegments(twelve, 5).collapsed);
    expect(aggregate?.label).toContain('7 more segments');
  });

  it('is null when nothing collapsed', () => {
    expect(aggregateRiverInput([])).toBeNull();
  });
});
