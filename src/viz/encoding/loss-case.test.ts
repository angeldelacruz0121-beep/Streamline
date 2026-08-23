// @vitest-environment node
/**
 * A LOSS-MAKING FILER, END TO END THROUGH `composeCanvas`. Invariants 3.2, 3.3, 3.4, 3.7,
 * 3.9; decision 0006 (D13); test record 0001 C5.
 *
 * WHY THIS FILE EXISTS. `composeLake` always handled the sign correctly, but the
 * composition entry point everyone actually calls could not reach it: `trunk.ts` took
 * `widthPx(netEarningsUsd)` and `widthPx` refuses a negative, so `composeCanvas` THREW a
 * `ScaleDomainError` for any unprofitable filer. The Invariant 3.4 drained basin was
 * unreachable in practice — the encoding supported losses and the composition refused
 * them. A throw is neither a designed refusal nor a rendered picture. Forge found it and
 * documented the workaround it had to use; this file is the regression test that keeps the
 * entry point honest, so the workaround can go.
 *
 * WHAT A LOSS LOOKS LIKE HERE. The rivers arrive unchanged and at full width. The trunk's
 * residual claims more than the whole trunk, so the constriction consumes it entirely: 0px
 * departing, $0 departing, `terminatesAtConstriction`. The part of the claim no width could
 * carry is exactly the magnitude of the loss, and that is what the basin holds. Invariant
 * 3.4's own sentence, implemented: rivers still flow in and are still consumed, and the loss
 * is the void that revenue failed to fill.
 *
 * PROBE QUANTITIES, NOT AN INVENTED COMPANY. Microsoft is profitable and is the only filer
 * whose figures this session had, so a loss cannot be exercised with reported numbers
 * (MISREADING-TESTS §5 states the same limitation for the basin). Nothing below is
 * presented as a company: these are quantities, and every function under test takes
 * quantities and knows nothing about who reported them. Invariant 4.5 is not touched — no
 * fabricated filer reaches a committed code path.
 */
import { describe, expect, it } from 'vitest';
import {
  basinDepthPx,
  DEPTH_USD_PER_PX,
  planAreaPx2,
  usdFromBillions,
  usdFromMillions,
  widthPx,
  WIDTH_USD_PER_PX,
} from '../scales';
import { composeCanvas, type CanvasInput, type CanvasModel } from './compose';
import type { RiverInput } from './river';

const PERIOD = 'FY2026';
const LABEL = 'Tax and other items outside the business segments';

function probe(id: string, revenueB: number, operatingIncomeB: number): RiverInput {
  return {
    id,
    label: `Probe ${id}`,
    revenueUsd: usdFromBillions(revenueB),
    costs: [
      {
        id: 'cost',
        label: 'Cost of revenue',
        amountUsd: usdFromBillions(revenueB - operatingIncomeB),
      },
    ],
    operatingIncomeUsd: usdFromBillions(operatingIncomeB),
  };
}

/** Two segments, $10B of operating income arriving at the confluence. */
const SEGMENTS: readonly RiverInput[] = [probe('one', 30, 6), probe('two', 14, 4)];
const ARRIVING = usdFromBillions(10);

function canvasAt(netEarningsUsd: number, extra: Partial<CanvasInput> = {}): CanvasInput {
  return {
    fiscalPeriodLabel: PERIOD,
    segments: SEGMENTS,
    netEarningsUsd,
    trunkConstrictionLabel: LABEL,
    ...extra,
  };
}

function unwrap(result: ReturnType<typeof composeCanvas>): CanvasModel {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.blocked)}`);
  return result.value;
}

/** The magnitudes 0006 asked to be asserted at, now through the entry point. */
const MAGNITUDES_USD = [
  usdFromMillions(-1),
  usdFromMillions(-100),
  usdFromBillions(-1),
  usdFromBillions(-8),
  usdFromMillions(-133_749),
];

describe('the bug: a loss-making filer can compose at all', () => {
  it('returns a canvas instead of throwing a ScaleDomainError, at every magnitude', () => {
    for (const netEarningsUsd of MAGNITUDES_USD) {
      expect(() => composeCanvas(canvasAt(netEarningsUsd))).not.toThrow();
      const result = composeCanvas(canvasAt(netEarningsUsd));
      expect(result.ok, String(netEarningsUsd)).toBe(true);
    }
  });

  it('reaches the drained basin — Invariant 3.4 is no longer dead code', () => {
    for (const netEarningsUsd of MAGNITUDES_USD) {
      const canvas = unwrap(composeCanvas(canvasAt(netEarningsUsd)));
      expect(canvas.lake.waterBody).toBe('drained-basin');
      expect(canvas.lake.signCues).toEqual(['dry-floor', 'rim-treatment', 'label']);
      expect(canvas.lake.volumetricShadingForbidden).toBe(true);
      expect(canvas.lake.fiscalPeriodLabel).toBe(PERIOD);
      expect(canvas.lake.netEarningsReadout.usd).toBe(netEarningsUsd);
    }
  });

  it('leaves the rivers untouched — the water still arrives at full width', () => {
    const loss = unwrap(composeCanvas(canvasAt(usdFromBillions(-8))));
    const profit = unwrap(composeCanvas(canvasAt(usdFromBillions(8))));
    expect(loss.rivers.map((river) => river.headWidthPx)).toEqual(
      profit.rivers.map((river) => river.headWidthPx),
    );
    expect(loss.rivers.map((river) => river.mouthWidthPx)).toEqual(
      profit.rivers.map((river) => river.mouthWidthPx),
    );
    expect(loss.trunk.arrivingWidthPx).toBe(profit.trunk.arrivingWidthPx);
    expect(loss.trunk.arrivingWidthPx).toBe(widthPx(ARRIVING));
  });

  it('consumes the trunk entirely rather than drawing a signless departing flow', () => {
    const canvas = unwrap(composeCanvas(canvasAt(usdFromBillions(-8))));
    expect(canvas.trunk.terminatesAtConstriction).toBe(true);
    expect(canvas.trunk.departingWidthPx).toBe(0);
    expect(canvas.trunk.departingUsd).toBe(0);
    // The naive alternative, refused: a 8px trunk flowing onward would read as $8B kept.
    expect(canvas.trunk.departingWidthPx).not.toBe(widthPx(usdFromBillions(8)));
    // The reported figure keeps its sign where it belongs — on the number, not the width.
    expect(canvas.totals.netEarningsUsd).toBe(usdFromBillions(-8));
  });
});

describe('the shortfall is handed to the basin, by identity and not by eye', () => {
  /**
   * THE LOAD-BEARING ASSERTION OF THIS ENCODING.
   *
   * `depth.ts` pins DEPTH_USD_PER_PX to WIDTH_USD_PER_PX — "not independently tunable".
   * So the width the constriction could not remove IS the depth the basin sinks below
   * grade, to the last bit. That identity is the difference between a principled encoding
   * and a clamp that happened to look tidy, and it is why 3.2 is satisfied in sum: no
   * dollars leave the picture, they change channel on the same constant.
   *
   * If anyone ever unpins the depth constant, this fails first and loudest.
   */
  it('makes unrepresented width and basin depth the same number', () => {
    expect(DEPTH_USD_PER_PX).toBe(WIDTH_USD_PER_PX);
    for (const netEarningsUsd of MAGNITUDES_USD) {
      const canvas = unwrap(composeCanvas(canvasAt(netEarningsUsd)));
      const overdraw = canvas.trunk.constriction.overdraw;
      expect(overdraw, String(netEarningsUsd)).not.toBeNull();
      if (overdraw === null) continue;
      expect(overdraw.unrepresentedUsd).toBe(-netEarningsUsd);
      expect(overdraw.unrepresentedWidthPx).toBe(widthPx(-netEarningsUsd));
      expect(overdraw.unrepresentedWidthPx).toBe(basinDepthPx(netEarningsUsd));
      expect(overdraw.unrepresentedWidthPx).toBe(canvas.lake.depthBelowShorelinePx);
      expect(overdraw.carriedBy).toBe('basin-plan-area-and-depth');
      expect(overdraw.annotationRequired).toBe(true);
    }
  });

  it('conserves the claim across both channels, at every constriction on the canvas', () => {
    for (const netEarningsUsd of [...MAGNITUDES_USD, usdFromBillions(8), 0]) {
      const canvas = unwrap(composeCanvas(canvasAt(netEarningsUsd)));
      const all = [
        ...canvas.rivers.flatMap((river) => river.constrictions),
        canvas.trunk.constriction,
      ];
      for (const c of all) {
        const unrepresented = c.overdraw?.unrepresentedWidthPx ?? 0;
        expect(c.removedWidthPx + unrepresented, c.id).toBeCloseTo(
          widthPx(c.annotation.valueUsd),
          9,
        );
        expect(c.removedWidthPx).toBeLessThanOrEqual(c.widthBeforePx + 1e-12);
        expect(c.widthAfterPx).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never lets a river constriction overdraw — reconciliation makes it impossible', () => {
    const canvas = unwrap(composeCanvas(canvasAt(usdFromBillions(-8))));
    for (const river of canvas.rivers) {
      for (const c of river.constrictions) expect(c.overdraw).toBeNull();
    }
  });

  it('states the full claim in dollars even though the width channel saturated', () => {
    const canvas = unwrap(composeCanvas(canvasAt(usdFromBillions(-8))));
    const c = canvas.trunk.constriction;
    // Arriving $10B, net -$8B, so the residual claims $18B against a $10B trunk.
    expect(c.costUsd).toBe(usdFromBillions(18));
    expect(c.annotation.valueUsd).toBe(usdFromBillions(18));
    expect(c.annotation.dimensionedWidthPx).toBe(widthPx(usdFromBillions(18)));
    expect(c.removedWidthPx).toBe(widthPx(usdFromBillions(10)));
    expect(canvas.totals.trunkResidualUsd).toBe(usdFromBillions(18));
  });
});

describe('test record 0001 C5 — the encoding is continuous through zero', () => {
  it('gives a loss and a profit of equal magnitude the identical footprint', () => {
    for (const magnitude of [usdFromMillions(100), usdFromBillions(1), usdFromBillions(8)]) {
      const basin = unwrap(composeCanvas(canvasAt(-magnitude)));
      const lake = unwrap(composeCanvas(canvasAt(magnitude)));
      expect(basin.lake.planAreaPx2).toBe(lake.lake.planAreaPx2);
      expect(basin.lake.equivalentDiscDiameterPx).toBe(lake.lake.equivalentDiscDiameterPx);
      expect(basin.lake.planAreaPx2).toBe(planAreaPx2(magnitude));
    }
  });

  it('sweeps net earnings through zero with no throw, no negative width, no discontinuity', () => {
    const step = usdFromBillions(0.25);
    const nets: number[] = [];
    for (let i = 8; i >= -8; i -= 1) nets.push(i * step);

    let previousDeparting = Number.POSITIVE_INFINITY;
    for (const net of nets) {
      const canvas = unwrap(composeCanvas(canvasAt(net)));
      // Departing width falls monotonically to zero and never goes below it.
      expect(canvas.trunk.departingWidthPx, String(net)).toBeGreaterThanOrEqual(0);
      expect(canvas.trunk.departingWidthPx).toBeLessThanOrEqual(previousDeparting + 1e-12);
      previousDeparting = canvas.trunk.departingWidthPx;
      // Area is |net| on one constant on both sides of zero — no step at the crossing.
      expect(canvas.lake.planAreaPx2).toBeCloseTo(Math.abs(net) / 1_000_000, 6);
      // The overdraw appears exactly when, and only when, the result goes below zero.
      expect(canvas.trunk.constriction.overdraw === null).toBe(net >= 0);
      expect(canvas.trunk.terminatesAtConstriction).toBe(net <= 0);
    }
  });

  it('renders break-even as a terminated trunk and a dry bed, with no shortfall', () => {
    const canvas = unwrap(composeCanvas(canvasAt(0)));
    expect(canvas.lake.waterBody).toBe('dry');
    expect(canvas.lake.planAreaPx2).toBe(0);
    expect(canvas.lake.depthBelowShorelinePx).toBe(0);
    expect(canvas.trunk.departingWidthPx).toBe(0);
    expect(canvas.trunk.terminatesAtConstriction).toBe(true);
    expect(canvas.trunk.constriction.overdraw).toBeNull();
  });
});

describe('Invariant 3.7 under a loss — "More" is a display decision, never a data one', () => {
  const many: CanvasInput = {
    fiscalPeriodLabel: PERIOD,
    segments: Array.from({ length: 11 }, (_value, index) => {
      const revenueB = 60 - index * 4;
      return probe(`s${String(index).padStart(2, '0')}`, revenueB, Math.round(revenueB * 0.35));
    }),
    netEarningsUsd: usdFromBillions(-30),
    trunkConstrictionLabel: LABEL,
  };

  it('holds the basin area, its depth and the shortfall constant across every legal cap', () => {
    const readings = [5, 6, 7, 8].map((cap) => {
      const canvas = unwrap(composeCanvas({ ...many, displayCap: cap }));
      return [
        canvas.lake.planAreaPx2,
        canvas.lake.depthBelowShorelinePx,
        canvas.trunk.arrivingWidthPx,
        canvas.trunk.constriction.removedWidthPx,
        canvas.trunk.constriction.overdraw?.unrepresentedUsd,
        canvas.trunk.departingWidthPx,
      ].join('|');
    });
    expect(new Set(readings).size).toBe(1);
  });

  it('keeps the hidden segments in the trunk, so the closure is not a display artefact', () => {
    const canvas = unwrap(composeCanvas({ ...many, displayCap: 5 }));
    expect(canvas.collapsed?.count).toBe(6);
    const sumOfMouths = canvas.rivers.reduce((sum, river) => sum + river.mouthWidthPx, 0);
    expect(sumOfMouths).toBeCloseTo(canvas.trunk.arrivingWidthPx, 6);
    expect(canvas.trunk.constriction.overdraw?.representedCostUsd).toBeCloseTo(
      canvas.totals.segmentOperatingIncomeUsd,
      6,
    );
  });
});

describe('equal dollars produce equal geometry across two filers that both lost money', () => {
  /** Nothing in common except the size of the loss: different periods, segments, shapes. */
  const filerA: CanvasInput = {
    fiscalPeriodLabel: 'FY2026',
    segments: [probe('a1', 30, 6), probe('a2', 14, 4)],
    netEarningsUsd: usdFromBillions(-8),
    trunkConstrictionLabel: LABEL,
  };
  const filerB: CanvasInput = {
    fiscalPeriodLabel: 'FY2019',
    segments: [probe('b1', 5, 1), probe('b2', 9, 2), probe('b3', 22, 3)],
    netEarningsUsd: usdFromBillions(-8),
    trunkConstrictionLabel: 'Taxes and items outside the segments',
  };

  it('gives them the same basin, to the last bit', () => {
    const a = unwrap(composeCanvas(filerA));
    const b = unwrap(composeCanvas(filerB));
    expect(a.lake.planAreaPx2).toBe(b.lake.planAreaPx2);
    expect(a.lake.equivalentDiscRadiusPx).toBe(b.lake.equivalentDiscRadiusPx);
    expect(a.lake.depthBelowShorelinePx).toBe(b.lake.depthBelowShorelinePx);
    expect(a.trunk.constriction.overdraw?.unrepresentedWidthPx).toBe(
      b.trunk.constriction.overdraw?.unrepresentedWidthPx,
    );
  });

  it('does not give them the same trunk, because they did not arrive with the same dollars', () => {
    const a = unwrap(composeCanvas(filerA));
    const b = unwrap(composeCanvas(filerB));
    expect(a.trunk.arrivingWidthPx).not.toBe(b.trunk.arrivingWidthPx);
    // Both are consumed to nothing, and both say so the same way.
    expect(a.trunk.departingWidthPx).toBe(b.trunk.departingWidthPx);
    expect(a.trunk.terminatesAtConstriction).toBe(b.trunk.terminatesAtConstriction);
  });

  it('recovers one dollars-per-pixel from every width that still carries a flow', () => {
    for (const input of [filerA, filerB]) {
      const canvas = unwrap(composeCanvas(input));
      const samples = [
        { px: canvas.trunk.arrivingWidthPx, usd: canvas.trunk.arrivingUsd },
        ...canvas.rivers.map((river) => ({
          px: river.mouthWidthPx,
          usd: river.operatingIncomeUsd,
        })),
        ...canvas.rivers.flatMap((river) =>
          river.constrictions.map((c) => ({ px: c.removedWidthPx, usd: c.costUsd })),
        ),
        {
          px: canvas.trunk.constriction.overdraw?.unrepresentedWidthPx ?? 0,
          usd: canvas.trunk.constriction.overdraw?.unrepresentedUsd ?? 0,
        },
      ];
      for (const sample of samples) expect(sample.usd / sample.px).toBeCloseTo(1_000_000_000, 0);
    }
  });
});

describe('what the loss canvas still refuses to do', () => {
  const canvas = unwrap(composeCanvas(canvasAt(usdFromBillions(-8))));

  it('refuses a company whose segments lose money, rather than throwing', () => {
    const result = composeCanvas({
      fiscalPeriodLabel: PERIOD,
      segments: [
        {
          id: 'losing',
          label: 'Probe at an operating loss',
          revenueUsd: usdFromBillions(10),
          costs: [{ id: 'cost', label: 'Cost of revenue', amountUsd: usdFromBillions(14) }],
          operatingIncomeUsd: usdFromBillions(-4),
        },
      ],
      netEarningsUsd: usdFromBillions(-6),
      trunkConstrictionLabel: LABEL,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = result.blocked.map((reason) => reason.code);
    expect(codes).toContain('segment-operating-loss');
    expect(codes).toContain('trunk-arriving-negative');
  });

  it('leaves Q2 exactly where it was — a positive residual still refuses', () => {
    const result = composeCanvas(canvasAt(usdFromBillions(12)));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blocked[0]?.code).toBe('trunk-residual-positive');
    expect(result.blocked[0]?.escalation).toBe('Q2');
  });

  it('leaves the junction unresolved on a basin exactly as on a lake — Q1', () => {
    expect(canvas.junction.resolved).toBe(false);
    expect(canvas.lake.junction).toBe(canvas.junction);
  });

  it('carries no colour and no flow speed, so D15 and D9 stay excluded on this branch too', () => {
    expect(JSON.stringify(canvas)).not.toMatch(/colou?r|hue|rgba?\(|#[0-9a-f]{6}/i);
    expect(JSON.stringify(canvas).toLowerCase()).not.toMatch(/speed|velocity|particle/);
  });

  it('is a pure function of the quantities — same input, same model', () => {
    expect(JSON.stringify(unwrap(composeCanvas(canvasAt(usdFromBillions(-8)))))).toBe(
      JSON.stringify(unwrap(composeCanvas(canvasAt(usdFromBillions(-8))))),
    );
  });

  it('reports the tiny basin as below the legibility floor instead of enlarging it', () => {
    const tiny = unwrap(composeCanvas(canvasAt(usdFromMillions(-1))));
    expect(tiny.lake.planAreaPx2).toBe(1);
    expect(tiny.legibility.findings.map((finding) => finding.code)).toContain('lake-below-floor');
  });
});
