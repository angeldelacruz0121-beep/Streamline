// @vitest-environment node
/**
 * Legibility assessment. Invariants 3.1, 3.9; test record 0002.
 *
 * The property under test is as much what this module DOESN'T do as what it does: it
 * reports, and it never returns a corrected size.
 */
import { describe, expect, it } from 'vitest';
import {
  assessCrossAxisFit,
  assessLegibility,
  LEGIBILITY_FLOORS,
  type LegibilityInput,
} from './legibility';
import { usdFromMillions } from './units';
import { widthPx } from './width';

const MSFT: LegibilityInput = {
  rivers: [
    { id: 'productivity', mouthWidthPx: widthPx(usdFromMillions(83_879)) },
    { id: 'intelligent-cloud', mouthWidthPx: widthPx(usdFromMillions(56_972)) },
    { id: 'more-personal-computing', mouthWidthPx: widthPx(usdFromMillions(14_386)) },
  ],
  constrictions: [{ id: 'trunk/residual', removedWidthPx: widthPx(usdFromMillions(21_488)) }],
  lakeEquivalentDiameterPx: 412.67,
  indicatorValueUsd: 2e9,
  subjectUsd: usdFromMillions(133_749),
};

describe('every floor is marked provisional', () => {
  it('carries its provenance so nothing mistakes it for a measurement', () => {
    for (const floor of Object.values(LEGIBILITY_FLOORS)) {
      expect(floor.provisional).toBe(true);
      expect(floor.source.length).toBeGreaterThan(10);
    }
    // Advocate's own caveat: the 8px step threshold is an assumption, not a figure.
    expect(LEGIBILITY_FLOORS.constrictionStepMinPx.source).toContain('unmeasured');
  });
});

describe('the binding constraint is the smallest river, per record 0002', () => {
  it('names the narrowest river mouth as the binding element', () => {
    const report = assessLegibility(MSFT);
    expect(report.bindingElement).toBe('more-personal-computing');
    expect(report.smallestRiverMouthWidthPx).toBeCloseTo(14.386, 6);
  });

  it('passes Microsoft clean at the fixed constant', () => {
    const report = assessLegibility(MSFT);
    expect(report.legible).toBe(true);
    expect(report.findings).toHaveLength(0);
  });

  it('reports rather than repairs when a river falls below the floor', () => {
    const report = assessLegibility({
      ...MSFT,
      rivers: [...MSFT.rivers, { id: 'tiny', mouthWidthPx: 0.4 }],
    });
    expect(report.legible).toBe(false);
    expect(report.bindingElement).toBe('tiny');
    const finding = report.findings.find((item) => item.subject === 'tiny');
    expect(finding?.code).toBe('river-below-floor');
    // Invariant 3.9. The report contains no corrected width anywhere.
    expect(JSON.stringify(report)).not.toContain('suggestedWidthPx');
    expect(finding?.message).toContain('never by rescaling');
  });

  it('flags a constriction below the provisional step threshold without enlarging it', () => {
    const report = assessLegibility({
      ...MSFT,
      constrictions: [{ id: 'trunk/residual', removedWidthPx: 3 }],
    });
    const finding = report.findings.find((item) => item.code === 'constriction-below-floor');
    expect(finding?.measuredPx).toBe(3);
    expect(finding?.message).toContain('K1');
  });

  it('flags a lake below the floor and says the smallness is the point', () => {
    const report = assessLegibility({ ...MSFT, lakeEquivalentDiameterPx: 4 });
    const finding = report.findings.find((item) => item.code === 'lake-below-floor');
    expect(finding?.message).toContain('smallness is the point');
  });

  it('flags a legend larger than the company it explains', () => {
    const report = assessLegibility({ ...MSFT, subjectUsd: 5e8 });
    expect(report.findings.some((item) => item.code === 'indicator-dwarfs-subject')).toBe(true);
  });
});

describe('cross-axis fit is reported, never corrected', () => {
  it('returns an overflow and no scale factor', () => {
    const report = assessCrossAxisFit(900, 600);
    expect(report.fits).toBe(false);
    expect(report.overflowPx).toBe(300);
    expect(Object.keys(report)).not.toContain('scaleFactor');
    expect(report.note).toContain('forbidden by Invariant 3.1');
  });

  it('fits when it fits', () => {
    expect(assessCrossAxisFit(400, 600).fits).toBe(true);
    expect(assessCrossAxisFit(600, 600).overflowPx).toBe(0);
  });
});
