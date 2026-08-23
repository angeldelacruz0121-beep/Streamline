import { describe, expect, it } from 'vitest';
import { buildCompanyView, type BuildInput } from './ingest.ts';
import { renderableFigures, type CompanyView } from '../model/company.ts';
import { sourceRefsOf } from '../model/figure.ts';
import * as MSFT from './__fixtures__/msft-fy2026.ts';

const SUBMISSIONS = {
  cik: MSFT.MSFT_CIK,
  entityName: 'MICROSOFT CORP',
  sic: MSFT.MSFT_SIC,
  sicDescription: 'Services-Prepackaged Software',
  filerCategory: 'Large accelerated filer',
  tickers: ['MSFT'],
  exchanges: ['Nasdaq'],
};

function build(overrides: Partial<BuildInput['documents']> = {}, sic = MSFT.MSFT_SIC): CompanyView {
  return buildCompanyView({
    submissions: { ...SUBMISSIONS, sic },
    documents: {
      accession: MSFT.MSFT_ACCESSION,
      form: MSFT.MSFT_FORM,
      filedAt: MSFT.MSFT_FILED_AT,
      instanceFile: MSFT.MSFT_INSTANCE_FILE,
      instanceText: MSFT.MSFT_INSTANCE_EXCERPT,
      metaLinksText: MSFT.MSFT_METALINKS_EXCERPT,
      renderedSegmentReportText: MSFT.MSFT_SEGMENT_RFILE_EXCERPT,
      ...overrides,
    },
  });
}

function renderable() {
  const view = build();

  if (view.kind !== 'renderable') {
    throw new Error(`expected a renderable company, got ${view.kind}: ${JSON.stringify(view)}`);
  }

  return view;
}

// Microsoft's FY2026 Form 10-K as filed, in dollars.
const M = 1_000_000;
const REPORTED = {
  productivity: { revenue: 139_996 * M, cost: 25_017 * M, opex: 31_100 * M, profit: 83_879 * M },
  cloud: { revenue: 137_791 * M, cost: 57_876 * M, opex: 22_943 * M, profit: 56_972 * M },
  personal: { revenue: 54_052 * M, cost: 23_481 * M, opex: 16_185 * M, profit: 14_386 * M },
  consolidatedRevenue: 331_839 * M,
  consolidatedOperatingIncome: 155_237 * M,
  netEarnings: 133_749 * M,
  incomeTax: 32_185 * M,
  nonoperating: 10_697 * M,
};

describe('buildCompanyView, Microsoft FY2026', () => {
  it('renders', () => {
    expect(build().kind).toBe('renderable');
  });

  it('reports the fiscal year the filer reports, ending 30 June', () => {
    const view = renderable();

    expect(view.period.label).toBe('FY2026');
    expect(view.period.start).toBe('2025-07-01');
    expect(view.period.end).toBe('2026-06-30');
    expect(view.period.calendarAligned).toBe(false);
    expect(view.filing.accession).toBe('0001193125-26-323660');
    expect(view.filing.form).toBe('10-K');
  });

  it('finds three segments and agrees with the filer’s own count', () => {
    const view = renderable();

    expect(view.segmentCount).toMatchObject({ enumerated: 3, reported: 3, agrees: true });
    expect(view.segmentCount.reportedSourceRef?.tag).toBe('NumberOfReportableSegments');
  });

  it('names the segments as the filer names them, in the filer’s order', () => {
    expect(renderable().segments.map((segment) => segment.label)).toEqual([
      'Productivity and Business Processes',
      'Intelligent Cloud',
      'More Personal Computing',
    ]);
  });

  it('identifies segments by their member QName, in the filer’s namespace', () => {
    expect(renderable().segments.map((segment) => segment.id)).toEqual([
      'msft:ProductivityAndBusinessProcessesMember',
      'msft:IntelligentCloudMember',
      'msft:MorePersonalComputingMember',
    ]);
  });

  it('carries each segment’s reported figures exactly as filed', () => {
    const [productivity, cloud, personal] = renderable().segments;

    expect(productivity?.revenue.value).toBe(REPORTED.productivity.revenue);
    expect(productivity?.operatingIncome.value).toBe(REPORTED.productivity.profit);
    expect(cloud?.revenue.value).toBe(REPORTED.cloud.revenue);
    expect(cloud?.operatingIncome.value).toBe(REPORTED.cloud.profit);
    expect(personal?.revenue.value).toBe(REPORTED.personal.revenue);
    expect(personal?.operatingIncome.value).toBe(REPORTED.personal.profit);
  });

  it('gives each river the two cost categories this filer discloses, and no others', () => {
    for (const segment of renderable().segments) {
      expect(segment.constrictions.map((constriction) => constriction.id)).toEqual([
        'us-gaap:CostOfGoodsAndServicesSold',
        'us-gaap:OperatingExpenses',
      ]);
      expect(segment.constrictions.map((constriction) => constriction.label)).toEqual([
        'Cost of revenue',
        'Operating expenses',
      ]);
    }
  });

  it('does not admit goodwill, which this filer also tags on the segment axis', () => {
    for (const segment of renderable().segments) {
      for (const constriction of segment.constrictions) {
        expect(constriction.id).not.toContain('Goodwill');
      }
    }
  });

  it('closes each segment’s bridge from revenue through costs to operating income', () => {
    const [productivity, cloud, personal] = renderable().segments;

    expect(productivity?.constrictions.map((item) => item.amount.value)).toEqual([
      REPORTED.productivity.cost,
      REPORTED.productivity.opex,
    ]);
    expect(cloud?.constrictions.map((item) => item.amount.value)).toEqual([
      REPORTED.cloud.cost,
      REPORTED.cloud.opex,
    ]);
    expect(personal?.constrictions.map((item) => item.amount.value)).toEqual([
      REPORTED.personal.cost,
      REPORTED.personal.opex,
    ]);

    for (const segment of renderable().segments) {
      expect(segment.bridge.closes).toBe(true);
      expect(segment.bridge.residual).toBeNull();
    }
  });

  it('reconciles segment revenue to consolidated revenue exactly', () => {
    const { reconciliation } = renderable();

    expect(reconciliation.segmentRevenueTotal.value).toBe(REPORTED.consolidatedRevenue);
    expect(reconciliation.consolidatedRevenue.value).toBe(REPORTED.consolidatedRevenue);
    expect(reconciliation.difference.value).toBe(0);
    expect(reconciliation.withinTolerance).toBe(true);
  });

  it('carries the gap from segment profit to net earnings in the trunk, not in the rivers', () => {
    const { trunk } = renderable();

    expect(trunk.segmentOperatingIncomeTotal.value).toBe(REPORTED.consolidatedOperatingIncome);
    expect(trunk.consolidatedOperatingIncome?.value).toBe(REPORTED.consolidatedOperatingIncome);
    expect(trunk.netEarnings.value).toBe(REPORTED.netEarnings);
    expect(trunk.residual.value).toBe(REPORTED.consolidatedOperatingIncome - REPORTED.netEarnings);
  });

  it('explains the trunk entirely from reported tax and non-operating items', () => {
    const { trunk } = renderable();

    expect(
      trunk.components.map((component) => [
        component.id,
        component.amount.value,
        component.direction,
      ]),
    ).toEqual([
      ['us-gaap:NonoperatingIncomeExpense', REPORTED.nonoperating, 'increases'],
      ['us-gaap:IncomeTaxExpenseBenefit', REPORTED.incomeTax, 'reduces'],
    ]);
    expect(trunk.unexplained.value).toBe(0);
    expect(trunk.fullyExplained).toBe(true);
  });

  it('raises no data-quality notes for this filing', () => {
    expect(renderable().notes).toEqual([]);
  });
});

describe('Invariant 2.2: every renderable figure traces to a tagged fact', () => {
  it('leaves no figure without a source ref', () => {
    const figures = renderableFigures(renderable());

    expect(figures.length).toBeGreaterThan(20);

    for (const figure of figures) {
      const refs = sourceRefsOf(figure);

      expect(refs.length).toBeGreaterThan(0);

      for (const ref of refs) {
        expect(ref.accession).toBe(MSFT.MSFT_ACCESSION);
        expect(ref.tag.length).toBeGreaterThan(0);
        expect(ref.contextRef.length).toBeGreaterThan(0);
        expect(ref.documentFile).toBe(MSFT.MSFT_INSTANCE_FILE);
      }
    }
  });

  it('labels every derived figure with a method and an assumption', () => {
    for (const figure of renderableFigures(renderable())) {
      if (figure.provenance.kind !== 'derived') continue;

      expect(figure.provenance.method).toMatch(/-v1$/);
      expect(figure.provenance.assumption.length).toBeGreaterThan(40);
    }
  });

  it('marks the figures read straight off the filing as reported', () => {
    const view = renderable();

    for (const segment of view.segments) {
      expect(segment.revenue.provenance.kind).toBe('reported');
      expect(segment.operatingIncome.provenance.kind).toBe('reported');

      for (const constriction of segment.constrictions) {
        expect(constriction.amount.provenance.kind).toBe('reported');
      }
    }

    expect(view.trunk.netEarnings.provenance.kind).toBe('reported');
    expect(view.trunk.residual.provenance.kind).toBe('derived');
    expect(view.trunk.segmentOperatingIncomeTotal.provenance.kind).toBe('derived');
  });

  it('dimensions every segment figure on the business-segments axis', () => {
    for (const segment of renderable().segments) {
      const [ref] = sourceRefsOf(segment.revenue);

      expect(ref?.dimensions).toHaveLength(1);
      expect(ref?.dimensions[0]?.axisLocalName).toBe('StatementBusinessSegmentsAxis');
      expect(ref?.dimensions[0]?.member).toBe(segment.id);
    }
  });

  it('leaves consolidated figures undimensioned', () => {
    const [ref] = sourceRefsOf(renderable().trunk.netEarnings);

    expect(ref?.dimensions).toEqual([]);
  });

  it('carries a currency on every figure', () => {
    for (const figure of renderableFigures(renderable())) {
      expect(figure.unit).toEqual({ kind: 'monetary', currency: 'USD' });
    }
  });
});

describe('buildCompanyView refusals', () => {
  it('refuses a filer outside the coverage ranges before reading a figure', () => {
    const view = build({}, '2834');

    expect(view.kind).toBe('out-of-coverage');
    expect(view.kind === 'out-of-coverage' && view.detail).toContain('2834');
  });

  it('blocks the render when the filer’s own segment count disagrees with the axis', () => {
    const view = build({
      instanceText: MSFT.MSFT_INSTANCE_EXCERPT.replace(
        /(unitRef="U_Segment">)3(<\/us-gaap:NumberOfReportableSegments>)/,
        '$14$2',
      ),
    });

    expect(view.kind).toBe('segment-identity-unresolved');

    if (view.kind !== 'segment-identity-unresolved') return;

    expect(view.reportedSegmentCount).toBe(4);
    expect(view.enumeratedMembers).toHaveLength(3);
    expect(view.detail).toContain('4 reportable segments');
    expect(view.detail).toContain('does not say which');
  });

  it('renders with a warning, not a block, when the filer tags no segment count', () => {
    const view = build({
      instanceText: MSFT.MSFT_INSTANCE_EXCERPT.replace(
        /<us-gaap:NumberOfReportableSegments[\s\S]*?<\/us-gaap:NumberOfReportableSegments>/,
        '',
      ),
    });

    expect(view.kind).toBe('renderable');
    expect(view.kind === 'renderable' && view.notes.map((note) => note.code)).toContain(
      'segment-count-unverified',
    );
    expect(view.kind === 'renderable' && view.segmentCount.reported).toBeNull();
  });

  it('refuses to render when segment revenues do not reconcile', () => {
    const view = build({
      // One segment loses $20B of revenue *and* the same $20B of operating
      instanceText:
        // income, so its own cost stack still bridges exactly and the only thing
        // that fails is Invariant 2.4's sum against consolidated revenue.
        MSFT.MSFT_INSTANCE_EXCERPT.replace('139996000000', '119996000000').replace(
          '83879000000',
          '63879000000',
        ),
    });

    expect(view.kind).toBe('reconciliation-break');

    if (view.kind !== 'reconciliation-break') return;

    expect(view.reconciliation.difference.value).toBe(20_000 * M);
    expect(view.reconciliation.withinTolerance).toBe(false);
    expect(view.detail).toContain('6.03%');
    expect(view.detail).toContain('0.5% tolerance');
  });

  it('refuses when the filer’s two names for a segment disagree', () => {
    const view = build({
      renderedSegmentReportText: MSFT.MSFT_SEGMENT_RFILE_EXCERPT.replace(
        '>Intelligent Cloud<',
        '>Azure<',
      ),
    });

    expect(view.kind).toBe('segment-identity-unresolved');
    expect(view.kind === 'segment-identity-unresolved' && view.detail).toContain('Azure');
  });

  it('refuses when a segment context is also sliced by another axis', () => {
    const view = build({
      instanceText: MSFT.MSFT_INSTANCE_EXCERPT.replace(
        /(<context id="C_c4b4c258-8b46-4318-86c1-218c3d731d53">[\s\S]*?)(<\/segment>)/,
        '$1<xbrldi:explicitMember dimension="srt:StatementGeographicalAxis">country:US</xbrldi:explicitMember>$2',
      ),
    });

    expect(view.kind).toBe('segment-identity-unresolved');
    expect(view.kind === 'segment-identity-unresolved' && view.detail).toContain(
      'srt:StatementGeographicalAxis',
    );
  });

  it('refuses the figure the filing contradicts itself about, and names both values', () => {
    // $133,749M against $133,700M is not a rounding of the other at decimals=-6,
    // so both are dropped. Net earnings is the lake, so the company cannot render
    // — but the refusal names the figure and quotes the disagreement.
    const view = build({
      instanceText: MSFT.MSFT_INSTANCE_EXCERPT.replace(
        /(<us-gaap:NetIncomeLoss\b[\s\S]{0,240}?>)133749000000(<\/us-gaap:NetIncomeLoss>)/,
        '$1133700000000$2',
      ),
    });

    expect(view.kind).toBe('incomplete-filing');

    if (view.kind !== 'incomplete-filing') return;

    expect(view.missing).toContain('us-gaap:NetIncomeLoss');
    expect(view.detail).toContain('NetIncomeLoss');
    expect(view.detail).toContain('133749000000');
    expect(view.detail).toContain('133700000000');
  });

  it('does not discard a filing over a contradiction in a figure it never renders', () => {
    // A cover-page share count the model reads nothing from. IBM lost an entire
    // 10-K to exactly this before `conflict-blocks-the-figure-not-the-filing-v1`.
    const view = build({
      instanceText: MSFT.MSFT_INSTANCE_EXCERPT.replace(
        '</xbrl>',
        '<us-gaap:CommonStockSharesOutstanding contextRef="c-1" decimals="-6" unitRef="shares">' +
          '7000000000</us-gaap:CommonStockSharesOutstanding>\n' +
          '<us-gaap:CommonStockSharesOutstanding contextRef="c-1" decimals="-6" unitRef="shares">' +
          '9000000000</us-gaap:CommonStockSharesOutstanding>\n</xbrl>',
      ),
    });

    expect(view.kind).toBe('renderable');

    if (view.kind !== 'renderable') return;

    expect(view.notes.map((item) => item.code)).toContain('fact-conflict-dropped');
    expect(view.trunk.netEarnings.value).toBe(133_749_000_000);
  });

  it('drops the trunk items whole when they widen the gap instead of explaining it', () => {
    // A filer that tags the same charge twice: the aggregate plus a duplicate
    // under another concept. Itemising that would narrow the trunk by money the
    // company never lost.
    const doubleCounted = MSFT.MSFT_INSTANCE_EXCERPT.replace(
      /<us-gaap:IncomeTaxExpenseBenefit\n([\s\S]*?)<\/us-gaap:IncomeTaxExpenseBenefit>/,
      (match, body: string) =>
        `${match}\n    <us-gaap:NetIncomeLossAttributableToNoncontrollingInterest\n${body}</us-gaap:NetIncomeLossAttributableToNoncontrollingInterest>`,
    );

    expect(doubleCounted).not.toBe(MSFT.MSFT_INSTANCE_EXCERPT);

    const view = build({ instanceText: doubleCounted });

    expect(view.kind).toBe('renderable');

    if (view.kind !== 'renderable') return;

    expect(view.trunk.components).toEqual([]);
    expect(view.trunk.unexplained.value).toBe(
      REPORTED.consolidatedOperatingIncome - REPORTED.netEarnings,
    );
    expect(view.notes.map((note) => note.code)).toContain('trunk-components-discarded');
  });

  it('says a filing discloses no segments rather than rendering an empty picture', () => {
    const view = build({
      instanceText: MSFT.MSFT_INSTANCE_EXCERPT.replace(
        /StatementBusinessSegmentsAxis/g,
        'DisaggregationOfRevenueAxis',
      ),
    });

    expect(view.kind).toBe('no-segment-disclosure');
  });

  it('refuses to name the filer’s measures when MetaLinks is absent', () => {
    const view = build({ metaLinksText: null });

    expect(view.kind).toBe('incomplete-filing');
    expect(view.kind === 'incomplete-filing' && view.missing).toEqual(['MetaLinks.json']);
  });

  it('refuses an unreadable instance document', () => {
    const view = build({ instanceText: '<html><body>Not XBRL</body></html>' });

    expect(view.kind).toBe('incomplete-filing');
    expect(view.kind === 'incomplete-filing' && view.missing).toEqual(['xbrl-instance']);
  });

  it('still renders without the rendered schedule, and says the order is not the filer’s', () => {
    const view = build({ renderedSegmentReportText: null });

    expect(view.kind).toBe('renderable');
    expect(view.kind === 'renderable' && view.notes.map((note) => note.code)).toContain(
      'constriction-order-not-sourced',
    );
    expect(view.kind === 'renderable' && view.segments.map((segment) => segment.label)).toEqual([
      'Productivity and Business Processes',
      'Intelligent Cloud',
      'More Personal Computing',
    ]);
  });
});

describe('the river ends at operating income (Invariant 1, D16)', () => {
  it('reads consolidated operating income from the income statement concept', () => {
    const view = renderable();
    const [ref] = sourceRefsOf(view.trunk.consolidatedOperatingIncome!);

    expect(ref?.tag).toBe('OperatingIncomeLoss');
    expect(ref?.dimensions).toEqual([]);
    expect(view.trunk.consolidatedOperatingIncome?.value).toBe(
      REPORTED.consolidatedOperatingIncome,
    );
  });

  it('refuses a multi-segment filer whose schedule ends below operating income', () => {
    // The filer's segment schedule presents net income where operating income
    // was. Splitting a consolidated total across three rivers would be an
    // invented allocation, so nothing is drawn.
    const view = build({
      metaLinksText: MSFT.MSFT_METALINKS_EXCERPT.replaceAll(
        '"localname": "OperatingIncomeLoss"',
        '"localname": "NetIncomeLoss"',
      ),
    });

    expect(view.kind).toBe('segment-identity-unresolved');
    expect(view.kind === 'segment-identity-unresolved' && view.detail).toContain(
      'invented allocation',
    );
  });

  it('never counts an aggregate and its parts on the trunk twice', () => {
    // The filer tags interest and other income net alongside the non-operating
    // aggregate that already contains it. Autodesk's FY2026 shape, applied to a
    // filing whose trunk is known to close exactly.
    const doubled = MSFT.MSFT_INSTANCE_EXCERPT.replace(
      /<us-gaap:NonoperatingIncomeExpense\n([\s\S]*?)<\/us-gaap:NonoperatingIncomeExpense>/,
      (match, body: string) =>
        `${match}\n    <us-gaap:InterestIncomeExpenseNonoperatingNet\n${body}</us-gaap:InterestIncomeExpenseNonoperatingNet>`,
    );

    expect(doubled).not.toBe(MSFT.MSFT_INSTANCE_EXCERPT);

    const view = build({ instanceText: doubled });

    expect(view.kind).toBe('renderable');

    if (view.kind !== 'renderable') return;

    expect(view.trunk.components.map((component) => component.id)).toEqual([
      'us-gaap:NonoperatingIncomeExpense',
      'us-gaap:IncomeTaxExpenseBenefit',
    ]);
    expect(view.trunk.unexplained.value).toBe(0);
  });
});

describe('slices are reported, never drawn (enumerate-members-from-clean-contexts-v1)', () => {
  /**
   * Microsoft's own instance with one extra context: the same segment, same
   * period, also cut by `srt:ProductOrServiceAxis`. That is the shape Meta,
   * Alphabet, Cisco, HP, Snowflake, Jack Henry, Diebold, IBM and NVIDIA all
   * file, and it must not change a single figure.
   */
  const SLICE_CONTEXT = [
    '<context id="C_sliced_by_product">',
    '  <entity>',
    '    <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>',
    '    <segment>',
    '      <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">MEMBER</xbrldi:explicitMember>',
    '      <xbrldi:explicitMember dimension="srt:ProductOrServiceAxis">msft:ServerProductsAndCloudServicesMember</xbrldi:explicitMember>',
    '    </segment>',
    '  </entity>',
    '  <period>',
    '    <startDate>2025-07-01</startDate>',
    '    <endDate>2026-06-30</endDate>',
    '  </period>',
    '</context>',
  ].join('\n');

  function withSliceOf(member: string): string {
    return MSFT.MSFT_INSTANCE_EXCERPT.replace(
      '</xbrl>',
      `${SLICE_CONTEXT.replace('MEMBER', member)}\n</xbrl>`,
    );
  }

  it('renders every figure unchanged when the filer also cuts a segment by product', () => {
    const view = build({ instanceText: withSliceOf('msft:IntelligentCloudMember') });

    expect(view.kind).toBe('renderable');

    if (view.kind !== 'renderable') return;

    expect(view.segments).toHaveLength(3);
    expect(view.reconciliation.consolidatedRevenue.value).toBe(REPORTED.consolidatedRevenue);
    expect(view.trunk.segmentOperatingIncomeTotal.value).toBe(REPORTED.consolidatedOperatingIncome);
    expect(view.trunk.netEarnings.value).toBe(REPORTED.netEarnings);
    expect(view.trunk.unexplained.value).toBe(0);
  });

  it('tells the reader the cut exists and that it was not drawn', () => {
    const view = build({ instanceText: withSliceOf('msft:IntelligentCloudMember') });

    expect(view.kind).toBe('renderable');

    if (view.kind !== 'renderable') return;

    const slice = view.notes.find((item) => item.code === 'segment-slices-not-drawn');

    expect(slice?.message).toContain('srt:ProductOrServiceAxis');
    expect(slice?.message).toContain('msft:IntelligentCloudMember');
    expect(slice?.message).toContain('neither drawn nor added to any total');
  });

  it('refuses a member that has only ever been cut, naming it', () => {
    const view = build({ instanceText: withSliceOf('msft:SomeUntotalledMember') });

    expect(view.kind).toBe('segment-identity-unresolved');
    expect(view.kind === 'segment-identity-unresolved' && view.detail).toContain(
      'msft:SomeUntotalledMember',
    );
    expect(view.kind === 'segment-identity-unresolved' && view.detail).toContain(
      'never with a total of',
    );
  });
});

describe('read-a-member-from-every-clean-context-v1', () => {
  /**
   * Cisco's shape: one segment's disclosures split across two clean contexts —
   * the segment axis alone, and the segment axis plus
   * `ConsolidationItemsAxis = OperatingSegmentsMember`. Reading only the first
   * one in document order found HP's figures by luck and lost Cisco's.
   */
  function segmentContextOf(member: string): string {
    for (const block of MSFT.MSFT_INSTANCE_EXCERPT.matchAll(
      /<context id="([^"]+)">([\s\S]*?)<\/context>/g,
    )) {
      const body = block[2] ?? '';

      if (
        body.includes(member) &&
        body.includes('<startDate>2025-07-01</startDate>') &&
        body.includes('<endDate>2026-06-30</endDate>')
      ) {
        return block[1]!;
      }
    }

    throw new Error(`no FY2026 context for ${member}`);
  }

  function splitAcrossTwoContexts(): string {
    const from = segmentContextOf('msft:IntelligentCloudMember');
    const second = [
      '<context id="C_cloud_second_clean">',
      '  <entity>',
      '    <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>',
      '    <segment>',
      '      <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">msft:IntelligentCloudMember</xbrldi:explicitMember>',
      '      <xbrldi:explicitMember dimension="srt:ConsolidationItemsAxis">us-gaap:OperatingSegmentsMember</xbrldi:explicitMember>',
      '    </segment>',
      '  </entity>',
      '  <period>',
      '    <startDate>2025-07-01</startDate>',
      '    <endDate>2026-06-30</endDate>',
      '  </period>',
      '</context>',
    ].join('\n');

    // The profit fact moves out of the first context and into the second one.
    const moved = MSFT.MSFT_INSTANCE_EXCERPT.replace(
      new RegExp(`(<us-gaap:OperatingIncomeLoss\\s+[^>]*contextRef=")${from}(")`),
      '$1C_cloud_second_clean$2',
    );

    if (moved === MSFT.MSFT_INSTANCE_EXCERPT) throw new Error('profit fact not found');

    return moved.replace('</xbrl>', `${second}\n</xbrl>`);
  }

  it('finds a segment’s figures wherever among its clean contexts the filer put them', () => {
    const view = build({ instanceText: splitAcrossTwoContexts() });

    expect(view.kind).toBe('renderable');

    if (view.kind !== 'renderable') return;

    const cloud = view.segments.find((segment) => segment.id === 'msft:IntelligentCloudMember');

    expect(cloud?.operatingIncome.value).toBe(REPORTED.cloud.profit);
    expect(view.trunk.segmentOperatingIncomeTotal.value).toBe(REPORTED.consolidatedOperatingIncome);
    expect(view.trunk.unexplained.value).toBe(0);
  });

  it('chooses nothing when two clean contexts disagree about one measure', () => {
    // Both contexts stay, and the second claims a different operating income for
    // the same segment and period. Neither is picked.
    const contradictory = splitAcrossTwoContexts().replace(
      /(<us-gaap:OperatingIncomeLoss\s+[^>]*contextRef="C_cloud_second_clean"[^>]*>)\d+(<)/,
      '$199000000000$2',
    );

    expect(contradictory).toContain('99000000000');

    const view = build({
      instanceText: contradictory.replace(
        '</xbrl>',
        `<us-gaap:OperatingIncomeLoss contextRef="${segmentContextOf('msft:IntelligentCloudMember')}" decimals="-6" unitRef="U_USD">56972000000</us-gaap:OperatingIncomeLoss>\n</xbrl>`,
      ),
    });

    expect(view.kind).toBe('segment-identity-unresolved');
    expect(view.kind === 'segment-identity-unresolved' && view.detail).toContain(
      'clean contexts disagree',
    );
  });
});

describe('segment-bridge-must-close-v1', () => {
  /**
   * Microsoft's Productivity segment with $5B taken off its cost of revenue.
   * Revenue and operating income are untouched, so the filer's own cost stack no
   * longer accounts for the reduction between them — the shape a subtotal tagged
   * beside its own components produces, and the shape that used to render with a
   * warning nobody would read.
   */
  const OPEN_BRIDGE = MSFT.MSFT_INSTANCE_EXCERPT.replace('25017000000', '20017000000');

  it('refuses the filing rather than drawing a constriction that is not the filer’s number', () => {
    expect(OPEN_BRIDGE).not.toBe(MSFT.MSFT_INSTANCE_EXCERPT);

    const view = build({ instanceText: OPEN_BRIDGE });

    expect(view.kind).toBe('segment-identity-unresolved');
  });

  it('leads with what did not add up, not with the segments being unidentifiable', () => {
    const view = build({ instanceText: OPEN_BRIDGE });

    if (view.kind !== 'segment-identity-unresolved') throw new Error('expected a refusal');

    expect(view.detail.startsWith('The arithmetic for segment')).toBe(true);
    expect(view.detail).toContain('The segments were identified and named');
  });

  it('names the revenue, every disclosed cost, the operating income and the gap', () => {
    const view = build({ instanceText: OPEN_BRIDGE });

    if (view.kind !== 'segment-identity-unresolved') throw new Error('expected a refusal');

    expect(view.detail).toContain('Productivity and Business Processes');
    expect(view.detail).toContain('USD 139,996,000,000');
    expect(view.detail).toContain('us-gaap:CostOfGoodsAndServicesSold USD 20,017,000,000');
    expect(view.detail).toContain('us-gaap:OperatingExpenses USD 31,100,000,000');
    expect(view.detail).toContain('USD 83,879,000,000');
    expect(view.detail).toContain('USD 5,000,000,000');
  });

  it('still renders a filing whose every segment bridges, with the bridge stated as closed', () => {
    const view = renderable();

    for (const segment of view.segments) {
      expect(segment.bridge.closes).toBe(true);
      expect(segment.bridge.residual).toBeNull();
    }

    expect(view.notes.map((item) => item.code)).not.toContain('segment-bridge-open');
  });

  it('allows only the rounding slack the filer’s own decimals imply', () => {
    // $400,000 against figures reported to the million is inside the filer's own
    // precision; $600,000 is not.
    const inside = build({
      instanceText: MSFT.MSFT_INSTANCE_EXCERPT.replace('25017000000', '25016600000'),
    });
    const outside = build({
      instanceText: MSFT.MSFT_INSTANCE_EXCERPT.replace('25017000000', '25016400000'),
    });

    expect(inside.kind).toBe('renderable');
    expect(outside.kind).toBe('segment-identity-unresolved');
  });
});
