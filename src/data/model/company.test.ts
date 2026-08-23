import { describe, expect, it } from 'vitest';
import { isRenderable, renderableFigures, type CompanyView } from './company.ts';
import { reportedFigure, sourceRefsOf, usd } from './figure.ts';
import type { SourceRef } from './source-ref.ts';

const ref: SourceRef = {
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
  tag: 'RevenueFromContractWithCustomerExcludingAssessedTax',
  contextRef: 'C_1',
  unitRef: 'U_USD',
  decimals: -6,
  dimensions: [],
  factId: null,
};

const outOfCoverage: CompanyView = {
  kind: 'out-of-coverage',
  entity: {
    cik: '0000000001',
    name: 'AN OUT OF SCOPE FILER',
    sic: '2834',
    sicDescription: 'Pharmaceutical Preparations',
    filerCategory: null,
    tickers: [],
    exchanges: [],
  },
  detail: 'Out of coverage.',
  ranges: [
    [3570, 3579],
    [7370, 7379],
  ],
};

describe('CompanyView', () => {
  it('narrows a data-quality state away from the renderable arm', () => {
    expect(isRenderable(outOfCoverage)).toBe(false);
  });

  it('exposes no figures for a state that renders none', () => {
    expect(renderableFigures(outOfCoverage)).toEqual([]);
  });

  it('exposes the figures behind a reconciliation break, so the break can be shown', () => {
    const total = reportedFigure(1, usd(), ref);
    const view: CompanyView = {
      kind: 'reconciliation-break',
      entity: outOfCoverage.entity,
      filing: {
        accession: '0001193125-26-323660',
        form: '10-K',
        filedAt: '2026-07-29',
        periodOfReport: '2026-06-30',
        documentFile: 'msft-20260630_htm.xml',
      },
      period: {
        kind: 'annual',
        fiscalYear: 2026,
        focus: 'FY',
        start: '2025-07-01',
        end: '2026-06-30',
        days: 365,
        weekBasis: 'calendar-months',
        fiscalYearEndMonthDay: '06-30',
        calendarAligned: false,
        transition: false,
        label: 'FY2026',
      },
      reconciliation: {
        segmentRevenueTotal: total,
        consolidatedRevenue: total,
        difference: total,
        ratio: 0.06,
        tolerance: 0.005,
        withinTolerance: false,
        unallocated: [],
      },
      detail: 'Broken.',
      notes: [],
    };

    const figures = renderableFigures(view);

    expect(figures).toHaveLength(3);

    for (const figure of figures) expect(sourceRefsOf(figure).length).toBeGreaterThan(0);
  });
});
