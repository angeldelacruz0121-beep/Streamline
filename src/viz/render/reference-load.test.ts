import { describe, expect, it } from 'vitest';
import { usdFromMillions } from '../scales';
import {
  MSFT_FY2026_NET_EARNINGS_USD,
  MSFT_FY2026_RESIDUAL_COMPONENTS,
  MSFT_FY2026_SEGMENTS,
  MSFT_FY2026_SOURCE,
  composeOrThrow,
  microsoftFy2026,
  referenceLoad,
} from './reference-load';

/**
 * The transcription is checked, not trusted. Decision 0016 exists because a figure in this
 * project was wrong once already, and a fixture that quietly disagrees with the filing is
 * exactly how that happens twice.
 */
describe('Microsoft FY2026 — transcription checks', () => {
  it('cites the accession the figures came from', () => {
    expect(MSFT_FY2026_SOURCE.accession).toBe('0001193125-26-323660');
    expect(MSFT_FY2026_SOURCE.cik).toBe('0000789019');
  });

  it('reconciles every segment exactly: revenue − costs = operating income', () => {
    for (const segment of MSFT_FY2026_SEGMENTS) {
      const costs = segment.costs.reduce((sum, cost) => sum + cost.amountUsd, 0);
      expect(segment.revenueUsd - costs).toBe(segment.operatingIncomeUsd);
    }
  });

  it('sums to the consolidated figures in STATUS.md', () => {
    const revenue = MSFT_FY2026_SEGMENTS.reduce((sum, s) => sum + s.revenueUsd, 0);
    const operating = MSFT_FY2026_SEGMENTS.reduce((sum, s) => sum + s.operatingIncomeUsd, 0);
    expect(revenue).toBe(usdFromMillions(331_839));
    expect(operating).toBe(usdFromMillions(155_237));
    expect(MSFT_FY2026_NET_EARNINGS_USD).toBe(usdFromMillions(133_749));
    expect(operating - MSFT_FY2026_NET_EARNINGS_USD).toBe(usdFromMillions(21_488));
  });

  it('itemises the residual into two reported facts with nothing unexplained', () => {
    const total = MSFT_FY2026_RESIDUAL_COMPONENTS.reduce((sum, c) => sum + c.amountUsd, 0);
    expect(total).toBe(usdFromMillions(21_488));
    expect(MSFT_FY2026_RESIDUAL_COMPONENTS.map((c) => c.id)).toEqual([
      'us-gaap:IncomeTaxExpenseBenefit',
      'us-gaap:NonoperatingIncomeExpense',
    ]);
  });

  it('composes without a single refusal', () => {
    const model = composeOrThrow(microsoftFy2026());
    expect(model.rivers).toHaveLength(3);
    expect(model.collapsed).toBeNull();
    expect(model.trunk.arrivingWidthPx).toBeCloseTo(155.237, 6);
    expect(model.trunk.constriction.removedWidthPx).toBeCloseTo(21.488, 6);
    expect(model.trunk.departingWidthPx).toBeCloseTo(133.749, 6);
    expect(model.lake.planAreaPx2).toBeCloseTo(133_749, 6);
    expect(model.trunk.itemization.provided).toBe(true);
  });
});

describe('the 12-segment reference load', () => {
  it('repeats real segments rather than inventing any', () => {
    const input = referenceLoad(12);
    expect(input.segments).toHaveLength(12);
    const realRevenues = new Set(MSFT_FY2026_SEGMENTS.map((s) => s.revenueUsd));
    for (const segment of input.segments) {
      expect(realRevenues.has(segment.revenueUsd)).toBe(true);
    }
  });

  it('still conserves exactly at four times the scale', () => {
    const input = referenceLoad(12);
    const operating = input.segments.reduce((sum, s) => sum + s.operatingIncomeUsd, 0);
    expect(operating).toBe(usdFromMillions(155_237) * 4);
    expect(input.netEarningsUsd).toBe(usdFromMillions(133_749) * 4);
    const residual = (input.residualComponents ?? []).reduce((sum, c) => sum + c.amountUsd, 0);
    expect(operating - input.netEarningsUsd).toBeCloseTo(residual, 6);
  });

  it('labels itself as a perf load, so it cannot be mistaken for a filer', () => {
    expect(referenceLoad(12).fiscalPeriodLabel).toContain('perf reference load');
    expect(referenceLoad(12).segments[3]?.label).toContain('repeat');
  });

  it('composes to eight visible lanes plus one aggregate under the 3.7 cap', () => {
    const model = composeOrThrow(referenceLoad(12));
    expect(model.rivers).toHaveLength(9);
    expect(model.rivers.filter((r) => r.aggregated)).toHaveLength(1);
    expect(model.collapsed?.count).toBe(4);
  });

  it('keeps lake area identical whether the remainder is collapsed or not — 3.7', () => {
    const capped = composeOrThrow(referenceLoad(12));
    const three = composeOrThrow(referenceLoad(3));
    // Four repeats of the same filer: four times the earnings, four times the area, and
    // the collapse of four segments behind "More" moved none of it.
    expect(capped.lake.planAreaPx2).toBeCloseTo(three.lake.planAreaPx2 * 4, 6);
    expect(capped.trunk.arrivingWidthPx).toBeCloseTo(three.trunk.arrivingWidthPx * 4, 6);
  });
});
