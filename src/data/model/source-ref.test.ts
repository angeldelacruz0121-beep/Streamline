import { describe, expect, it } from 'vitest';
import { describeSourceRef, factKey, qualifiedTag, type SourceRef } from './source-ref.ts';

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
  tag: 'OperatingIncomeLoss',
  contextRef: 'C_1',
  unitRef: 'U_USD',
  decimals: -6,
  dimensions: [
    {
      axis: 'us-gaap:StatementBusinessSegmentsAxis',
      axisNamespace: 'http://fasb.org/us-gaap/2025',
      axisLocalName: 'StatementBusinessSegmentsAxis',
      member: 'msft:IntelligentCloudMember',
      memberNamespace: 'http://www.microsoft.com/20260630',
      memberLocalName: 'IntelligentCloudMember',
    },
  ],
  factId: 'F_1',
};

describe('SourceRef', () => {
  it('renders the qualified tag from prefix and local name', () => {
    expect(qualifiedTag(ref)).toBe('us-gaap:OperatingIncomeLoss');
  });

  it('keys a fact on namespace, tag, context and unit, not on the prefix', () => {
    const rebound: SourceRef = { ...ref, taxonomy: 'gaap' };

    expect(factKey(rebound)).toBe(factKey(ref));
  });

  it('separates facts that differ only by context', () => {
    expect(factKey({ ...ref, contextRef: 'C_2' })).not.toBe(factKey(ref));
  });

  it('describes a segment fact with everything needed to find it in the filing', () => {
    const described = describeSourceRef(ref);

    expect(described).toContain('us-gaap:OperatingIncomeLoss');
    expect(described).toContain('0001193125-26-323660');
    expect(described).toContain('10-K');
    expect(described).toContain('FY2026');
    expect(described).toContain('2025-07-01 to 2026-06-30');
    expect(described).toContain(
      'us-gaap:StatementBusinessSegmentsAxis=msft:IntelligentCloudMember',
    );
  });

  it('says so when a fact carries no dimensions', () => {
    expect(describeSourceRef({ ...ref, dimensions: [] })).toContain('consolidated');
  });
});
