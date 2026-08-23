// @vitest-environment node
/**
 * The area scale. Invariants 3.3 and 3.4; decision 0006 (D13); test record 0001 C5.
 */
import { describe, expect, it } from 'vitest';
import {
  AREA_SCALE,
  AREA_USD_PER_PX2,
  equivalentDiscRadiusForUsd,
  equivalentDiscRadiusPx,
  planAreaPx2,
  usdMagnitudeFromPlanAreaPx2,
  waterSign,
} from './area';
import { ScaleDomainError, usdFromBillions, usdFromMillions } from './units';
import { WIDTH_USD_PER_PX } from './width';

const MSFT_NET_INCOME = usdFromMillions(133_749);

describe('the area constant', () => {
  it('is one million dollars per square pixel', () => {
    expect(AREA_USD_PER_PX2).toBe(1_000_000);
    expect(planAreaPx2(usdFromMillions(1))).toBe(1);
    // The statement the on-screen legend makes.
    expect(planAreaPx2(usdFromBillions(10))).toBe(100 * 100);
  });

  it('is linear in AREA, not in diameter — doubling the dollars doubles the area', () => {
    for (const usd of [1e7, 1e9, MSFT_NET_INCOME]) {
      expect(planAreaPx2(usd * 2)).toBeCloseTo(planAreaPx2(usd) * 2, 6);
      // and therefore multiplies the radius by sqrt(2), which is the whole point of 3.3.
      expect(equivalentDiscRadiusForUsd(usd * 2) / equivalentDiscRadiusForUsd(usd)).toBeCloseTo(
        Math.SQRT2,
        9,
      );
    }
  });

  it('has no offset and no perceptual correction', () => {
    expect(planAreaPx2(0)).toBe(0);
    // Kill-list K4: a Stevens exponent would show up here as a non-constant ratio.
    const ratios = [1e8, 1e9, 1e10, 1e11].map((usd) => planAreaPx2(usd) / usd);
    for (const ratio of ratios) expect(ratio).toBeCloseTo(ratios[0] as number, 15);
  });

  it('round-trips through its inverse', () => {
    expect(usdMagnitudeFromPlanAreaPx2(planAreaPx2(MSFT_NET_INCOME))).toBeCloseTo(
      MSFT_NET_INCOME,
      0,
    );
  });

  it('rejects a non-finite figure', () => {
    expect(() => planAreaPx2(Number.POSITIVE_INFINITY)).toThrow(ScaleDomainError);
    expect(() => equivalentDiscRadiusPx(-1)).toThrow(ScaleDomainError);
  });
});

describe('test record 0001 C5 — the area constant is defined once, signed', () => {
  it('gives a -$133,749M basin the identical plan area of a +$133,749M lake', () => {
    expect(planAreaPx2(-MSFT_NET_INCOME)).toBe(planAreaPx2(MSFT_NET_INCOME));
    expect(equivalentDiscRadiusForUsd(-MSFT_NET_INCOME)).toBe(
      equivalentDiscRadiusForUsd(MSFT_NET_INCOME),
    );
  });

  it('holds at every magnitude, not just the one Microsoft happens to have', () => {
    for (const usd of [1, 1e6, 1e8, 4.2e10, 9.9e11]) {
      expect(planAreaPx2(-usd)).toBe(planAreaPx2(usd));
    }
  });

  it('is continuous through zero', () => {
    expect(planAreaPx2(-1)).toBeCloseTo(planAreaPx2(1), 15);
    expect(planAreaPx2(0)).toBe(0);
  });

  it('refutes kill-list K11 — a small loss no longer dwarfs a small profit', () => {
    // A fixed-footprint basin would render -$100M at roughly 1,137x the plan area of
    // +$100M. On one signed constant the ratio is exactly 1.
    const hundredMillion = usdFromMillions(100);
    expect(planAreaPx2(-hundredMillion) / planAreaPx2(hundredMillion)).toBe(1);
  });

  it('names the sign without using size', () => {
    expect(waterSign(1)).toBe('lake');
    expect(waterSign(-1)).toBe('drained-basin');
    expect(waterSign(0)).toBe('dry');
  });
});

describe('Microsoft FY2026', () => {
  it('renders net income of $133,749M as 133,749 px2', () => {
    expect(planAreaPx2(MSFT_NET_INCOME)).toBe(133_749);
    expect(equivalentDiscRadiusForUsd(MSFT_NET_INCOME)).toBeCloseTo(206.334, 3);
    expect(equivalentDiscRadiusForUsd(MSFT_NET_INCOME) * 2).toBeCloseTo(412.668, 3);
  });
});

describe('the Q1 seam is left open, not closed by arithmetic', () => {
  it('records that the two constants imply a length with no financial meaning', () => {
    // 1e-6 px2/$ over 1e-9 px/$ = 1000 px. This test exists to pin the number down in one
    // place and to state that it is NOT a placement rule. If a future change makes the lake
    // sit against the trunk, Q1 has been answered by someone who was not authorised to.
    const impliedReferenceLengthPx = 1 / AREA_USD_PER_PX2 / (1 / WIDTH_USD_PER_PX);
    expect(impliedReferenceLengthPx).toBeCloseTo(1000, 9);
  });
});

describe('the scale documents itself', () => {
  it('states a domain, a range, a meaning, a constant, and its misreading', () => {
    expect(AREA_SCALE.id).toBe('area');
    expect(AREA_SCALE.linear).toBe(true);
    for (const field of [
      AREA_SCALE.meaning,
      AREA_SCALE.domain,
      AREA_SCALE.range,
      AREA_SCALE.constant,
      AREA_SCALE.misreading.wrongConclusion,
      AREA_SCALE.misreading.defense,
    ]) {
      expect(field.length).toBeGreaterThan(20);
    }
  });
});
