// @vitest-environment node
/**
 * The confluence and the trunk constriction. Decision 0007 (D16); test record 0002
 * conditions C1, C6, C4; kill-list K1, K2, K5.
 *
 * Real figures throughout: Microsoft FY2026, accession 0001193125-26-323660.
 */
import { describe, expect, it } from 'vitest';
import { basinDepthPx, usdFromMillions, widthPx } from '../scales';
import { closeConstriction, composeTrunk, type ResidualComponent, type TrunkInput } from './trunk';
import { CONSTRICTION_SPAN_PX } from './types';

const SEGMENT_OPERATING_INCOME = [
  usdFromMillions(83_879),
  usdFromMillions(56_972),
  usdFromMillions(14_386),
];
const NET_INCOME = usdFromMillions(133_749);
const RESIDUAL = usdFromMillions(21_488);

/**
 * The residual's two reported components, same filing, same period. Under the encoding's
 * sign convention a component is the width it REMOVES, so the tax charge is positive and
 * non-operating income is negative.
 *   us-gaap:IncomeTaxExpenseBenefit      32,185 $M
 *   us-gaap:NonoperatingIncomeExpense    10,697 $M
 */
const REPORTED_COMPONENTS: readonly ResidualComponent[] = [
  {
    id: 'income-tax-expense',
    label: 'Provision for income taxes',
    amountUsd: usdFromMillions(32_185),
  },
  {
    id: 'nonoperating-income-expense',
    label: 'Other income (expense), net',
    amountUsd: usdFromMillions(-10_697),
  },
];

const msft: TrunkInput = {
  segmentOperatingIncomeUsd: SEGMENT_OPERATING_INCOME,
  netEarningsUsd: NET_INCOME,
  residualComponents: [],
  label: 'Tax and other items outside the business segments',
};

function unwrap<T>(result: { ok: true; value: T } | { ok: false; blocked: unknown }): T {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.blocked)}`);
  return result.value;
}

describe('test record 0002 C1 — one width scale, asserted', () => {
  it('arrives carrying exactly the sum of the segment widths at the confluence', () => {
    const trunk = unwrap(composeTrunk(msft));
    const sumOfRivers = SEGMENT_OPERATING_INCOME.reduce((sum, usd) => sum + widthPx(usd), 0);
    expect(trunk.arrivingWidthPx).toBeCloseTo(sumOfRivers, 9);
    expect(trunk.arrivingWidthPx).toBeCloseTo(155.237, 9);
  });

  it('removes the same width a river constriction of the same dollars would remove', () => {
    const trunk = unwrap(composeTrunk(msft));
    // "to within a pixel" is 0002's wording; this holds to within a float ulp.
    expect(trunk.constriction.removedWidthPx).toBe(widthPx(RESIDUAL));
    expect(Math.abs(trunk.constriction.removedWidthPx - widthPx(RESIDUAL))).toBeLessThan(1);
  });
});

describe('test record 0002 C6 — the residual reconciles on the real fixture', () => {
  it('leaves the trunk at exactly consolidated net income: 155,237 - 21,488 = 133,749', () => {
    const trunk = unwrap(composeTrunk(msft));
    expect(trunk.constriction.costUsd).toBeCloseTo(RESIDUAL, 0);
    expect(trunk.departingUsd).toBe(NET_INCOME);
    expect(trunk.departingWidthPx).toBeCloseTo(133.749, 9);
    expect(trunk.arrivingWidthPx - trunk.constriction.removedWidthPx).toBeCloseTo(
      trunk.departingWidthPx,
      9,
    );
  });
});

describe('the residual reads as a real quantity, not decoration', () => {
  it('is the smallest narrowing as a ratio — 13.84% — and that is not corrected', () => {
    const trunk = unwrap(composeTrunk(msft));
    const ratio = (trunk.constriction.removedWidthPx / trunk.arrivingWidthPx) * 100;
    expect(ratio).toBeCloseTo(13.84, 2);
    // Kill-list K1 and K2. If either had crept in, this ratio would have moved.
  });

  it('takes a wider bite than the whole third river brings in', () => {
    const trunk = unwrap(composeTrunk(msft));
    expect(trunk.constriction.removedWidthPx).toBeGreaterThan(widthPx(usdFromMillions(14_386)));
  });

  it('carries the mandatory dollar annotation instead of an attention effect (K5)', () => {
    const trunk = unwrap(composeTrunk(msft));
    expect(trunk.constriction.annotation.required).toBe(true);
    expect(trunk.constriction.annotation.dimensionedWidthPx).toBe(
      trunk.constriction.removedWidthPx,
    );
    const serialized = JSON.stringify(trunk);
    for (const effect of ['pulse', 'glow', 'burst', 'emphasis', 'highlight']) {
      expect(serialized.toLowerCase()).not.toContain(effect);
    }
  });
});

describe('test record 0002 C4 — distinct in kind from a river constriction', () => {
  it('is marked as requiring a distinct treatment and is typed as trunk-residual', () => {
    const trunk = unwrap(composeTrunk(msft));
    expect(trunk.constriction.kind).toBe('trunk-residual');
    expect(trunk.constriction.distinctTreatmentRequired).toBe(true);
  });

  it('does not take the distinction from its length — every span is identical', () => {
    const trunk = unwrap(composeTrunk(msft));
    expect(trunk.constriction.spanPx).toBe(CONSTRICTION_SPAN_PX);
  });

  it('does not take the distinction from colour — no colour exists in the model', () => {
    expect(JSON.stringify(unwrap(composeTrunk(msft)))).not.toMatch(/colou?r|hue|#[0-9a-f]{6}/i);
  });
});

describe('test record 0002 C3 — itemisation of the residual', () => {
  it('marks itemisation as required and unmet when no components are supplied', () => {
    const trunk = unwrap(composeTrunk(msft));
    expect(trunk.itemization.required).toBe(true);
    expect(trunk.itemization.provided).toBe(false);
  });

  it('accepts the two reported components, which tie to the residual with nothing left over', () => {
    // The real split, from the same filing. Sign convention is "width removed", so tax
    // expense removes and non-operating income gives back:
    //   32,185 - 10,697 = 21,488, unexplained $0.
    const trunk = unwrap(composeTrunk({ ...msft, residualComponents: REPORTED_COMPONENTS }));
    expect(trunk.itemization.provided).toBe(true);
    expect(trunk.itemization.components).toHaveLength(2);
    const total = trunk.itemization.components.reduce((sum, part) => sum + part.amountUsd, 0);
    expect(total).toBe(RESIDUAL);
    expect(total - trunk.constriction.costUsd).toBe(0);
  });

  it('refuses components that do not tie, rather than showing a breakdown that is wrong', () => {
    const result = composeTrunk({
      ...msft,
      // The tax line alone, without the non-operating offset: a real, likely failure mode.
      residualComponents: [REPORTED_COMPONENTS[0] as ResidualComponent],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blocked[0]?.code).toBe('residual-components-do-not-sum');
  });
});

describe('open question Q2 — a positive residual', () => {
  it('blocks instead of inventing a widening trunk', () => {
    const result = composeTrunk({
      ...msft,
      netEarningsUsd: usdFromMillions(160_000),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blocked[0]?.code).toBe('trunk-residual-positive');
    expect(result.blocked[0]?.escalation).toBe('Q2');
  });
});

describe('Invariant 3.4 — a loss-making filer composes, and does not throw', () => {
  /**
   * Same three segments, same $155,237M arriving at the confluence. Only the consolidated
   * result is moved below zero, which is the whole point: a loss is an ordinary shape for
   * a technology filer and the rivers are unchanged by it.
   */
  const LOSS = usdFromMillions(-40_000);
  const loss: TrunkInput = { ...msft, netEarningsUsd: LOSS };
  const lossResidual = usdFromMillions(155_237) - LOSS;

  it('returns a geometry instead of a ScaleDomainError', () => {
    expect(() => composeTrunk(loss)).not.toThrow();
    expect(composeTrunk(loss).ok).toBe(true);
  });

  it('is consumed entirely at the constriction: 0px departing, $0 departing', () => {
    const trunk = unwrap(composeTrunk(loss));
    expect(trunk.arrivingWidthPx).toBeCloseTo(155.237, 9);
    expect(trunk.departingWidthPx).toBe(0);
    expect(trunk.departingUsd).toBe(0);
    expect(trunk.terminatesAtConstriction).toBe(true);
    // Width has no sign channel. widthPx(|net|) = 40px must appear NOWHERE as a flow.
    expect(trunk.departingWidthPx).not.toBeCloseTo(widthPx(-LOSS), 6);
  });

  it('never puts a negative width on any station or on the constriction', () => {
    for (const net of [-1, -100, -1_000, -40_000, -133_749, -900_000]) {
      const trunk = unwrap(composeTrunk({ ...msft, netEarningsUsd: usdFromMillions(net) }));
      for (const station of trunk.stations) {
        expect(station.widthPx).toBeGreaterThanOrEqual(0);
        expect(station.halfWidthPx).toBeGreaterThanOrEqual(0);
      }
      expect(trunk.constriction.widthAfterPx).toBe(0);
      expect(trunk.constriction.removedWidthPx).toBeCloseTo(trunk.arrivingWidthPx, 12);
      expect(trunk.constriction.removedPerBankPx * 2).toBeCloseTo(trunk.arrivingWidthPx, 12);
    }
  });

  it('still states the FULL claim in dollars — the reader is never told the pinch cost less', () => {
    const trunk = unwrap(composeTrunk(loss));
    expect(trunk.constriction.costUsd).toBe(lossResidual);
    expect(trunk.constriction.annotation.valueUsd).toBe(lossResidual);
    expect(trunk.constriction.annotation.dimensionedWidthPx).toBe(widthPx(lossResidual));
    // The drawn removal is smaller than the claim. That gap is the thing being disclosed.
    expect(trunk.constriction.removedWidthPx).toBeLessThan(
      trunk.constriction.annotation.dimensionedWidthPx,
    );
  });

  it('conserves: removed width + unrepresented width = the width of the whole claim', () => {
    const trunk = unwrap(composeTrunk(loss));
    const overdraw = trunk.constriction.overdraw;
    expect(overdraw).not.toBeNull();
    if (overdraw === null) return;
    expect(overdraw.claimedCostUsd).toBe(trunk.constriction.costUsd);
    expect(overdraw.representedCostUsd).toBe(trunk.arrivingUsd);
    expect(overdraw.unrepresentedUsd).toBe(-LOSS);
    expect(trunk.constriction.removedWidthPx + overdraw.unrepresentedWidthPx).toBeCloseTo(
      widthPx(trunk.constriction.costUsd),
      9,
    );
    expect(overdraw.annotationRequired).toBe(true);
  });

  /**
   * THE LOAD-BEARING TEST. `depth.ts` pins DEPTH_USD_PER_PX to WIDTH_USD_PER_PX by
   * identity, so the width the constriction could not remove IS the depth the basin sinks
   * below grade. This is what makes the closure a derivation rather than a clamp that
   * happened to look tidy. It must fail loudly if anyone ever unpins the depth constant.
   */
  it('hands the shortfall to the basin: unrepresented width IS the basin depth', () => {
    for (const net of [-1, -1_000, -40_000, -133_749]) {
      const netUsd = usdFromMillions(net);
      const trunk = unwrap(composeTrunk({ ...msft, netEarningsUsd: netUsd }));
      const overdraw = trunk.constriction.overdraw;
      expect(overdraw?.unrepresentedWidthPx).toBe(basinDepthPx(netUsd));
      expect(overdraw?.unrepresentedWidthPx).toBe(widthPx(-netUsd));
      expect(overdraw?.carriedBy).toBe('basin-plan-area-and-depth');
    }
  });

  it('is continuous through zero — break-even terminates too, with no shortfall', () => {
    const evenTrunk = unwrap(composeTrunk({ ...msft, netEarningsUsd: 0 }));
    expect(evenTrunk.departingWidthPx).toBe(0);
    expect(evenTrunk.terminatesAtConstriction).toBe(true);
    expect(evenTrunk.constriction.overdraw).toBeNull();
    expect(evenTrunk.constriction.removedWidthPx).toBe(evenTrunk.arrivingWidthPx);

    const barelyUp = unwrap(composeTrunk({ ...msft, netEarningsUsd: 1 }));
    const barelyDown = unwrap(composeTrunk({ ...msft, netEarningsUsd: -1 }));
    expect(barelyUp.departingWidthPx).toBeCloseTo(1e-9, 12);
    expect(barelyDown.departingWidthPx).toBe(0);
    expect(barelyDown.constriction.overdraw?.unrepresentedWidthPx).toBeCloseTo(1e-9, 12);
    expect(barelyUp.terminatesAtConstriction).toBe(false);
  });

  it('leaves a profitable trunk with no overdraw at all', () => {
    const trunk = unwrap(composeTrunk(msft));
    expect(trunk.constriction.overdraw).toBeNull();
    expect(trunk.terminatesAtConstriction).toBe(false);
    expect(trunk.departingUsd).toBe(NET_INCOME);
  });

  it('still itemises the residual on a loss, and still refuses an itemisation that misses', () => {
    const tied = unwrap(
      composeTrunk({
        ...loss,
        residualComponents: [
          { id: 'tax', label: 'Provision for income taxes', amountUsd: usdFromMillions(32_185) },
          { id: 'other', label: 'Other', amountUsd: lossResidual - usdFromMillions(32_185) },
        ],
      }),
    );
    expect(tied.itemization.provided).toBe(true);
    const untied = composeTrunk({ ...loss, residualComponents: REPORTED_COMPONENTS });
    expect(untied.ok).toBe(false);
  });
});

describe('composeTrunk is total — every finite input returns, none throws', () => {
  it('refuses segments that sum to an operating loss instead of a negative-width trunk', () => {
    const result = composeTrunk({
      ...msft,
      segmentOperatingIncomeUsd: [usdFromMillions(10_000), usdFromMillions(-15_000)],
      netEarningsUsd: usdFromMillions(-20_000),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blocked.map((reason) => reason.code)).toContain('trunk-arriving-negative');
  });

  it('does not throw for any sign or magnitude of net earnings against any confluence', () => {
    const arrivals = [[], [0], [usdFromMillions(-5)], SEGMENT_OPERATING_INCOME];
    const nets = [-1e15, -133_749e6, -1, 0, 1, 133_749e6, 1e15];
    for (const segmentOperatingIncomeUsd of arrivals) {
      for (const netEarningsUsd of nets) {
        expect(() =>
          composeTrunk({ ...msft, segmentOperatingIncomeUsd, netEarningsUsd }),
        ).not.toThrow();
      }
    }
  });
});

describe('closeConstriction — the helper Q4 will reuse per component', () => {
  it('takes the claim when the flow can pay it', () => {
    const closure = closeConstriction(usdFromMillions(100), usdFromMillions(30));
    expect(closure.removedWidthPx).toBe(widthPx(usdFromMillions(30)));
    expect(closure.widthAfterPx).toBe(widthPx(usdFromMillions(70)));
    expect(closure.overdraw).toBeNull();
  });

  it('saturates at the flow when it cannot, and reports the difference', () => {
    const closure = closeConstriction(usdFromMillions(100), usdFromMillions(130));
    expect(closure.claimedWidthPx).toBe(widthPx(usdFromMillions(130)));
    expect(closure.removedWidthPx).toBe(widthPx(usdFromMillions(100)));
    expect(closure.widthAfterPx).toBe(0);
    expect(closure.overdraw?.unrepresentedUsd).toBe(usdFromMillions(30));
  });

  it('is a pure function of two quantities and knows nothing about a trunk', () => {
    expect(JSON.stringify(closeConstriction(7e9, 9e9))).toBe(
      JSON.stringify(closeConstriction(7e9, 9e9)),
    );
  });
});
