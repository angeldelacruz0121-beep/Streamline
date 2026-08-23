import { describe, expect, it } from 'vitest';
import {
  DERIVATION_METHODS,
  differenceOfReportedFigures,
  reportedBridgeRemainder,
  singleSegmentOperatingIncome,
  sumOfReportedFigures,
} from './derivations.ts';
import { reportedFigure, sourceRefsOf, usd, type Figure } from './figure.ts';
import type { SourceRef } from './source-ref.ts';

const ref = (tag: string, decimals: number | null = -6): SourceRef => ({
  cik: '0000789019',
  accession: '0001193125-26-323660',
  form: '10-K',
  documentFile: 'msft-20260630_htm.xml',
  fiscalYear: 2026,
  fiscalPeriod: 'FY',
  periodStart: '2025-07-01',
  periodEnd: '2026-06-30',
  taxonomy: 'us-gaap',
  namespace: 'http://fasb.org/us-gaap/2025',
  tag,
  contextRef: `C_${tag}`,
  unitRef: 'U_USD',
  decimals,
  dimensions: [],
  factId: null,
});

const money = (value: number, tag: string, decimals: number | null = -6): Figure =>
  reportedFigure(value, usd(), ref(tag, decimals));

describe('derivation registry', () => {
  it('states an assumption for every registered method', () => {
    for (const [id, method] of Object.entries(DERIVATION_METHODS)) {
      expect(method.id).toBe(id);
      expect(method.assumption.length).toBeGreaterThan(40);
    }
  });

  it('copies the assumption onto the figure it produces', () => {
    const result = sumOfReportedFigures([money(1, 'A'), money(2, 'B')]);

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.figure.provenance.kind).toBe('derived');

    if (result.figure.provenance.kind !== 'derived') return;

    expect(result.figure.provenance.method).toBe('sum-of-reported-figures-v1');
    expect(result.figure.provenance.assumption).toBe(
      DERIVATION_METHODS['sum-of-reported-figures-v1'].assumption,
    );
  });
});

describe('sumOfReportedFigures', () => {
  it('carries every addend’s source ref onto the total', () => {
    const result = sumOfReportedFigures([money(3, 'A'), money(4, 'B'), money(5, 'C')]);

    expect(result.ok && result.figure.value).toBe(12);
    expect(result.ok && sourceRefsOf(result.figure).map((item) => item.tag)).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('refuses an empty sum rather than returning zero', () => {
    const result = sumOfReportedFigures([]);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.detail).toContain('no provenance');
  });

  it('refuses to add across currencies', () => {
    const euro: Figure = {
      ...money(1, 'A'),
      unit: { kind: 'monetary', currency: 'EUR' },
    };
    const result = sumOfReportedFigures([money(1, 'B'), euro]);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.detail).toContain('different units');
  });

  it('reports the total no more precisely than its coarsest addend', () => {
    const result = sumOfReportedFigures([money(1, 'A', -6), money(2, 'B', -3)]);

    expect(result.ok && result.figure.decimals).toBe(-6);
  });
});

describe('differenceOfReportedFigures', () => {
  it('subtracts and keeps both source refs', () => {
    const result = differenceOfReportedFigures(
      money(155_237, 'SegmentTotal'),
      money(133_749, 'Net'),
    );

    expect(result.ok && result.figure.value).toBe(21_488);
    expect(result.ok && sourceRefsOf(result.figure)).toHaveLength(2);
  });

  it('refuses to subtract across currencies', () => {
    const euro: Figure = { ...money(1, 'A'), unit: { kind: 'monetary', currency: 'EUR' } };

    expect(differenceOfReportedFigures(money(2, 'B'), euro).ok).toBe(false);
  });
});

describe('reportedBridgeRemainder', () => {
  it('closes to zero when the reported items account for the whole gap', () => {
    const gap = money(21_488, 'Residual');
    const result = reportedBridgeRemainder(gap, [
      { amount: money(10_697, 'NonoperatingIncomeExpense'), direction: 'increases' },
      { amount: money(32_185, 'IncomeTaxExpenseBenefit'), direction: 'reduces' },
    ]);

    expect(result.ok && result.figure.value).toBe(0);
  });

  it('leaves what the items do not explain visible instead of absorbing it', () => {
    const gap = money(21_488, 'Residual');
    const result = reportedBridgeRemainder(gap, [
      { amount: money(32_185, 'IncomeTaxExpenseBenefit'), direction: 'reduces' },
    ]);

    expect(result.ok && result.figure.value).toBe(-10_697);
  });

  it('returns the gap itself when nothing is reported to explain it', () => {
    const result = reportedBridgeRemainder(money(21_488, 'Residual'), []);

    expect(result.ok && result.figure.value).toBe(21_488);
  });

  it('refuses to bridge across currencies', () => {
    const euro: Figure = { ...money(1, 'A'), unit: { kind: 'monetary', currency: 'EUR' } };
    const result = reportedBridgeRemainder(money(2, 'B'), [{ amount: euro, direction: 'reduces' }]);

    expect(result.ok).toBe(false);
  });
});

describe('single-segment-operating-income-from-consolidated-v1', () => {
  /**
   * Autodesk FY2026, accession 0000769397-26-000015, period 2025-02-01 ->
   * 2026-01-31, all read from the wire. The filer tags eleven operating costs,
   * income tax, interest and net income on its one segment — and no operating
   * income anywhere on the segment axis.
   */
  const ADSK_REVENUE = 7_206_000_000;
  const ADSK_OPERATING_COSTS = [
    420_000_000, // adsk:CostOfRevenueAdjusted
    74_000_000, // adsk:CostOfGoodsAndServicesSoldAdjusted
    97_000_000, // CostOfGoodsAndServicesSoldAmortization
    1_666_000_000, // SellingAndMarketingExpense
    1_304_000_000, // ResearchAndDevelopmentExpense
    563_000_000, // GeneralAndAdministrativeExpense
    53_000_000, // AmortizationOfIntangibleAssets
    216_000_000, // RestructuringCosts
    447_000_000, // adsk:NewTransactionModelCost
    788_000_000, // AllocatedShareBasedCompensationExpense
  ];
  const ADSK_CONSOLIDATED_OPERATING_INCOME = 1_578_000_000;

  const costs = ADSK_OPERATING_COSTS.map((value, at) => money(value, `Cost${String(at)}`));

  it('attributes consolidated operating income to the one segment when the bridge ties', () => {
    const result = singleSegmentOperatingIncome(
      money(ADSK_CONSOLIDATED_OPERATING_INCOME, 'OperatingIncomeLoss'),
      money(ADSK_REVENUE, 'RevenueFromContractWithCustomerExcludingAssessedTax'),
      costs,
    );

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.figure.value).toBe(ADSK_CONSOLIDATED_OPERATING_INCOME);
    expect(result.figure.provenance.kind).toBe('derived');
    expect(sourceRefsOf(result.figure).map((item) => item.tag)).toEqual(['OperatingIncomeLoss']);
  });

  it('is the filer’s own arithmetic: 7,206 − 5,628 = 1,578', () => {
    const total = ADSK_OPERATING_COSTS.reduce((running, value) => running + value, 0);

    expect(total).toBe(5_628_000_000);
    expect(ADSK_REVENUE - total).toBe(ADSK_CONSOLIDATED_OPERATING_INCOME);
  });

  it('carries the assumption on the figure, so a panel can show it', () => {
    const result = singleSegmentOperatingIncome(
      money(ADSK_CONSOLIDATED_OPERATING_INCOME, 'OperatingIncomeLoss'),
      money(ADSK_REVENUE, 'Revenue'),
      costs,
    );

    expect(
      result.ok &&
        result.figure.provenance.kind === 'derived' &&
        result.figure.provenance.assumption,
    ).toContain('exactly one reportable segment');
  });

  it('refuses when the segment’s costs do not carry its revenue to that amount', () => {
    const result = singleSegmentOperatingIncome(
      money(ADSK_CONSOLIDATED_OPERATING_INCOME, 'OperatingIncomeLoss'),
      money(ADSK_REVENUE, 'Revenue'),
      costs.slice(0, 5),
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.detail).toContain('describing different things');
  });

  it('allows only the rounding slack the filer’s own decimals imply', () => {
    const withinSlack = singleSegmentOperatingIncome(
      money(ADSK_CONSOLIDATED_OPERATING_INCOME + 400_000, 'OperatingIncomeLoss'),
      money(ADSK_REVENUE, 'Revenue'),
      costs,
    );
    const outsideSlack = singleSegmentOperatingIncome(
      money(ADSK_CONSOLIDATED_OPERATING_INCOME + 600_000, 'OperatingIncomeLoss'),
      money(ADSK_REVENUE, 'Revenue'),
      costs,
    );

    expect(withinSlack.ok).toBe(true);
    expect(outsideSlack.ok).toBe(false);
  });

  it('refuses across units rather than producing a number that is not a quantity', () => {
    const result = singleSegmentOperatingIncome(
      {
        ...money(ADSK_CONSOLIDATED_OPERATING_INCOME, 'OperatingIncomeLoss'),
        unit: { kind: 'pure' },
      },
      money(ADSK_REVENUE, 'Revenue'),
      costs,
    );

    expect(result.ok).toBe(false);
  });
});
