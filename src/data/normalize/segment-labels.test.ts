import { describe, expect, it } from 'vitest';
import {
  labelFromMemberLocalName,
  resolveSegmentLabels,
  scanRenderedReport,
} from './segment-labels.ts';
import { readTaxonomyIndex, type TaxonomyIndex } from './taxonomy-presentation.ts';
import { MSFT_METALINKS_EXCERPT, MSFT_SEGMENT_RFILE_EXCERPT } from './__fixtures__/msft-fy2026.ts';

function index(): TaxonomyIndex {
  const result = readTaxonomyIndex(MSFT_METALINKS_EXCERPT);

  if (result.kind !== 'ok') throw new Error(result.detail);

  return result.index;
}

const MEMBERS = [
  {
    qname: 'msft:ProductivityAndBusinessProcessesMember',
    localName: 'ProductivityAndBusinessProcessesMember',
  },
  { qname: 'msft:IntelligentCloudMember', localName: 'IntelligentCloudMember' },
  { qname: 'msft:MorePersonalComputingMember', localName: 'MorePersonalComputingMember' },
];

describe('rendered report scan', () => {
  const scan = scanRenderedReport(MSFT_SEGMENT_RFILE_EXCERPT);

  it('reads the member column headings the filer printed', () => {
    expect(scan.memberLabels.get('msft:ProductivityAndBusinessProcessesMember')).toBe(
      'Productivity and Business Processes',
    );
    expect(scan.memberLabels.get('msft:IntelligentCloudMember')).toBe('Intelligent Cloud');
    expect(scan.memberLabels.get('msft:MorePersonalComputingMember')).toBe(
      'More Personal Computing',
    );
  });

  it('reads the measures in the order the filer presents them', () => {
    expect(scan.concepts.map((concept) => concept.ref)).toEqual([
      'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax',
      'us-gaap_CostOfGoodsAndServicesSold',
      'us-gaap_OperatingExpenses',
      'us-gaap_OperatingIncomeLoss',
    ]);
  });

  it('keeps the filer’s wording for each measure', () => {
    const labels = new Map(scan.concepts.map((concept) => [concept.ref, concept.label]));

    expect(labels.get('us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax')).toBe(
      'Revenue',
    );
    expect(labels.get('us-gaap_CostOfGoodsAndServicesSold')).toBe('Cost of revenue');
    expect(labels.get('us-gaap_OperatingIncomeLoss')).toBe('Operating income');
  });

  it('finds nothing in a document with no anchors, rather than throwing', () => {
    const empty = scanRenderedReport('<html><body>no anchors here</body></html>');

    expect(empty.concepts).toHaveLength(0);
    expect(empty.memberLabels.size).toBe(0);
  });
});

describe('segment label resolution', () => {
  it('prefers the filer’s label linkbase and records that source', () => {
    const resolved = resolveSegmentLabels(
      MEMBERS,
      index(),
      scanRenderedReport(MSFT_SEGMENT_RFILE_EXCERPT),
    );

    expect(resolved.conflicts).toHaveLength(0);
    expect(resolved.labels.get('msft:IntelligentCloudMember')).toEqual({
      label: 'Intelligent Cloud',
      source: 'label-linkbase',
    });
  });

  it('falls back to the rendered heading when there is no linkbase', () => {
    const resolved = resolveSegmentLabels(
      MEMBERS,
      null,
      scanRenderedReport(MSFT_SEGMENT_RFILE_EXCERPT),
    );

    expect(resolved.labels.get('msft:IntelligentCloudMember')).toEqual({
      label: 'Intelligent Cloud',
      source: 'rendered-report',
    });
  });

  it('falls back to the member’s own name last, and says that is what it did', () => {
    const resolved = resolveSegmentLabels(MEMBERS, null, null);

    expect(resolved.labels.get('msft:MorePersonalComputingMember')).toEqual({
      label: 'More Personal Computing',
      source: 'member-local-name',
    });
  });

  it('reports a disagreement between the linkbase and the rendered schedule', () => {
    const tampered = MSFT_SEGMENT_RFILE_EXCERPT.replace(
      '>Intelligent Cloud<',
      '>More Personal Computing<',
    );

    expect(tampered).not.toBe(MSFT_SEGMENT_RFILE_EXCERPT);

    const resolved = resolveSegmentLabels(MEMBERS, index(), scanRenderedReport(tampered));

    expect(resolved.conflicts).toHaveLength(1);
    expect(resolved.conflicts[0]?.member).toBe('msft:IntelligentCloudMember');
    expect(resolved.conflicts[0]?.linkbaseLabel).toBe('Intelligent Cloud');
    expect(resolved.conflicts[0]?.renderedLabel).toBe('More Personal Computing');
  });

  it('does not treat case and punctuation as a disagreement', () => {
    const restyled = MSFT_SEGMENT_RFILE_EXCERPT.replace(
      '>Intelligent Cloud<',
      '>INTELLIGENT  CLOUD<',
    );
    const resolved = resolveSegmentLabels(MEMBERS, index(), scanRenderedReport(restyled));

    expect(resolved.conflicts).toHaveLength(0);
  });

  it('splits a member local name on case boundaries', () => {
    expect(labelFromMemberLocalName('MorePersonalComputingMember')).toBe('More Personal Computing');
    expect(labelFromMemberLocalName('AWSMember')).toBe('AWS');
  });
});

describe('rendered-heading-may-compound-members-v1', () => {
  it('reads a compound column heading as naming its segment, not contradicting it', () => {
    // Apple's R68 heading for the Americas column is `Americas | Operating
    // segments`, because the context carries two axes. Compared whole, it
    // reported every Apple segment as a naming conflict.
    const result = resolveSegmentLabels(
      [{ qname: 'aapl:AmericasSegmentMember', localName: 'AmericasSegmentMember' }],
      null,
      {
        concepts: [],
        memberLabels: new Map([['aapl:AmericasSegmentMember', 'Americas | Operating segments']]),
      },
    );

    expect(result.conflicts).toEqual([]);
    expect(result.labels.get('aapl:AmericasSegmentMember')?.label).toBe(
      'Americas | Operating segments',
    );
  });

  it('still reports a heading that names a different segment', () => {
    const result = resolveSegmentLabels(
      [
        {
          qname: 'msft:IntelligentCloudMember',
          localName: 'IntelligentCloudMember',
        },
      ],
      index(),
      {
        concepts: [],
        memberLabels: new Map([
          ['msft:IntelligentCloudMember', 'More Personal Computing | Operating segments'],
        ]),
      },
    );

    expect(result.conflicts).toHaveLength(1);
  });
});
