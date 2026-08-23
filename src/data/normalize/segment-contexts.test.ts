import { describe, expect, it } from 'vitest';
import {
  ALLOWED_COMPANION_AXES,
  crossCheckSegmentCount,
  isSegmentAxis,
  scanSegmentContexts,
} from './segment-contexts.ts';
import { readXbrlInstance, type XbrlInstance } from './xbrl-instance.ts';
import { MSFT_INSTANCE_EXCERPT } from './__fixtures__/msft-fy2026.ts';
import { AAPL_SEGMENT_CONTEXTS_EXCERPT } from './__fixtures__/aapl-fy2025-contexts.ts';
import { META_SEGMENT_CONTEXTS_EXCERPT } from './__fixtures__/meta-fy2025-contexts.ts';

function load(text: string): XbrlInstance {
  const result = readXbrlInstance(text);

  if (result.kind !== 'ok') throw new Error(result.detail);

  return result.instance;
}

const FY2026 = { start: '2025-07-01', end: '2026-06-30' };
const FY2025 = { start: '2024-07-01', end: '2025-06-30' };

describe('segment member enumeration', () => {
  const instance = load(MSFT_INSTANCE_EXCERPT);

  it('discovers the filer’s own members without any list of them', () => {
    const scan = scanSegmentContexts(instance, FY2026);

    expect(scan.axisPresent).toBe(true);
    expect(scan.members.map((member) => member.qname).sort()).toEqual([
      'msft:IntelligentCloudMember',
      'msft:MorePersonalComputingMember',
      'msft:ProductivityAndBusinessProcessesMember',
    ]);
  });

  it('finds members in the filer’s namespace, not in us-gaap', () => {
    const scan = scanSegmentContexts(instance, FY2026);

    for (const member of scan.members) {
      expect(member.namespace).toBe('http://www.microsoft.com/20260630');
      expect(member.localName.endsWith('Member')).toBe(true);
    }
  });

  it('matches the requested period exactly and does not bleed across years', () => {
    const current = scanSegmentContexts(instance, FY2026);
    const prior = scanSegmentContexts(instance, FY2025);

    expect(current.members).toHaveLength(3);
    expect(prior.members).toHaveLength(3);

    const currentContexts = new Set(current.members.flatMap((member) => member.contextIds));

    for (const member of prior.members) {
      for (const contextId of member.contextIds) {
        expect(currentContexts.has(contextId)).toBe(false);
      }
    }
  });

  it('ignores segment instants when asked for a duration', () => {
    const scan = scanSegmentContexts(instance, FY2026);
    const contexts = scan.members.flatMap((member) =>
      member.contextIds.map((contextId) => instance.contexts.get(contextId)),
    );

    for (const context of contexts) expect(context?.period.kind).toBe('duration');
  });

  it('reports every member seen anywhere, not only those in the period', () => {
    const scan = scanSegmentContexts(instance, { start: '1999-01-01', end: '1999-12-31' });

    expect(scan.axisPresent).toBe(true);
    expect(scan.members).toHaveLength(0);
    expect(scan.allMemberQNames).toHaveLength(3);
  });

  it('finds no axis in a filing that carries none', () => {
    const noSegments = load(
      MSFT_INSTANCE_EXCERPT.replace(
        /StatementBusinessSegmentsAxis/g,
        'DisaggregationOfRevenueAxis',
      ),
    );

    expect(scanSegmentContexts(noSegments, FY2026).axisPresent).toBe(false);
  });
});

describe('companion dimensions', () => {
  const withGeography = MSFT_INSTANCE_EXCERPT.replace(
    /(<context id="C_c4b4c258-8b46-4318-86c1-218c3d731d53">[\s\S]*?)(<\/segment>)/,
    '$1<xbrldi:explicitMember dimension="srt:StatementGeographicalAxis">country:US</xbrldi:explicitMember>$2',
  );

  it('quarantines a segment context that is also sliced by another axis', () => {
    expect(withGeography).not.toBe(MSFT_INSTANCE_EXCERPT);

    const scan = scanSegmentContexts(load(withGeography), FY2026);

    expect(scan.unclassified).toHaveLength(1);
    expect(scan.unclassified[0]?.companionAxes).toEqual(['srt:StatementGeographicalAxis']);
    expect(scan.members.map((member) => member.qname)).not.toContain('msft:IntelligentCloudMember');
  });

  it('allows only the consolidation-items axis alongside the segment axis', () => {
    expect(ALLOWED_COMPANION_AXES).toEqual(['ConsolidationItemsAxis']);
  });

  it('matches the axis by namespace and local name, not by written prefix', () => {
    const dimension = {
      axis: {
        prefix: 'gaap',
        localName: 'StatementBusinessSegmentsAxis',
        namespace: 'http://fasb.org/us-gaap/2031',
        source: 'gaap:StatementBusinessSegmentsAxis',
      },
      member: {
        prefix: 'x',
        localName: 'OneMember',
        namespace: 'http://x.example',
        source: 'x:OneMember',
      },
    };

    expect(isSegmentAxis(dimension)).toBe(true);
    expect(
      isSegmentAxis({
        ...dimension,
        axis: { ...dimension.axis, namespace: 'http://impostor.example/us-gaap/2025' },
      }),
    ).toBe(false);
  });
});

describe('crossCheckSegmentCount', () => {
  it('agrees when the axis and the filer’s own count agree', () => {
    expect(crossCheckSegmentCount(3, 3)).toEqual({ agrees: true, verified: true });
  });

  it('disagrees loudly when they do not', () => {
    expect(crossCheckSegmentCount(3, 4)).toEqual({ agrees: false, verified: true });
    expect(crossCheckSegmentCount(4, 3)).toEqual({ agrees: false, verified: true });
  });

  it('treats an absent count as unverified rather than as agreement', () => {
    expect(crossCheckSegmentCount(3, null)).toEqual({ agrees: true, verified: false });
  });
});

describe('the ConsolidationItemsAxis companion, against Apple’s own contexts', () => {
  const AAPL_FY2025 = { start: '2024-09-29', end: '2025-09-27' };
  const instance = load(AAPL_SEGMENT_CONTEXTS_EXCERPT);

  it('accepts srt:ConsolidationItemsAxis = OperatingSegmentsMember as a segment total', () => {
    const scan = scanSegmentContexts(instance, AAPL_FY2025);

    expect(scan.unclassified).toEqual([]);
    expect(scan.members.map((member) => member.qname).sort()).toEqual([
      'aapl:AmericasSegmentMember',
      'aapl:EuropeSegmentMember',
      'aapl:GreaterChinaSegmentMember',
      'aapl:JapanSegmentMember',
      'aapl:RestOfAsiaPacificSegmentMember',
    ]);
  });

  it('reads that axis out of the srt namespace, where it actually lives', () => {
    const companion = [...instance.contexts.values()]
      .flatMap((context) => context.dimensions)
      .find((dimension) => dimension.axis.localName === 'ConsolidationItemsAxis');

    expect(companion?.axis.namespace).toBe('http://fasb.org/srt/2025');
    expect(ALLOWED_COMPANION_AXES).toContain('ConsolidationItemsAxis');
  });

  it('never draws a reconciling item as a river, and reports it instead', () => {
    // The same wire document with one member changed: what the filer marks as
    // unallocated corporate is not a segment, however the axis is spelled.
    const withCorporate = AAPL_SEGMENT_CONTEXTS_EXCERPT.replace(
      /<xbrldi:explicitMember dimension="srt:ConsolidationItemsAxis">us-gaap:OperatingSegmentsMember<\/xbrldi:explicitMember>(\s*<xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">aapl:JapanSegmentMember<)/,
      '<xbrldi:explicitMember dimension="srt:ConsolidationItemsAxis">us-gaap:CorporateNonSegmentMember</xbrldi:explicitMember>$1',
    );

    expect(withCorporate).not.toBe(AAPL_SEGMENT_CONTEXTS_EXCERPT);

    const scan = scanSegmentContexts(load(withCorporate), AAPL_FY2025);

    expect(scan.members.map((member) => member.qname)).not.toContain('aapl:JapanSegmentMember');
    expect(scan.allMemberQNames).not.toContain('aapl:JapanSegmentMember');
    expect(scan.reconciling.map((item) => item.consolidationItem)).toEqual([
      'us-gaap:CorporateNonSegmentMember',
    ]);
    expect(scan.unclassified).toEqual([]);
  });

  it('refuses a member of that axis it has no rule for, rather than assuming', () => {
    const unknownMember = AAPL_SEGMENT_CONTEXTS_EXCERPT.replace(
      'us-gaap:OperatingSegmentsMember',
      'aapl:SomeOtherConsolidationMember',
    );
    const scan = scanSegmentContexts(load(unknownMember), AAPL_FY2025);

    expect(scan.unclassified.map((item) => item.companionAxes).flat()).toContain(
      'srt:ConsolidationItemsAxis',
    );
  });
});

describe('enumerate-members-from-clean-contexts-v1, against Meta’s own contexts', () => {
  const META_FY2025 = { start: '2025-01-01', end: '2025-12-31' };
  const instance = load(META_SEGMENT_CONTEXTS_EXCERPT);

  it('enumerates the segments that carry their own total, despite the product cut', () => {
    const scan = scanSegmentContexts(instance, META_FY2025);

    expect(scan.members.map((member) => member.qname).sort()).toEqual([
      'meta:FamilyOfAppsMember',
      'meta:RealityLabsMember',
    ]);
    expect(scan.unclassified).toEqual([]);
  });

  it('reports the slices it did not draw, and never enumerates them', () => {
    const scan = scanSegmentContexts(instance, META_FY2025);

    expect(scan.sliced.length).toBeGreaterThan(0);
    expect([...new Set(scan.sliced.flatMap((item) => item.companionAxes))]).toEqual([
      'srt:ProductOrServiceAxis',
    ]);

    for (const slice of scan.sliced) {
      expect(scan.members.flatMap((member) => member.contextIds)).not.toContain(slice.contextId);
    }
  });

  it('counts a segment once, however many times the filer cuts it', () => {
    const scan = scanSegmentContexts(instance, META_FY2025);
    const enumerated = scan.members.map((member) => member.qname);

    expect(new Set(enumerated).size).toBe(enumerated.length);
  });

  it('refuses a member the filer only ever cut, rather than summing its slices', () => {
    // The same wire document with one segment's clean total removed: what is
    // left of that member is product cuts, and their sum is not a figure this
    // project may invent.
    const withoutTotal = META_SEGMENT_CONTEXTS_EXCERPT.replace(
      /<context id="c-63">[\s\S]*?<\/context>/,
      '',
    );

    expect(withoutTotal).not.toBe(META_SEGMENT_CONTEXTS_EXCERPT);

    const scan = scanSegmentContexts(load(withoutTotal), META_FY2025);

    expect(scan.members.map((member) => member.qname)).toEqual(['meta:RealityLabsMember']);
    expect(scan.unclassified.map((item) => item.member)).toEqual(['meta:FamilyOfAppsMember']);
    expect(scan.unclassified[0]?.companionAxes).toEqual(['srt:ProductOrServiceAxis']);
  });

  it('does not let a slice from another period refuse this one', () => {
    const scan = scanSegmentContexts(instance, { start: '2024-01-01', end: '2024-12-31' });

    expect(scan.members).toEqual([]);
    expect(scan.sliced).toEqual([]);
    expect(scan.unclassified).toEqual([]);
  });
});
