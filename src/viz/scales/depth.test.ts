// @vitest-environment node
/**
 * Basin depth. Invariant 3.4; decision 0006; kill-list K12 and K13.
 */
import { describe, expect, it } from 'vitest';
import { planAreaPx2 } from './area';
import { basinDepthPx, DEPTH_SCALE, DEPTH_USD_PER_PX } from './depth';
import { usdFromBillions, usdFromMillions } from './units';
import { widthPx, WIDTH_USD_PER_PX } from './width';

describe('the depth constant', () => {
  it('is pinned to the width constant by identity, leaving no free parameter', () => {
    // Kill-list K12: an independently chosen depth constant would be chosen because it
    // looks right. Depth and width are both px per dollar, so their ratio is dimensionless
    // and can be set to 1 by a stated rule instead.
    expect(DEPTH_USD_PER_PX).toBe(WIDTH_USD_PER_PX);
    expect(basinDepthPx(-usdFromBillions(42))).toBe(widthPx(usdFromBillions(42)));
  });

  it('is linear in the magnitude of the loss', () => {
    expect(basinDepthPx(-usdFromBillions(20))).toBeCloseTo(
      2 * basinDepthPx(-usdFromBillions(10)),
      9,
    );
    expect(basinDepthPx(-usdFromMillions(133_749))).toBeCloseTo(133.749, 9);
  });

  it('is zero for any result at or above zero', () => {
    expect(basinDepthPx(0)).toBe(0);
    expect(basinDepthPx(usdFromBillions(133.749))).toBe(0);
  });

  it('stays a redundant channel — area still carries the magnitude', () => {
    // Depth grows linearly and area grows linearly, so their ratio is not constant. That
    // is expected and is why 0006 demotes depth: the magnitude claim lives in the area.
    const small = -usdFromBillions(1);
    const large = -usdFromBillions(100);
    expect(basinDepthPx(large) / basinDepthPx(small)).toBeCloseTo(100, 9);
    expect(planAreaPx2(large) / planAreaPx2(small)).toBeCloseTo(100, 9);
    // Kill-list K13: nothing here exposes a volume, which would grow as the square.
    expect(Object.keys({ basinDepthPx })).not.toContain('volume');
  });
});

describe('the scale documents itself', () => {
  it('states a domain, a range, a meaning, a constant, and its misreading', () => {
    expect(DEPTH_SCALE.id).toBe('depth');
    expect(DEPTH_SCALE.linear).toBe(true);
    for (const field of [
      DEPTH_SCALE.meaning,
      DEPTH_SCALE.domain,
      DEPTH_SCALE.range,
      DEPTH_SCALE.constant,
      DEPTH_SCALE.misreading.wrongConclusion,
      DEPTH_SCALE.misreading.defense,
    ]) {
      expect(field.length).toBeGreaterThan(20);
    }
  });
});
