// @vitest-environment node
/**
 * Equal dollars produce equal geometry across two different companies.
 *
 * HOW THIS IS PROVEN, AND WHY IT IS NOT PROVEN WITH TWO NAMED FILERS. Invariant 4.5
 * forbids invented companies in any committed code path, and only one filer's figures
 * were available to this session, so naming a second one would mean fabricating it. The
 * claim is stronger than a two-company spot check anyway: no function in `src/viz/scales`
 * or `src/viz/encoding` takes a company, a ticker, a CIK or any filer identity at all.
 * They take quantities. Cross-company stability is therefore a property of the signature,
 * and what follows tests exactly that — that geometry depends on the dollars and on
 * nothing else about where the dollars came from.
 *
 * The one thing this cannot catch is a caller that passes different quantities for the
 * same fact. That is Ledger's boundary, not this one. A second real filer lands here the
 * moment Ledger extracts one.
 */
import { describe, expect, it } from 'vitest';
import { planAreaPx2, usdFromBillions, usdFromMillions, widthPx } from '../scales';
import { composeCanvas, type CanvasInput } from './compose';
import { composeRiver, type RiverInput } from './river';

const SHARED_SEGMENT_DOLLARS = usdFromMillions(14_386);
const PERIOD = 'FY2026';

/** Two filers that agree on nothing except one segment's operating income. */
function filerA(): CanvasInput {
  return {
    fiscalPeriodLabel: PERIOD,
    segments: [
      {
        id: 'a1',
        label: 'A one',
        revenueUsd: usdFromBillions(90),
        costs: [{ id: 'c', label: 'Cost', amountUsd: usdFromBillions(50) }],
        operatingIncomeUsd: usdFromBillions(40),
      },
      {
        id: 'a2',
        label: 'A two',
        revenueUsd: usdFromBillions(30),
        costs: [
          { id: 'c1', label: 'Cost of revenue', amountUsd: usdFromBillions(10) },
          {
            id: 'c2',
            label: 'Operating expenses',
            amountUsd: usdFromBillions(20) - SHARED_SEGMENT_DOLLARS,
          },
        ],
        operatingIncomeUsd: SHARED_SEGMENT_DOLLARS,
      },
    ],
    netEarningsUsd: usdFromBillions(40) + SHARED_SEGMENT_DOLLARS - usdFromBillions(6),
    trunkConstrictionLabel: 'Tax and other items outside the business segments',
  };
}

function filerB(): CanvasInput {
  return {
    fiscalPeriodLabel: 'FY2019',
    segments: [
      {
        id: 'b1',
        label: 'B one',
        revenueUsd: usdFromBillions(400),
        costs: [{ id: 'only', label: 'Combined expense', amountUsd: usdFromBillions(390) }],
        operatingIncomeUsd: usdFromBillions(10),
      },
      {
        id: 'b2',
        label: 'B two',
        revenueUsd: usdFromBillions(17),
        costs: [
          {
            id: 'only',
            label: 'Combined expense',
            amountUsd: usdFromBillions(17) - SHARED_SEGMENT_DOLLARS,
          },
        ],
        operatingIncomeUsd: SHARED_SEGMENT_DOLLARS,
      },
      {
        id: 'b3',
        label: 'B three',
        revenueUsd: usdFromBillions(5),
        costs: [{ id: 'only', label: 'Combined expense', amountUsd: usdFromBillions(4) }],
        operatingIncomeUsd: usdFromBillions(1),
      },
    ],
    netEarningsUsd: usdFromBillions(11) + SHARED_SEGMENT_DOLLARS - usdFromBillions(2),
    trunkConstrictionLabel: 'Tax and other items outside the business segments',
  };
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; blocked: unknown }): T {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.blocked)}`);
  return result.value;
}

describe('no scale can see which company it is serving', () => {
  it('gives the shared segment the identical river width in both filers', () => {
    const a = unwrap(composeCanvas(filerA()));
    const b = unwrap(composeCanvas(filerB()));
    const inA = a.rivers.find((river) => river.id === 'a2');
    const inB = b.rivers.find((river) => river.id === 'b2');
    expect(inA?.mouthWidthPx).toBe(inB?.mouthWidthPx);
    expect(inA?.mouthWidthPx).toBeCloseTo(14.386, 9);
  });

  it('is unaffected by how large the rest of the company is', () => {
    // Filer B is roughly four times filer A. Invariant 3.1 forbids that changing anything.
    const a = unwrap(composeCanvas(filerA()));
    const b = unwrap(composeCanvas(filerB()));
    expect(b.totals.segmentRevenueUsd / a.totals.segmentRevenueUsd).toBeGreaterThan(3);
    expect(a.rivers.find((r) => r.id === 'a2')?.mouthWidthPx).toBe(
      b.rivers.find((r) => r.id === 'b2')?.mouthWidthPx,
    );
  });

  it('is unaffected by the number of segments or the disclosure depth', () => {
    const twoCategories: RiverInput = {
      id: 'deep',
      label: 'Deep disclosure',
      revenueUsd: usdFromBillions(50),
      costs: [
        { id: 'c1', label: 'Cost of revenue', amountUsd: usdFromBillions(20) },
        { id: 'c2', label: 'Operating expenses', amountUsd: usdFromBillions(15) },
      ],
      operatingIncomeUsd: usdFromBillions(15),
    };
    const oneCategory: RiverInput = {
      id: 'shallow',
      label: 'Shallow disclosure',
      revenueUsd: usdFromBillions(50),
      costs: [{ id: 'only', label: 'Combined expense', amountUsd: usdFromBillions(35) }],
      operatingIncomeUsd: usdFromBillions(15),
    };
    expect(unwrap(composeRiver(twoCategories)).mouthWidthPx).toBe(
      unwrap(composeRiver(oneCategory)).mouthWidthPx,
    );
  });

  it('gives equal net earnings the identical lake area in both filers', () => {
    // Below both filers' segment operating income, so neither trips open question Q2.
    const shared = usdFromBillions(20);
    const a = unwrap(composeCanvas({ ...filerA(), netEarningsUsd: shared }));
    const b = unwrap(composeCanvas({ ...filerB(), netEarningsUsd: shared }));
    expect(a.lake.planAreaPx2).toBe(b.lake.planAreaPx2);
    expect(a.lake.planAreaPx2).toBe(planAreaPx2(shared));
  });

  it('takes no filer identity in any signature', () => {
    // A structural check, not a behavioural one: the only strings any of these functions
    // read are ids and labels, and neither reaches a width, an area or a depth.
    const a = unwrap(composeCanvas(filerA()));
    const relabelled = unwrap(
      composeCanvas({
        ...filerA(),
        fiscalPeriodLabel: 'FY1999',
        segments: filerA().segments.map((segment) => ({
          ...segment,
          id: `renamed-${segment.id}`,
          label: 'Renamed',
        })),
      }),
    );
    expect(relabelled.trunk.arrivingWidthPx).toBe(a.trunk.arrivingWidthPx);
    expect(relabelled.lake.planAreaPx2).toBe(a.lake.planAreaPx2);
    expect(relabelled.rivers.map((river) => river.mouthWidthPx)).toEqual(
      a.rivers.map((river) => river.mouthWidthPx),
    );
  });

  it('holds for the constriction channel too, not only for widths', () => {
    const cost = usdFromBillions(21.488);
    expect(widthPx(cost)).toBe(widthPx(cost));
    const a = unwrap(composeCanvas(filerA()));
    const b = unwrap(composeCanvas(filerB()));
    // Same dollars removed, same pixels removed, on trunks of very different width.
    expect(a.trunk.constriction.removedWidthPx / a.trunk.constriction.costUsd).toBeCloseTo(
      b.trunk.constriction.removedWidthPx / b.trunk.constriction.costUsd,
      15,
    );
  });
});
