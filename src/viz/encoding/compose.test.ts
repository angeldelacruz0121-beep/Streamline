// @vitest-environment node
/**
 * The whole canvas. Invariants 3.1, 3.2, 3.3, 3.6, 3.7, 3.10; decisions 0005, 0006, 0007;
 * test records 0001 and 0002.
 *
 * Microsoft FY2026, accession 0001193125-26-323660, is the subject. Its segment REVENUES
 * were not available to this session, so the three rivers below are given a head equal to
 * their reported operating income and no cost categories: every figure that appears is a
 * reported one, and the cost side is absent rather than invented (Invariant 4.5). What
 * that exercises end to end is the confluence, the trunk constriction and the lake, which
 * is exactly the path the real figures pin. Adding the real revenues and Microsoft's two
 * disclosed cost lines changes the fixture, not one line of the code under test.
 */
import { describe, expect, it } from 'vitest';
import { usdFromBillions, usdFromMillions, widthPx } from '../scales';
import { composeCanvas, type CanvasInput, type CanvasModel } from './compose';
import type { RiverInput } from './river';

const PERIOD = 'FY2026';
const NET_INCOME = usdFromMillions(133_749);

function reportedFlow(id: string, label: string, operatingIncomeUsd: number): RiverInput {
  return { id, label, revenueUsd: operatingIncomeUsd, costs: [], operatingIncomeUsd };
}

const msft: CanvasInput = {
  fiscalPeriodLabel: PERIOD,
  segments: [
    reportedFlow('productivity', 'Productivity and Business Processes', usdFromMillions(83_879)),
    reportedFlow('intelligent-cloud', 'Intelligent Cloud', usdFromMillions(56_972)),
    reportedFlow('mpc', 'More Personal Computing', usdFromMillions(14_386)),
  ],
  netEarningsUsd: NET_INCOME,
  trunkConstrictionLabel: 'Tax and other items outside the business segments',
};

function unwrap(result: ReturnType<typeof composeCanvas>): CanvasModel {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.blocked)}`);
  return result.value;
}

describe('the canvas conserves, end to end, on the real figures', () => {
  it('sums three rivers into a 155.237px trunk and leaves a 133.749px trunk', () => {
    const canvas = unwrap(composeCanvas(msft));
    const sumOfMouths = canvas.rivers.reduce((sum, river) => sum + river.mouthWidthPx, 0);
    expect(sumOfMouths).toBeCloseTo(canvas.trunk.arrivingWidthPx, 9);
    expect(canvas.trunk.arrivingWidthPx).toBeCloseTo(155.237, 9);
    expect(canvas.trunk.constriction.removedWidthPx).toBeCloseTo(21.488, 9);
    expect(canvas.trunk.departingWidthPx).toBeCloseTo(133.749, 9);
  });

  it('lands the lake on the area constant, not on the trunk width', () => {
    const canvas = unwrap(composeCanvas(msft));
    expect(canvas.lake.planAreaPx2).toBe(133_749);
    expect(canvas.lake.netEarningsReadout.usd).toBe(NET_INCOME);
  });

  it('reports totals that tie to the filing', () => {
    const canvas = unwrap(composeCanvas(msft));
    expect(canvas.totals.segmentOperatingIncomeUsd).toBeCloseTo(usdFromMillions(155_237), 0);
    expect(canvas.totals.trunkResidualUsd).toBeCloseTo(usdFromMillions(21_488), 0);
    expect(canvas.totals.netEarningsUsd).toBe(NET_INCOME);
  });

  it('passes the legibility check with the third river as the binding element', () => {
    const canvas = unwrap(composeCanvas(msft));
    expect(canvas.legibility.bindingElement).toBe('mpc');
    expect(canvas.legibility.legible).toBe(true);
  });
});

describe('Invariant 3.7 — the lake is identical whether "More" is expanded or collapsed', () => {
  // Probe quantities: no v1 filer has enough segments to exercise the cap.
  const many: CanvasInput = {
    fiscalPeriodLabel: PERIOD,
    segments: Array.from({ length: 11 }, (_value, index) => {
      // Whole billions on both sides, so the default zero-tolerance reconciliation is
      // exercised rather than sidestepped. Real XBRL dollar figures are integers too.
      const revenueUsd = usdFromBillions(60 - index * 4);
      const operatingIncomeUsd = usdFromBillions(Math.round((60 - index * 4) * 0.35));
      return {
        id: `s${String(index).padStart(2, '0')}`,
        label: `Segment ${index}`,
        revenueUsd,
        costs: [{ id: 'cost', label: 'Cost', amountUsd: revenueUsd - operatingIncomeUsd }],
        operatingIncomeUsd,
      };
    }),
    netEarningsUsd: usdFromBillions(100),
    trunkConstrictionLabel: 'Tax and other items outside the business segments',
  };

  it('holds the lake area constant across every legal cap', () => {
    const areas = [5, 6, 7, 8].map(
      (cap) => unwrap(composeCanvas({ ...many, displayCap: cap })).lake.planAreaPx2,
    );
    expect(new Set(areas).size).toBe(1);
  });

  it('holds the trunk and its constriction constant across every legal cap — 0002 C7', () => {
    const trunks = [5, 6, 7, 8].map((cap) => {
      const canvas = unwrap(composeCanvas({ ...many, displayCap: cap }));
      return [
        canvas.trunk.arrivingWidthPx,
        canvas.trunk.constriction.removedWidthPx,
        canvas.trunk.departingWidthPx,
      ].join('|');
    });
    expect(new Set(trunks).size).toBe(1);
  });

  it('still draws the hidden water, so the rivers keep summing to the trunk', () => {
    const canvas = unwrap(composeCanvas({ ...many, displayCap: 5 }));
    expect(canvas.collapsed?.count).toBe(6);
    expect(canvas.rivers).toHaveLength(6);
    expect(canvas.rivers.filter((river) => river.aggregated)).toHaveLength(1);
    const sumOfMouths = canvas.rivers.reduce((sum, river) => sum + river.mouthWidthPx, 0);
    expect(sumOfMouths).toBeCloseTo(canvas.trunk.arrivingWidthPx, 6);
  });

  it('rejects a cap outside 5 to 8 instead of clamping it', () => {
    const result = composeCanvas({ ...many, displayCap: 12 });
    expect(result.ok).toBe(false);
  });
});

describe('one scale governs the whole canvas — 0002 C1', () => {
  it('recovers the same dollars-per-pixel from every width on the picture', () => {
    const canvas = unwrap(composeCanvas(msft));
    const samples: { px: number; usd: number }[] = [
      { px: canvas.trunk.arrivingWidthPx, usd: canvas.trunk.arrivingUsd },
      { px: canvas.trunk.departingWidthPx, usd: canvas.trunk.departingUsd },
      {
        px: canvas.trunk.constriction.removedWidthPx,
        usd: canvas.trunk.constriction.costUsd,
      },
      ...canvas.rivers.map((river) => ({ px: river.mouthWidthPx, usd: river.operatingIncomeUsd })),
    ];
    for (const sample of samples) {
      expect(sample.usd / sample.px).toBeCloseTo(1_000_000_000, 0);
    }
  });

  it('gives every constriction on the canvas the same longitudinal span', () => {
    const canvas = unwrap(composeCanvas(msft));
    const spans = [
      ...canvas.rivers.flatMap((river) => river.constrictions.map((c) => c.spanPx)),
      canvas.trunk.constriction.spanPx,
    ];
    expect(new Set(spans).size).toBe(1);
  });
});

describe('what the canvas refuses to decide', () => {
  it('leaves the junction unresolved and names Q1', () => {
    const canvas = unwrap(composeCanvas(msft));
    expect(canvas.junction.resolved).toBe(false);
    expect(canvas.junction.blockedBy).toBe('Q1');
    expect(canvas.lake.junction).toBe(canvas.junction);
  });

  it('carries no colour anywhere, so D15 stays open and 3.10 holds trivially', () => {
    const canvas = unwrap(composeCanvas(msft));
    expect(JSON.stringify(canvas)).not.toMatch(/colou?r|hue|rgba?\(|#[0-9a-f]{6}/i);
  });

  it('carries no flow speed anywhere, so D9 stays open', () => {
    const canvas = unwrap(composeCanvas(msft));
    expect(JSON.stringify(canvas).toLowerCase()).not.toMatch(/speed|velocity|particle/);
  });

  it('reports an overflow rather than rescaling to fit', () => {
    const canvas = unwrap(composeCanvas({ ...msft, availableCrossAxisPx: 200 }));
    expect(canvas.crossAxisFit?.fits).toBe(false);
    expect(canvas.crossAxisFit?.overflowPx).toBeGreaterThan(0);
    // The geometry is unchanged by the viewport being too small.
    expect(canvas.trunk.arrivingWidthPx).toBeCloseTo(155.237, 9);
  });

  it('propagates a refusal from any river rather than drawing part of a company', () => {
    const result = composeCanvas({
      ...msft,
      segments: [
        ...msft.segments,
        {
          id: 'broken',
          label: 'Does not reconcile',
          revenueUsd: usdFromBillions(10),
          costs: [{ id: 'cost', label: 'Cost', amountUsd: usdFromBillions(3) }],
          operatingIncomeUsd: usdFromBillions(5),
        },
      ],
    });
    expect(result.ok).toBe(false);
  });
});

describe('the canvas publishes the scales it used', () => {
  it('ships the manifest and both indicators with the model', () => {
    const canvas = unwrap(composeCanvas(msft));
    expect(canvas.scales.map((scale) => scale.id)).toEqual(['width', 'area', 'depth']);
    expect(canvas.indicators.area.kind).toBe('reference-disc');
    expect(canvas.indicators.width.kind).toBe('reference-bar');
    expect(canvas.indicators.area.constantRecoveredUsdPerPx2).toBe(1_000_000);
    expect(canvas.indicators.width.lengthPx).toBe(100);
  });

  it('is a pure function — same input, same model', () => {
    expect(JSON.stringify(unwrap(composeCanvas(msft)))).toBe(
      JSON.stringify(unwrap(composeCanvas(msft))),
    );
  });
});

describe('the width scale is the only thing that turned dollars into pixels', () => {
  it('reproduces every rendered width by hand from the constant', () => {
    const canvas = unwrap(composeCanvas(msft));
    for (const river of canvas.rivers) {
      expect(river.mouthWidthPx).toBe(widthPx(river.operatingIncomeUsd));
      expect(river.headWidthPx).toBe(widthPx(river.revenueUsd));
    }
  });
});
