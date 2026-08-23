import { describe, expect, it } from 'vitest';
import {
  bridgeSegment,
  composeTrunkConstriction,
  reconcileRevenue,
  REVENUE_RECONCILIATION_TOLERANCE,
} from './reconciliation.ts';
import { reportedFigure, usd, type Figure } from '../model/figure.ts';
import type { Constriction } from '../model/company.ts';
import type { SourceRef } from '../model/source-ref.ts';

const ref = (tag: string): SourceRef => ({
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
  decimals: -6,
  dimensions: [],
  factId: null,
});

const money = (value: number, tag: string): Figure => reportedFigure(value, usd(), ref(tag));

// Microsoft's reported FY2026 figures, in millions of dollars.
const PBP = 139_996;
const IC = 137_791;
const MPC = 54_052;
const CONSOLIDATED_REVENUE = 331_839;

describe('revenue reconciliation, Invariant 2.4', () => {
  it('passes when the segments sum exactly', () => {
    const result = reconcileRevenue(
      [money(PBP, 'A'), money(IC, 'B'), money(MPC, 'C')],
      money(CONSOLIDATED_REVENUE, 'Consolidated'),
    );

    expect(result.kind).toBe('ok');

    if (result.kind !== 'ok') return;

    expect(result.reconciliation.segmentRevenueTotal.value).toBe(CONSOLIDATED_REVENUE);
    expect(result.reconciliation.difference.value).toBe(0);
    expect(result.reconciliation.ratio).toBe(0);
    expect(result.reconciliation.withinTolerance).toBe(true);
  });

  it('catches a broken sum', () => {
    const result = reconcileRevenue(
      [money(PBP, 'A'), money(IC, 'B'), money(MPC - 10_000, 'C')],
      money(CONSOLIDATED_REVENUE, 'Consolidated'),
    );

    if (result.kind !== 'ok') throw new Error(result.detail);

    expect(result.reconciliation.difference.value).toBe(10_000);
    expect(result.reconciliation.withinTolerance).toBe(false);
  });

  it('holds the tolerance at exactly 0.5%, inclusive', () => {
    expect(REVENUE_RECONCILIATION_TOLERANCE).toBe(0.005);

    const atLimit = reconcileRevenue([money(995, 'A')], money(1000, 'Consolidated'));
    const overLimit = reconcileRevenue([money(994, 'A')], money(1000, 'Consolidated'));

    expect(atLimit.kind === 'ok' && atLimit.reconciliation.withinTolerance).toBe(true);
    expect(overLimit.kind === 'ok' && overLimit.reconciliation.withinTolerance).toBe(false);
  });

  it('renders an unallocated amount rather than dropping it', () => {
    const unallocated: Constriction = {
      id: 'us-gaap:CorporateNonSegmentMember',
      label: 'Corporate and other',
      amount: money(1, 'Corporate'),
      direction: 'reduces',
    };
    const result = reconcileRevenue([money(999, 'A')], money(1000, 'Consolidated'), [unallocated]);

    expect(result.kind === 'ok' && result.reconciliation.unallocated).toEqual([unallocated]);
  });

  it('refuses when there are no segments to sum', () => {
    expect(reconcileRevenue([], money(1000, 'Consolidated')).kind).toBe('uncomputable');
  });

  it('refuses a percentage against a zero denominator', () => {
    expect(reconcileRevenue([money(0, 'A')], money(0, 'Consolidated')).kind).toBe('uncomputable');
  });
});

describe('trunk constriction, D16', () => {
  it('carries the gap between segment profit and net earnings, and explains it', () => {
    const result = composeTrunkConstriction({
      segmentOperatingIncome: [money(83_879, 'A'), money(56_972, 'B'), money(14_386, 'C')],
      consolidatedOperatingIncome: money(155_237, 'ConsolidatedOperatingIncome'),
      netEarnings: money(133_749, 'NetIncomeLoss'),
      components: [
        {
          id: 'us-gaap:NonoperatingIncomeExpense',
          label: 'Nonoperating Income Expense',
          amount: money(10_697, 'NonoperatingIncomeExpense'),
          direction: 'increases',
        },
        {
          id: 'us-gaap:IncomeTaxExpenseBenefit',
          label: 'Income Tax Expense Benefit',
          amount: money(32_185, 'IncomeTaxExpenseBenefit'),
          direction: 'reduces',
        },
      ],
    });

    if (result.kind !== 'ok') throw new Error(result.detail);

    expect(result.trunk.segmentOperatingIncomeTotal.value).toBe(155_237);
    expect(result.trunk.residual.value).toBe(21_488);
    expect(result.trunk.unexplained.value).toBe(0);
    expect(result.trunk.fullyExplained).toBe(true);
  });

  it('keeps what the reported items do not explain visible', () => {
    // Dollars here, not millions: `fullyExplained` is judged against the slack
    // the filer's own `decimals = -6` implies, which is half a million dollars.
    const result = composeTrunkConstriction({
      segmentOperatingIncome: [money(155_237_000_000, 'A')],
      consolidatedOperatingIncome: null,
      netEarnings: money(133_749_000_000, 'Net'),
      components: [],
    });

    if (result.kind !== 'ok') throw new Error(result.detail);

    expect(result.trunk.unexplained.value).toBe(21_488_000_000);
    expect(result.trunk.fullyExplained).toBe(false);
  });

  it('judges "explained" against the filer’s own rounding, not an invented epsilon', () => {
    // Figures reported to the million cannot be reconciled more finely than that.
    const result = composeTrunkConstriction({
      segmentOperatingIncome: [money(155_237_000_000, 'A')],
      consolidatedOperatingIncome: null,
      netEarnings: money(155_236_600_000, 'Net'),
      components: [],
    });

    if (result.kind !== 'ok') throw new Error(result.detail);

    expect(result.trunk.unexplained.value).toBe(400_000);
    expect(result.trunk.fullyExplained).toBe(true);
  });
});

describe('segment bridge', () => {
  it('closes when the disclosed costs account for the whole reduction', () => {
    const result = bridgeSegment(
      money(139_996, 'Revenue'),
      [money(25_017, 'CostOfRevenue'), money(31_100, 'OperatingExpenses')],
      money(83_879, 'OperatingIncome'),
    );

    expect(result.ok && result.figure.value).toBe(0);
  });

  it('reports the shortfall when they do not', () => {
    const result = bridgeSegment(
      money(139_996, 'Revenue'),
      [money(25_017, 'CostOfRevenue')],
      money(83_879, 'OperatingIncome'),
    );

    expect(result.ok && result.figure.value).toBe(31_100);
  });

  it('treats a segment with no disclosed costs as an open bridge, not a closed one', () => {
    const result = bridgeSegment(money(100, 'Revenue'), [], money(60, 'OperatingIncome'));

    expect(result.ok && result.figure.value).toBe(40);
  });
});
