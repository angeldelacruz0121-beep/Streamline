import { describe, expect, it } from 'vitest';
import {
  coarsestDecimals,
  derivedFigure,
  isReported,
  ProvenanceError,
  reportedFigure,
  roundingTolerance,
  sameUnit,
  sourceRefsOf,
  usd,
} from './figure.ts';
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
  contextRef: 'C_1',
  unitRef: 'U_USD',
  decimals,
  dimensions: [],
  factId: null,
});

describe('Figure', () => {
  it('carries the source ref of the fact it read', () => {
    const figure = reportedFigure(155_237_000_000, usd(), ref('OperatingIncomeLoss'));

    expect(isReported(figure)).toBe(true);
    expect(sourceRefsOf(figure)).toHaveLength(1);
    expect(sourceRefsOf(figure)[0]?.tag).toBe('OperatingIncomeLoss');
  });

  it('takes its precision from the fact rather than from the caller', () => {
    expect(reportedFigure(1, usd(), ref('X', -3)).decimals).toBe(-3);
  });

  it('refuses to build a derived figure with no source refs', () => {
    expect(() =>
      derivedFigure(1, usd(), { method: 'm', assumption: 'a', inputs: [], decimals: null }),
    ).toThrow(ProvenanceError);
  });

  it('gives every derived figure at least one traceable input', () => {
    const figure = derivedFigure(1, usd(), {
      method: 'sum-of-reported-figures-v1',
      assumption: 'stated',
      inputs: [ref('A'), ref('B')],
      decimals: -6,
    });

    expect(sourceRefsOf(figure)).toHaveLength(2);
  });

  it('treats two currencies as different units', () => {
    expect(sameUnit(usd(), { kind: 'monetary', currency: 'EUR' })).toBe(false);
    expect(sameUnit(usd(), usd())).toBe(true);
    expect(sameUnit(usd(), { kind: 'pure' })).toBe(false);
  });

  it('takes the coarsest precision of a set, not the finest', () => {
    const million = reportedFigure(1, usd(), ref('A', -6));
    const thousand = reportedFigure(1, usd(), ref('B', -3));

    expect(coarsestDecimals([million, thousand])).toBe(-6);
  });

  it('treats an unknown precision as unknown for the whole set', () => {
    const known = reportedFigure(1, usd(), ref('A', -6));
    const unknown = reportedFigure(1, usd(), ref('B', null));

    expect(coarsestDecimals([known, unknown])).toBeNull();
  });

  it('derives the rounding slack a filer’s own decimals imply', () => {
    expect(roundingTolerance(-6)).toBe(500_000);
    expect(roundingTolerance(0)).toBe(0.5);
    expect(roundingTolerance(null)).toBe(0);
  });
});
