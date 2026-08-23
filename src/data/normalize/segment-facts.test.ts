import { describe, expect, it } from 'vitest';
import {
  measureLabel,
  resolveSegmentScheduleRoles,
  BELOW_THE_LINE_CONCEPTS,
  SEGMENT_OPERATING_PROFIT_CONCEPTS,
  SEGMENT_REVENUE_CONCEPTS,
  selectSegmentMeasures,
  selectSegmentScheduleRole,
} from './segment-facts.ts';
import { scanRenderedReport } from './segment-labels.ts';
import { readTaxonomyIndex, tagKeyToQName, type TaxonomyIndex } from './taxonomy-presentation.ts';
import { MSFT_METALINKS_EXCERPT, MSFT_SEGMENT_RFILE_EXCERPT } from './__fixtures__/msft-fy2026.ts';

function index(text: string = MSFT_METALINKS_EXCERPT): TaxonomyIndex {
  const result = readTaxonomyIndex(text);

  if (result.kind !== 'ok') throw new Error(result.detail);

  return result.index;
}

const rendered = scanRenderedReport(MSFT_SEGMENT_RFILE_EXCERPT);

describe('resolveSegmentScheduleRoles', () => {
  it('resolves to exactly one schedule for this filing', () => {
    const roles = resolveSegmentScheduleRoles(index());

    expect(roles).toHaveLength(1);
    expect(roles[0]).toContain('SegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncome');
  });

  it('does not match the goodwill schedule, which carries the same axis', () => {
    const roles = resolveSegmentScheduleRoles(index());

    expect(roles.some((role) => /Goodwill/i.test(role))).toBe(false);
  });

  it('resolves nothing when the filing presents no segment axis', () => {
    const withoutAxis = MSFT_METALINKS_EXCERPT.replace(
      /StatementBusinessSegmentsAxis/g,
      'DisaggregationOfRevenueAxis',
    );

    expect(resolveSegmentScheduleRoles(index(withoutAxis))).toEqual([]);
  });
});

describe('selectSegmentMeasures', () => {
  const role = resolveSegmentScheduleRoles(index())[0] ?? '';

  it('takes the measure set from the filer, not from a fixed template', () => {
    const result = selectSegmentMeasures(index(), role, rendered);

    expect(result.kind).toBe('ok');

    if (result.kind !== 'ok') return;

    expect(tagKeyToQName(result.selection.revenue.key)).toBe(
      'us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax',
    );
    expect(result.selection.profit).not.toBeNull();
    expect(tagKeyToQName(result.selection.profit?.key ?? '')).toBe('us-gaap:OperatingIncomeLoss');
    expect(result.selection.costs.map((tag) => tagKeyToQName(tag.key))).toEqual([
      'us-gaap:CostOfGoodsAndServicesSold',
      'us-gaap:OperatingExpenses',
    ]);
  });

  it('orders the costs the way the filer presents them', () => {
    const result = selectSegmentMeasures(index(), role, rendered);

    expect(result.kind === 'ok' && result.selection.orderSource).toBe('rendered-report');
  });

  it('says so when the filer’s own order is unavailable', () => {
    const result = selectSegmentMeasures(index(), role, null);

    expect(result.kind === 'ok' && result.selection.orderSource).toBe('linkbase-order');
  });

  it('uses the filer’s wording for each cost category', () => {
    const result = selectSegmentMeasures(index(), role, rendered);

    if (result.kind !== 'ok') throw new Error(result.detail);

    expect(result.selection.costs.map((tag) => measureLabel(tag, rendered))).toEqual([
      'Cost of revenue',
      'Operating expenses',
    ]);
  });

  it('refuses a role with no monetary concepts at all', () => {
    const result = selectSegmentMeasures(index(), 'http://nowhere.example/role', rendered);

    expect(result.kind).toBe('unresolved');
    expect(result.kind === 'unresolved' && result.detail).toContain('no monetary concepts');
  });

  it('refuses rather than choosing when two revenue concepts are presented', () => {
    const ambiguous = MSFT_METALINKS_EXCERPT.replace(
      /"us-gaap_ResearchAndDevelopmentExpense"/,
      '"us-gaap_Revenues"',
    ).replace(/"localname": "ResearchAndDevelopmentExpense"/, '"localname": "Revenues"');
    const patched = index(
      ambiguous.replace(
        /("us-gaap_Revenues": \{[\s\S]*?"presentation": \[)/,
        `$1\n    "${resolveSegmentScheduleRoles(index())[0] ?? ''}",`,
      ),
    );
    const result = selectSegmentMeasures(patched, role, rendered);

    expect(result.kind).toBe('unresolved');
    expect(result.kind === 'unresolved' && result.detail).toContain(
      'Expected exactly one segment revenue concept',
    );
  });

  it('reports no operating profit rather than substituting one it cannot place', () => {
    // The filer's profit measure is its own concept, not GAAP operating income.
    // The river then has no reported end, which the caller resolves or refuses —
    // it is never filled in from a measure below the operating line.
    const noProfit = MSFT_METALINKS_EXCERPT.replace(
      /"localname": "OperatingIncomeLoss"/,
      '"localname": "SegmentContributionMargin"',
    );
    const result = selectSegmentMeasures(index(noProfit), role, rendered);

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.selection.profit).toBeNull();
  });

  it('never ends a river at net income, and never draws tax as a segment cost', () => {
    // Autodesk's shape: the filer tags its whole income statement to its one
    // segment, so the schedule presents net income, tax and interest.
    const belowTheLine = MSFT_METALINKS_EXCERPT.replace(
      /"localname": "OperatingIncomeLoss"/,
      '"localname": "NetIncomeLoss"',
    ).replace(/"localname": "OperatingExpenses"/, '"localname": "IncomeTaxExpenseBenefit"');
    const result = selectSegmentMeasures(index(belowTheLine), role, rendered);

    expect(result.kind).toBe('ok');

    if (result.kind !== 'ok') return;

    expect(result.selection.profit).toBeNull();
    expect(result.selection.costs.map((tag) => tag.localName)).not.toContain(
      'IncomeTaxExpenseBenefit',
    );
    expect(result.selection.costs.map((tag) => tag.localName)).not.toContain('NetIncomeLoss');
    expect(result.selection.belowTheLine.map((tag) => tag.localName).sort()).toEqual([
      'IncomeTaxExpenseBenefit',
      'NetIncomeLoss',
    ]);
  });

  it('classifies only standard concepts, and says which', () => {
    expect(SEGMENT_REVENUE_CONCEPTS).toContain(
      'RevenueFromContractWithCustomerExcludingAssessedTax',
    );
    expect(SEGMENT_OPERATING_PROFIT_CONCEPTS).toEqual(['OperatingIncomeLoss']);
    expect(SEGMENT_REVENUE_CONCEPTS).not.toContain('OperatingIncomeLoss');
  });

  it('places tax, interest and net income below the line, where D16 puts them', () => {
    for (const concept of [
      'IncomeTaxExpenseBenefit',
      'InterestIncomeExpenseNonoperatingNet',
      'NonoperatingIncomeExpense',
      'NetIncomeLoss',
      'ProfitLoss',
    ]) {
      expect(BELOW_THE_LINE_CONCEPTS).toContain(concept);
    }

    expect(BELOW_THE_LINE_CONCEPTS).not.toContain('OperatingIncomeLoss');
    expect(BELOW_THE_LINE_CONCEPTS).not.toContain('CostOfGoodsAndServicesSold');
  });
});

describe('prefer-role-presenting-operating-profit-v1', () => {
  const SEGMENT_ROLE =
    'http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail';
  const DISAGGREGATION_ROLE =
    'http://www.microsoft.com/20260630/taxonomy/role/DisclosureRevenueByProduct';

  /**
   * Adds a second candidate role to the filer's presentation linkbase — one that
   * presents the segment axis and revenue but no operating income. That is the
   * shape of a disaggregation-of-revenue note, and it is what Meta, Alphabet,
   * Diebold and IBM all file beside their segment note.
   */
  function withRevenueOnlySecondRole(alsoPresentProfitThere = false): string {
    const addTo = (metalinks: string, tagKey: string): string =>
      metalinks.replace(
        new RegExp(`("${tagKey}": \\{[\\s\\S]*?"presentation": \\[\\n)`),
        `$1      "${DISAGGREGATION_ROLE}",\n`,
      );

    let mutated = addTo(MSFT_METALINKS_EXCERPT, 'us-gaap_StatementBusinessSegmentsAxis');

    mutated = addTo(mutated, 'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax');

    return alsoPresentProfitThere ? addTo(mutated, 'us-gaap_OperatingIncomeLoss') : mutated;
  }

  it('takes the one role when the filing has only one', () => {
    const choice = selectSegmentScheduleRole(index());

    expect(choice.kind).toBe('ok');
    expect(choice.kind === 'ok' && choice.role).toBe(SEGMENT_ROLE);
  });

  it('prefers the candidate that also presents operating income', () => {
    const metalinks = withRevenueOnlySecondRole();

    expect(metalinks).not.toBe(MSFT_METALINKS_EXCERPT);

    const candidates = resolveSegmentScheduleRoles(index(metalinks));
    const choice = selectSegmentScheduleRole(index(metalinks));

    expect(candidates).toHaveLength(2);
    expect(choice.kind).toBe('ok');
    expect(choice.kind === 'ok' && choice.role).toBe(SEGMENT_ROLE);
  });

  it('refuses when two candidates both present operating income, rather than ordering them', () => {
    const metalinks = withRevenueOnlySecondRole(true);
    const choice = selectSegmentScheduleRole(index(metalinks));

    expect(choice.kind).toBe('ambiguous');
    expect(choice.kind === 'ambiguous' && [...choice.qualified].sort()).toEqual(
      [DISAGGREGATION_ROLE, SEGMENT_ROLE].sort(),
    );
  });

  it('refuses when no candidate presents operating income, rather than taking the revenue role', () => {
    const noProfitRole = withRevenueOnlySecondRole().replace(
      /"us-gaap_OperatingIncomeLoss": \{[\s\S]*?"presentation": \[\n[\s\S]*?\n     \],/,
      '"us-gaap_OperatingIncomeLoss": {\n     "xbrltype": "monetaryItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "OperatingIncomeLoss",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementINCOMESTATEMENTS"\n     ],',
    );
    const choice = selectSegmentScheduleRole(index(noProfitRole));

    expect(choice.kind).toBe('ambiguous');
    expect(choice.kind === 'ambiguous' && choice.qualified).toEqual([]);
  });

  it('reports no candidate at all as absent, not as a choice', () => {
    const noAxis = MSFT_METALINKS_EXCERPT.replaceAll(
      'StatementBusinessSegmentsAxis',
      'SomeOtherAxis',
    );

    expect(selectSegmentScheduleRole(index(noAxis)).kind).toBe('absent');
  });
});
