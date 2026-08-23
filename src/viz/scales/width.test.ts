// @vitest-environment node
/**
 * The width scale. Invariants 3.1 and 3.2.
 *
 * Real figures throughout: Microsoft FY2026, accession 0001193125-26-323660.
 */
import { describe, expect, it } from 'vitest';
import { ScaleDomainError, usdFromBillions, usdFromMillions } from './units';
import {
  removedPerBankPx,
  removedWidthPx,
  usdFromWidthPx,
  widthPx,
  WIDTH_SCALE,
  WIDTH_USD_PER_PX,
} from './width';

const MSFT = {
  productivity: usdFromMillions(83_879),
  intelligentCloud: usdFromMillions(56_972),
  morePersonalComputing: usdFromMillions(14_386),
  segmentOperatingIncome: usdFromMillions(155_237),
  netIncome: usdFromMillions(133_749),
  trunkResidual: usdFromMillions(21_488),
};

describe('the width constant', () => {
  it('is one pixel per billion dollars', () => {
    expect(WIDTH_USD_PER_PX).toBe(1_000_000_000);
    expect(widthPx(usdFromBillions(1))).toBe(1);
  });

  it('is linear — doubling the dollars doubles the pixels, at every magnitude', () => {
    for (const usd of [1e6, 1e8, 4.2e9, 1.337e11, 9e11]) {
      expect(widthPx(usd * 2)).toBeCloseTo(widthPx(usd) * 2, 9);
      expect(widthPx(usd * 0.5)).toBeCloseTo(widthPx(usd) * 0.5, 9);
    }
  });

  it('has no offset — zero dollars is zero pixels', () => {
    expect(widthPx(0)).toBe(0);
  });

  it('round-trips through its inverse', () => {
    for (const usd of [0, 1e9, MSFT.netIncome, MSFT.trunkResidual]) {
      expect(usdFromWidthPx(widthPx(usd))).toBeCloseTo(usd, 0);
    }
  });

  it('rejects a negative flow rather than drawing one', () => {
    expect(() => widthPx(-1)).toThrow(ScaleDomainError);
    expect(() => widthPx(Number.NaN)).toThrow(ScaleDomainError);
  });
});

describe('Microsoft FY2026 renders at the widths record 0002 computed', () => {
  it('puts the three segments at 83.879 / 56.972 / 14.386 px', () => {
    expect(widthPx(MSFT.productivity)).toBeCloseTo(83.879, 9);
    expect(widthPx(MSFT.intelligentCloud)).toBeCloseTo(56.972, 9);
    expect(widthPx(MSFT.morePersonalComputing)).toBeCloseTo(14.386, 9);
  });

  it('puts the trunk at 155.237 px and the residual at 21.488 px', () => {
    expect(widthPx(MSFT.segmentOperatingIncome)).toBeCloseTo(155.237, 9);
    expect(removedWidthPx(MSFT.trunkResidual)).toBeCloseTo(21.488, 9);
    expect(removedPerBankPx(MSFT.trunkResidual)).toBeCloseTo(10.744, 9);
  });

  it('keeps the smallest river above the provisional legibility floor', () => {
    // 0002: the binding constraint is the third river, not the trunk. At this constant the
    // third river is 14.386px, above the provisional 12px floor, and the trunk therefore
    // removes 21.488px — far above the provisional 8px step threshold.
    expect(widthPx(MSFT.morePersonalComputing)).toBeGreaterThan(12);
    expect(removedWidthPx(MSFT.trunkResidual)).toBeGreaterThan(8);
  });

  it('reproduces 0002s two ratios exactly', () => {
    const trunk = widthPx(MSFT.segmentOperatingIncome);
    expect((removedWidthPx(MSFT.trunkResidual) / trunk) * 100).toBeCloseTo(13.84, 2);
    expect((widthPx(MSFT.morePersonalComputing) / trunk) * 100).toBeCloseTo(9.27, 2);
  });

  it('removes more absolute width at the trunk than the whole third river carries', () => {
    // The claim record 0002 rests on: as a ratio the trunk pinch is the smallest narrowing
    // on the canvas, and absolutely it is 1.494x the smallest segment's entire operating
    // income. Invariant 3.1 makes the absolute comparison the correct one.
    expect(removedWidthPx(MSFT.trunkResidual)).toBeGreaterThan(widthPx(MSFT.morePersonalComputing));
    expect(MSFT.trunkResidual / MSFT.morePersonalComputing).toBeCloseTo(1.494, 3);
  });
});

describe('Invariant 3.2 — a constriction is on the same scale as a river', () => {
  it('removes exactly the width the same dollars would occupy, for every probe', () => {
    // If this ever fails, kill-list K2 (ratio-normalised constrictions) has crept back in.
    for (const usd of [0, 1, 1e6, 21_488e6, 83_879e6, 5e11]) {
      expect(removedWidthPx(usd)).toBe(widthPx(usd));
      expect(removedPerBankPx(usd) * 2).toBeCloseTo(widthPx(usd), 12);
    }
  });

  it('is independent of how wide the thing being pinched is', () => {
    const cost = usdFromBillions(21.488);
    const narrowRiver = widthPx(usdFromBillions(30));
    const wideRiver = widthPx(usdFromBillions(155.237));
    expect(narrowRiver - removedWidthPx(cost)).toBeCloseTo(
      widthPx(usdFromBillions(30 - 21.488)),
      6,
    );
    expect(wideRiver - removedWidthPx(cost)).toBeCloseTo(widthPx(usdFromBillions(133.749)), 6);
    // Same dollars, same pixels removed, on rivers of very different width.
    expect(removedWidthPx(cost)).toBe(removedWidthPx(cost));
  });
});

describe('the scale documents itself', () => {
  it('states a domain, a range, a meaning, a constant, and its misreading', () => {
    expect(WIDTH_SCALE.id).toBe('width');
    expect(WIDTH_SCALE.linear).toBe(true);
    for (const field of [
      WIDTH_SCALE.meaning,
      WIDTH_SCALE.domain,
      WIDTH_SCALE.range,
      WIDTH_SCALE.constant,
      WIDTH_SCALE.misreading.wrongConclusion,
      WIDTH_SCALE.misreading.defense,
    ]) {
      expect(field.length).toBeGreaterThan(20);
    }
  });
});
