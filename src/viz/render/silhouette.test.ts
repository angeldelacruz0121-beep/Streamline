import { describe, expect, it } from 'vitest';
import { planAreaPx2, usdFromMillions } from '../scales';
import { lakeOutline, outlineBounds, pointInPolygon, polygonArea } from './silhouette';

describe('lake silhouette', () => {
  it('encloses exactly the plan area it was asked for', () => {
    for (const areaPx2 of [1, 78.5, 1_000, 133_749, 5_000_000]) {
      const outline = lakeOutline({ x: 0, y: 0 }, areaPx2);
      expect(polygonArea(outline) / areaPx2).toBeCloseTo(1, 9);
    }
  });

  it('encloses Microsoft FY2026 net earnings on the 3.3 constant', () => {
    // 133,749 px^2, straight off `area.ts`. The silhouette may be any closed shape; the
    // area is the quantitative claim and this is the assertion that it survived drawing.
    const areaPx2 = planAreaPx2(usdFromMillions(133_749));
    expect(areaPx2).toBe(133_749);
    expect(polygonArea(lakeOutline({ x: 400, y: 300 }, areaPx2))).toBeCloseTo(133_749, 3);
  });

  it('is the same shape at every size, so shape carries no information', () => {
    // Normalise both outlines about their centre and compare. If the shape varied with
    // the quantity it would be an undocumented channel — Invariant 3.6.
    const small = lakeOutline({ x: 0, y: 0 }, 1_000);
    const large = lakeOutline({ x: 0, y: 0 }, 4_000);
    const ratio = Math.sqrt(4_000 / 1_000);
    for (let i = 0; i < small.length; i += 1) {
      expect((large[i] as { x: number }).x).toBeCloseTo((small[i] as { x: number }).x * ratio, 6);
      expect((large[i] as { y: number }).y).toBeCloseTo((small[i] as { y: number }).y * ratio, 6);
    }
  });

  it('is deterministic — two loads produce identical vertices', () => {
    expect(lakeOutline({ x: 12, y: 34 }, 9_000)).toEqual(lakeOutline({ x: 12, y: 34 }, 9_000));
  });

  it('is empty at zero area rather than a degenerate dot', () => {
    expect(lakeOutline({ x: 0, y: 0 }, 0)).toEqual([]);
  });

  it('refuses a negative area', () => {
    expect(() => lakeOutline({ x: 0, y: 0 }, -1)).toThrow(RangeError);
  });

  it('bounds and point-in-polygon agree with the outline', () => {
    const outline = lakeOutline({ x: 100, y: 100 }, 10_000);
    const bounds = outlineBounds(outline);
    expect(bounds.minX).toBeLessThan(100);
    expect(bounds.maxX).toBeGreaterThan(100);
    expect(pointInPolygon({ x: 100, y: 100 }, outline)).toBe(true);
    expect(pointInPolygon({ x: bounds.maxX + 10, y: 100 }, outline)).toBe(false);
  });
});
