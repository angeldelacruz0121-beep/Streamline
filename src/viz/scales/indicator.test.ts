// @vitest-environment node
/**
 * The scale indicators. Invariant 3.3; test record 0001 C6.
 */
import { describe, expect, it } from 'vitest';
import { AREA_USD_PER_PX2, planAreaPx2 } from './area';
import {
  areaIndicatorAt,
  defaultAreaIndicator,
  defaultWidthIndicator,
  formatCompactUsd,
  roundTo125,
  widthIndicatorAt,
} from './indicator';
import { ScaleDomainError, usdFromBillions, usdFromMillions } from './units';
import { WIDTH_USD_PER_PX } from './width';

describe('the 1-2-5 ladder', () => {
  it('snaps to the nearest rung in log space', () => {
    expect(roundTo125(1.8096e9)).toBe(2e9);
    expect(roundTo125(9e8)).toBe(1e9);
    expect(roundTo125(1e11)).toBe(1e11);
    expect(roundTo125(3.9e6)).toBe(5e6);
    expect(roundTo125(1.3e3)).toBe(1e3);
  });

  it('refuses a value it cannot ladder', () => {
    expect(() => roundTo125(0)).toThrow(ScaleDomainError);
    expect(() => roundTo125(-1)).toThrow(ScaleDomainError);
  });
});

describe('the area indicator is a reference shape, not a bar — 0001 C6', () => {
  it('is a disc with a stated dollar value', () => {
    const indicator = defaultAreaIndicator();
    expect(indicator.kind).toBe('reference-disc');
    expect(indicator.valueUsd).toBe(usdFromBillions(2));
    expect(indicator.areaPx2).toBe(2_000);
    expect(indicator.radiusPx).toBeCloseTo(25.23, 2);
    expect(indicator.statement).toContain('$2B');
  });

  it('recovers the area constant exactly, at every stated value', () => {
    // A legend that does not recover the constant is a false legend, which is worse than
    // no legend at all.
    for (const usd of [1e6, 1e8, usdFromBillions(2), usdFromMillions(133_749), 5e11]) {
      expect(areaIndicatorAt(usd).constantRecoveredUsdPerPx2).toBe(AREA_USD_PER_PX2);
    }
  });

  it('is drawn on the same constant as the lake it explains', () => {
    const indicator = areaIndicatorAt(usdFromBillions(10));
    expect(indicator.areaPx2).toBe(planAreaPx2(usdFromBillions(10)));
  });

  it('refuses a non-positive stated value', () => {
    expect(() => areaIndicatorAt(0)).toThrow(ScaleDomainError);
  });
});

describe('the width indicator is a bar, which is correct for a length channel', () => {
  it('states $100B as 100px', () => {
    const indicator = defaultWidthIndicator();
    expect(indicator.kind).toBe('reference-bar');
    expect(indicator.valueUsd).toBe(usdFromBillions(100));
    expect(indicator.lengthPx).toBe(100);
  });

  it('recovers the width constant exactly, at every stated value', () => {
    for (const usd of [1e9, 1e10, usdFromMillions(155_237), 5e11]) {
      expect(widthIndicatorAt(usd).constantRecoveredUsdPerPx).toBeCloseTo(WIDTH_USD_PER_PX, 3);
    }
  });
});

describe('the two indicators do not imply a relationship between the two constants', () => {
  it('states different quantities in different forms', () => {
    const area = defaultAreaIndicator();
    const width = defaultWidthIndicator();
    expect(area.kind).not.toBe(width.kind);
    expect(area.scaleId).toBe('area');
    expect(width.scaleId).toBe('width');
    // No field on either indicator relates one to the other. Q1 is unanswered; a legend
    // that put a disc beside a bar with a stated equivalence would be answering it.
    expect(Object.keys(area)).not.toContain('lengthPx');
    expect(Object.keys(width)).not.toContain('areaPx2');
  });
});

describe('compact dollar text', () => {
  it('reads the way a filing reads', () => {
    expect(formatCompactUsd(usdFromMillions(133_749))).toBe('$133.7B');
    expect(formatCompactUsd(usdFromMillions(21_488))).toBe('$21.5B');
    expect(formatCompactUsd(usdFromMillions(500))).toBe('$500M');
    expect(formatCompactUsd(-usdFromMillions(1_200))).toBe('-$1.2B');
  });
});
