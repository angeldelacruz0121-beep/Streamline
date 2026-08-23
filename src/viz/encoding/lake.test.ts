// @vitest-environment node
/**
 * The lake and the drained basin. Invariants 3.3, 3.4, 3.10; decision 0006; test record
 * 0001 conditions C2, C3, C5; kill-list K3, K4, K11, K13; open question Q1.
 *
 * Real figures: Microsoft FY2026, accession 0001193125-26-323660, net income $133,749M.
 */
import { describe, expect, it } from 'vitest';
import { planAreaPx2, usdFromMillions } from '../scales';
import { composeLake, UNRESOLVED_JUNCTION } from './lake';

const NET_INCOME = usdFromMillions(133_749);
const PERIOD = 'FY2026';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; blocked: unknown }): T {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.blocked)}`);
  return result.value;
}

describe('the lake is no longer a static ellipse', () => {
  it('responds to net earnings by area', () => {
    const lake = unwrap(composeLake({ netEarningsUsd: NET_INCOME, fiscalPeriodLabel: PERIOD }));
    expect(lake.waterBody).toBe('lake');
    expect(lake.planAreaPx2).toBe(133_749);
    expect(lake.equivalentDiscRadiusPx).toBeCloseTo(206.334, 3);
  });

  it('changes area whenever the number changes, at every magnitude', () => {
    const areas = [1e8, 1e9, 1e10, NET_INCOME].map(
      (usd) => unwrap(composeLake({ netEarningsUsd: usd, fiscalPeriodLabel: PERIOD })).planAreaPx2,
    );
    expect(new Set(areas).size).toBe(areas.length);
    for (const [index, area] of areas.entries()) {
      if (index === 0) continue;
      expect(area).toBeGreaterThan(areas[index - 1] as number);
    }
  });

  it('leaves the silhouette to Atelier but never the area', () => {
    const lake = unwrap(composeLake({ netEarningsUsd: NET_INCOME, fiscalPeriodLabel: PERIOD }));
    expect(lake.silhouetteConstraint).toContain('enclosed plan area equals planAreaPx2');
    expect(lake.silhouetteConstraint).toContain('may not be adjusted for composition');
  });
});

describe('test record 0001 C5 and decision 0006 — one signed constant', () => {
  it('gives a loss of the same magnitude the identical plan area', () => {
    const lake = unwrap(composeLake({ netEarningsUsd: NET_INCOME, fiscalPeriodLabel: PERIOD }));
    const basin = unwrap(composeLake({ netEarningsUsd: -NET_INCOME, fiscalPeriodLabel: PERIOD }));
    expect(basin.planAreaPx2).toBe(lake.planAreaPx2);
    expect(basin.equivalentDiscRadiusPx).toBe(lake.equivalentDiscRadiusPx);
    expect(basin.waterBody).toBe('drained-basin');
  });

  it('carries the sign by cues that are not size and not colour', () => {
    const basin = unwrap(composeLake({ netEarningsUsd: -NET_INCOME, fiscalPeriodLabel: PERIOD }));
    expect(basin.signCues).toContain('dry-floor');
    expect(basin.signCues).toContain('rim-treatment');
    expect(basin.signCues).toContain('label');
    expect(JSON.stringify(basin)).not.toMatch(/colou?r|hue|#[0-9a-f]{6}/i);
  });

  it('makes depth a redundant channel and forbids a volumetric cue (K13)', () => {
    const basin = unwrap(composeLake({ netEarningsUsd: -NET_INCOME, fiscalPeriodLabel: PERIOD }));
    expect(basin.depthBelowShorelinePx).toBeCloseTo(133.749, 9);
    expect(basin.volumetricShadingForbidden).toBe(true);
    // Area, not depth, carries the magnitude.
    expect(basin.planAreaPx2).toBe(planAreaPx2(NET_INCOME));
  });

  it('gives a filled lake no depth below grade', () => {
    const lake = unwrap(composeLake({ netEarningsUsd: NET_INCOME, fiscalPeriodLabel: PERIOD }));
    expect(lake.depthBelowShorelinePx).toBe(0);
  });

  it('renders a break-even year as dry rather than as an error', () => {
    const dry = unwrap(composeLake({ netEarningsUsd: 0, fiscalPeriodLabel: PERIOD }));
    expect(dry.waterBody).toBe('dry');
    expect(dry.planAreaPx2).toBe(0);
  });
});

describe('test record 0001 C2 — the number is present as text, always', () => {
  it('carries a persistent, tabular readout of the exact figure', () => {
    const lake = unwrap(composeLake({ netEarningsUsd: NET_INCOME, fiscalPeriodLabel: PERIOD }));
    expect(lake.netEarningsReadout.usd).toBe(NET_INCOME);
    expect(lake.netEarningsReadout.persistent).toBe(true);
    expect(lake.netEarningsReadout.tabularNumerals).toBe(true);
  });

  it('has no hover-only path to the figure', () => {
    const lake = unwrap(composeLake({ netEarningsUsd: NET_INCOME, fiscalPeriodLabel: PERIOD }));
    expect(JSON.stringify(lake).toLowerCase()).not.toContain('hover');
  });
});

describe('test record 0001 C3 — the period is attached to the lake, not only the basin', () => {
  it('refuses to compose a lake with no period label', () => {
    const result = composeLake({ netEarningsUsd: NET_INCOME, fiscalPeriodLabel: '   ' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blocked[0]?.code).toBe('missing-fiscal-period');
  });

  it('applies the same refusal to a filled lake and to a drained basin', () => {
    expect(composeLake({ netEarningsUsd: -NET_INCOME, fiscalPeriodLabel: '' }).ok).toBe(false);
    expect(composeLake({ netEarningsUsd: NET_INCOME, fiscalPeriodLabel: '' }).ok).toBe(false);
  });

  it('carries the period through onto the geometry', () => {
    const lake = unwrap(composeLake({ netEarningsUsd: NET_INCOME, fiscalPeriodLabel: PERIOD }));
    expect(lake.fiscalPeriodLabel).toBe(PERIOD);
  });
});

describe('open question Q1 — the junction is a seam, not a default', () => {
  it('carries an unresolved junction on every lake', () => {
    const lake = unwrap(composeLake({ netEarningsUsd: NET_INCOME, fiscalPeriodLabel: PERIOD }));
    expect(lake.junction.resolved).toBe(false);
    expect(lake.junction.blockedBy).toBe('Q1');
    expect(lake.junction.forbidden.length).toBeGreaterThan(0);
  });

  it('emits no coordinate, no offset, and no trunk-relative size anywhere', () => {
    const lake = unwrap(composeLake({ netEarningsUsd: NET_INCOME, fiscalPeriodLabel: PERIOD }));
    const keys = new Set<string>();
    const walk = (node: unknown): void => {
      if (node === null || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        keys.add(key.toLowerCase());
        walk(value);
      }
    };
    walk(lake);
    for (const key of keys) {
      expect(key).not.toMatch(/^(x|y|cx|cy|left|top|offset|position|anchor|trunk)/);
    }
  });

  it('states in the model itself what may not be done', () => {
    expect(UNRESOLVED_JUNCTION.forbidden.join(' ')).toContain('K3');
    expect(UNRESOLVED_JUNCTION.forbidden.join(' ')).toContain('1000px');
  });
});
