/**
 * One filing in, one `CompanyView` out.
 *
 * `buildCompanyView` is pure: it takes the documents as text and returns the
 * canonical object or a data-quality state. `ingestAnnualSegments` is the thin
 * shell around it that fetches those documents through Conduit's `EdgarClient`.
 * Keeping them apart is what makes the extraction testable against a captured
 * fixture with no network at all.
 *
 * Every exit from this module is a typed state. There is no path that returns a
 * partially-populated company, and no path that renders a figure it could not
 * source.
 */
import type { EdgarClient } from '../sec/client.ts';
import type { EdgarFailure, EdgarProvenance } from '../sec/errors.ts';
import type { CompanySubmissions } from '../sec/client.ts';
import {
  type CompanyView,
  type Constriction,
  type DataNote,
  type Entity,
  type FilingRef,
  type Segment,
} from '../model/company.ts';
import { reportedFigure, roundingTolerance, type Figure } from '../model/figure.ts';
import { singleSegmentOperatingIncome } from '../model/derivations.ts';
import type { SourceRef } from '../model/source-ref.ts';
import { checkCoverage, COVERAGE_SIC_RANGES } from '../validate/coverage.ts';
import {
  bridgeSegment,
  composeTrunkConstriction,
  reconcileRevenue,
} from '../validate/reconciliation.ts';
import { readAnnualFilingPeriod } from './fiscal-period.ts';
import {
  measureLabel,
  selectSegmentMeasures,
  selectSegmentScheduleRole,
  type MeasureSelection,
} from './segment-facts.ts';
import { crossCheckSegmentCount, scanSegmentContexts } from './segment-contexts.ts';
import {
  resolveSegmentLabels,
  scanRenderedReport,
  type RenderedReportScan,
} from './segment-labels.ts';
import {
  qNameToTagKey,
  readTaxonomyIndex,
  reportForRoleId,
  tagKeyToQName,
  type TaxonomyIndex,
} from './taxonomy-presentation.ts';
import {
  isUsGaapNamespace,
  readXbrlInstance,
  toModelUnit,
  type FactConflict,
  type XbrlFact,
  type XbrlInstance,
} from './xbrl-instance.ts';

/**
 * The disclosure role id for a segment note under the SEC's own numbering.
 * Note *numbers* move — Microsoft's segment note is 18 in FY2026 and FY2025 and
 * 19 in FY2024 — so nothing here keys off one. This id is used only to confirm
 * the filing has a segment disclosure at all; the schedule that carries the
 * figures is found from the axis.
 */
export const SEGMENT_NOTE_ROLE_ID = '995637';

/**
 * The aggregate concepts that can sit between operating income and net
 * earnings, with the direction each moves the flow.
 *
 * Deliberately aggregate-level only. A filer tags both `NonoperatingIncomeExpense`
 * and its components, and counting both would double-count; taking only the
 * aggregates and leaving the rest visible in `unexplained` cannot.
 */
export const TRUNK_BRIDGE_CONCEPTS: readonly {
  readonly localName: string;
  readonly direction: 'reduces' | 'increases';
  /**
   * Aggregates this concept is a component of. Rule
   * `prefer-aggregate-nonoperating-over-parts-v1`: when the filer tags any of
   * them, this part is not read, because a filer that tags both an aggregate and
   * its parts would otherwise have the same money counted twice and the trunk
   * would narrow the flow by an amount the company never lost.
   *
   * Autodesk FY2026 is the worked case. It tags
   * `InterestIncomeExpenseNonoperatingNet` at $25M — its "interest and other
   * income (expense), net" line — and `OtherNonoperatingIncomeExpense` at $7M,
   * which is part of that same $25M. Reading both left $7M unexplained on a
   * trunk that otherwise closes to the dollar: 1,578 − 479 + 25 = 1,124.
   */
  readonly partOf?: readonly string[];
}[] = [
  { localName: 'NonoperatingIncomeExpense', direction: 'increases' },
  { localName: 'IncomeLossFromEquityMethodInvestments', direction: 'increases' },
  { localName: 'IncomeLossFromDiscontinuedOperationsNetOfTax', direction: 'increases' },
  {
    localName: 'InterestIncomeExpenseNonoperatingNet',
    direction: 'increases',
    partOf: ['NonoperatingIncomeExpense'],
  },
  {
    localName: 'OtherNonoperatingIncomeExpense',
    direction: 'increases',
    partOf: ['NonoperatingIncomeExpense', 'InterestIncomeExpenseNonoperatingNet'],
  },
  {
    localName: 'InvestmentIncomeInterest',
    direction: 'increases',
    partOf: ['NonoperatingIncomeExpense', 'InterestIncomeExpenseNonoperatingNet'],
  },
  { localName: 'IncomeTaxExpenseBenefit', direction: 'reduces' },
  { localName: 'NetIncomeLossAttributableToNoncontrollingInterest', direction: 'reduces' },
];

const CONSOLIDATED_NET_EARNINGS_CONCEPTS: readonly string[] = ['NetIncomeLoss', 'ProfitLoss'];

/** The income statement's own operating income. The trunk is measured from this and nothing else. */
const CONSOLIDATED_OPERATING_INCOME_CONCEPT = 'OperatingIncomeLoss';

export interface FilingDocuments {
  readonly accession: string;
  readonly form: string;
  readonly filedAt: string;
  readonly instanceFile: string;
  readonly instanceText: string;
  /** `MetaLinks.json`. Without it there are no filer labels and no presentation. */
  readonly metaLinksText: string | null;
  /** The rendered segment schedule. Read for labels and ordering only. */
  readonly renderedSegmentReportText: string | null;
}

export interface BuildInput {
  readonly submissions: Pick<
    CompanySubmissions,
    'cik' | 'entityName' | 'sic' | 'sicDescription' | 'filerCategory' | 'tickers' | 'exchanges'
  >;
  readonly documents: FilingDocuments;
}

function entityOf(input: BuildInput): Entity {
  return {
    cik: input.submissions.cik,
    name: input.submissions.entityName,
    sic: input.submissions.sic,
    sicDescription: input.submissions.sicDescription,
    filerCategory: input.submissions.filerCategory,
    tickers: input.submissions.tickers,
    exchanges: input.submissions.exchanges,
  };
}

function note(code: string, severity: DataNote['severity'], message: string): DataNote {
  return { code, severity, message };
}

interface RefContext {
  readonly cik: string;
  readonly accession: string;
  readonly form: string;
  readonly documentFile: string;
  readonly fiscalYear: number;
  readonly fiscalPeriod: string;
}

function sourceRefFor(
  fact: XbrlFact,
  instance: XbrlInstance,
  context: RefContext,
): SourceRef | null {
  const factContext = instance.contexts.get(fact.contextRef);

  if (factContext === undefined) return null;

  const period = factContext.period;

  return {
    cik: context.cik,
    accession: context.accession,
    form: context.form,
    documentFile: context.documentFile,
    fiscalYear: context.fiscalYear,
    fiscalPeriod: context.fiscalPeriod,
    periodStart: period.kind === 'duration' ? period.start : null,
    periodEnd: period.kind === 'duration' ? period.end : period.date,
    taxonomy: fact.qname.prefix ?? '',
    namespace: fact.qname.namespace ?? '',
    tag: fact.qname.localName,
    contextRef: fact.contextRef,
    unitRef: fact.unitRef,
    decimals: fact.decimals,
    dimensions: factContext.dimensions.map((dimension) => ({
      axis: dimension.axis.source,
      axisNamespace: dimension.axis.namespace ?? '',
      axisLocalName: dimension.axis.localName,
      member: dimension.member.source,
      memberNamespace: dimension.member.namespace ?? '',
      memberLocalName: dimension.member.localName,
    })),
    factId: fact.factId,
  };
}

function figureFrom(fact: XbrlFact, instance: XbrlInstance, context: RefContext): Figure | null {
  if (fact.numeric === null || fact.unitRef === null) return null;

  const unit = toModelUnit(instance.units.get(fact.unitRef));
  const ref = sourceRefFor(fact, instance, context);

  if (unit === null || ref === null) return null;

  return reportedFigure(fact.numeric, unit, ref);
}

function findFact(instance: XbrlInstance, contextId: string, localName: string): XbrlFact | null {
  for (const fact of instance.factsByContext.get(contextId) ?? []) {
    if (isUsGaapNamespace(fact.qname.namespace) && fact.qname.localName === localName) return fact;
  }

  return null;
}

/**
 * Rule `read-a-member-from-every-clean-context-v1`.
 *
 * A member's figures are looked up across all of its clean contexts for the
 * period, not just the first one in document order. Filers split one segment's
 * disclosures across several contexts — Cisco puts goodwill movements on the
 * segment axis alone and revenue, cost of sales and gross profit on the same
 * axis plus `ConsolidationItemsAxis` — and reading only the first found HP's
 * figures by luck and lost Cisco's.
 *
 * Where two clean contexts carry the same concept with different values, nothing
 * is chosen: that is the filing saying two things about one segment measure, and
 * it returns `ambiguous` for the caller to refuse.
 */
function findMemberFact(
  instance: XbrlInstance,
  contextIds: readonly string[],
  tagKey: string,
):
  | { readonly kind: 'found'; readonly fact: XbrlFact }
  | { readonly kind: 'absent' }
  | { readonly kind: 'ambiguous'; readonly values: readonly string[] } {
  const found: XbrlFact[] = [];

  for (const contextId of contextIds) {
    const fact = findFactByKey(instance, contextId, tagKey);

    if (fact !== null) found.push(fact);
  }

  const first = found[0];

  if (first === undefined) return { kind: 'absent' };

  const disagreeing = found.filter((fact) => fact.numeric !== first.numeric);

  if (disagreeing.length > 0) {
    return { kind: 'ambiguous', values: [...new Set(found.map((fact) => fact.raw))] };
  }

  return { kind: 'found', fact: first };
}

function findFactByKey(instance: XbrlInstance, contextId: string, tagKey: string): XbrlFact | null {
  const qname = tagKeyToQName(tagKey);
  const colon = qname.indexOf(':');
  const localName = colon === -1 ? qname : qname.slice(colon + 1);

  for (const fact of instance.factsByContext.get(contextId) ?? []) {
    if (fact.qname.localName === localName) return fact;
  }

  return null;
}

/**
 * The recorded contradiction for a concept in a context, if there is one.
 *
 * Matched on local name and context the way `findFactByKey` matches, so a caller
 * that just failed to find a fact can ask whether it is missing because the
 * filer never tagged it or because the filer tagged it twice and disagreed.
 */
function conflictAt(
  instance: XbrlInstance,
  contextId: string,
  localName: string,
): FactConflict | null {
  return (
    instance.conflicts.find(
      (conflict) => conflict.contextRef === contextId && conflict.localName === localName,
    ) ?? null
  );
}

/** The clause naming a contradiction, for a refusal that already says what is missing. */
function conflictClause(conflict: FactConflict | null): string {
  if (conflict === null) return '';

  return (
    ` The filer tags ${conflict.localName} twice in ${conflict.contextRef} as ` +
    `${conflict.values.join(' and ')}, which are not roundings of one another, so both were ` +
    'dropped rather than chosen between.'
  );
}

function localNameOfKey(tagKey: string): string {
  const qname = tagKeyToQName(tagKey);
  const colon = qname.indexOf(':');

  return colon === -1 ? qname : qname.slice(colon + 1);
}

/**
 * Rule `river-ends-at-operating-income-v1`.
 *
 * Resolves the figure a river ends at, in the only two ways that are honest.
 *
 * First choice, always: the operating profit the filer itself tagged on the
 * segment axis. Reported, no inference.
 *
 * Second, only for a filer with exactly one reportable segment that tags no
 * operating profit there — the ASU 2023-07 shape — the consolidated operating
 * income attributed to that single segment by
 * `single-segment-operating-income-from-consolidated-v1`, which refuses unless
 * the segment's own disclosed costs carry its revenue to that same amount.
 *
 * There is no third way. A multi-segment filer that tags no segment operating
 * income is refused: splitting a consolidated total across several rivers would
 * be this project inventing the split.
 */
function segmentOperatingIncome(input: {
  readonly instance: XbrlInstance;
  readonly refContext: RefContext;
  readonly member: { readonly qname: string; readonly contextIds: readonly string[] };
  readonly selection: MeasureSelection;
  readonly memberCount: number;
  readonly revenue: Figure;
  readonly costs: readonly Figure[];
  readonly consolidatedOperatingIncome: Figure | null;
}):
  | { readonly kind: 'ok'; readonly figure: Figure; readonly derived: boolean }
  | { readonly kind: 'unresolved'; readonly detail: string } {
  const { selection, instance, member, refContext } = input;

  const profitTag = selection.profit;

  if (profitTag !== null) {
    const lookup = findMemberFact(instance, member.contextIds, profitTag.key);
    const figure = lookup.kind === 'found' ? figureFrom(lookup.fact, instance, refContext) : null;

    if (figure === null) {
      return {
        kind: 'unresolved',
        detail:
          `it is tagged on the axis but does not carry ${tagKeyToQName(profitTag.key)}, ` +
          'so the river has no end.' +
          (lookup.kind === 'ambiguous'
            ? ` Its clean contexts disagree about that concept: ${lookup.values.join(' / ')}.`
            : '') +
          member.contextIds
            .map((contextId) =>
              conflictClause(conflictAt(instance, contextId, localNameOfKey(profitTag.key))),
            )
            .join(''),
      };
    }

    return { kind: 'ok', figure, derived: false };
  }

  if (input.memberCount !== 1) {
    return {
      kind: 'unresolved',
      detail:
        'this filer tags no operating income on its segment axis, and it reports ' +
        `${String(input.memberCount)} segments. Splitting consolidated operating income across ` +
        'them would be an invented allocation, so nothing is drawn.',
    };
  }

  if (input.consolidatedOperatingIncome === null) {
    return {
      kind: 'unresolved',
      detail:
        'this filer tags no operating income on its segment axis and no ' +
        `us-gaap:${CONSOLIDATED_OPERATING_INCOME_CONCEPT} on its income statement, so there is ` +
        'no reported figure for the river to end at.',
    };
  }

  const attributed = singleSegmentOperatingIncome(
    input.consolidatedOperatingIncome,
    input.revenue,
    input.costs,
  );

  if (!attributed.ok) return { kind: 'unresolved', detail: attributed.detail };

  return { kind: 'ok', figure: attributed.figure, derived: true };
}

export function buildCompanyView(input: BuildInput): CompanyView {
  const entity = entityOf(input);
  const coverage = checkCoverage(entity.sic, entity.sicDescription);

  if (!coverage.inScope) {
    return {
      kind: 'out-of-coverage',
      entity,
      detail: coverage.detail,
      ranges: [
        [3570, 3579],
        [7370, 7379],
      ],
    };
  }

  const read = readXbrlInstance(input.documents.instanceText);

  if (read.kind !== 'ok') {
    return {
      kind: 'incomplete-filing',
      entity,
      filing: null,
      missing: ['xbrl-instance'],
      detail: read.detail,
    };
  }

  const instance = read.instance;
  const periodResult = readAnnualFilingPeriod(instance);

  if (periodResult.kind !== 'ok') {
    return {
      kind: 'incomplete-filing',
      entity,
      filing: null,
      missing: ['fiscal-period'],
      detail: periodResult.detail,
    };
  }

  const { period, requiredContext, warnings } = periodResult.filingPeriod;
  const filing: FilingRef = {
    accession: input.documents.accession,
    form: input.documents.form,
    filedAt: input.documents.filedAt,
    periodOfReport: period.end,
    documentFile: input.documents.instanceFile,
  };
  const refContext: RefContext = {
    cik: entity.cik,
    accession: filing.accession,
    form: filing.form,
    documentFile: filing.documentFile,
    fiscalYear: period.fiscalYear,
    fiscalPeriod: period.focus,
  };
  const notes: DataNote[] = warnings.map((message) =>
    note('fiscal-period-warning', 'warning', message),
  );

  /**
   * Rule `conflict-blocks-the-figure-not-the-filing-v1`.
   *
   * A concept tagged twice with values that are not roundings of each other is a
   * real contradiction, and neither value renders: `readXbrlInstance` drops both.
   * But it is a contradiction about *that concept*, not about the filing. A
   * disagreement in a cover-page share count says nothing about a segment
   * revenue tagged once and unambiguously, and refusing the whole 10-K over it
   * discarded IBM and ServiceNow entirely.
   *
   * So the conflict is recorded here, and it refuses only where a figure this
   * view needs is one of the dropped facts — which shows up below as that figure
   * being absent, named, with the disagreeing values quoted.
   */
  if (instance.conflicts.length > 0) {
    notes.push(
      note(
        'fact-conflict-dropped',
        'warning',
        `The filer tags ${String(instance.conflicts.length)} concept(s) more than once in the same ` +
          'context with values that are not roundings of one another: ' +
          `${instance.conflicts.map((conflict) => `${conflict.localName} in ${conflict.contextRef} = ${conflict.values.join(' / ')}`).join('; ')}. ` +
          'Both sides of each disagreement are dropped rather than chosen between, so no figure ' +
          'shown here comes from one.',
      ),
    );
  }

  if (period.start === null) {
    return {
      kind: 'incomplete-filing',
      entity,
      filing,
      missing: ['fiscal-period'],
      detail: 'The filing period has no start date, so segment durations cannot be matched.',
    };
  }

  const scan = scanSegmentContexts(instance, { start: period.start, end: period.end });

  if (!scan.axisPresent) {
    return {
      kind: 'no-segment-disclosure',
      entity,
      filing,
      detail:
        'This filing tags no facts on us-gaap:StatementBusinessSegmentsAxis, so it reports no ' +
        'segment breakdown to render.',
    };
  }

  /**
   * Rule `enumerate-members-from-clean-contexts-v1`, caller half.
   *
   * A member the filer only ever cut has no total to draw, and summing its
   * slices would be this project inventing one. That refuses the filing. A
   * member that carries its own total is not refused because the filer also
   * disclosed a product or geographic cut of it — that cut is reported below and
   * never merged into anything.
   */
  if (scan.unclassified.length > 0) {
    return {
      kind: 'segment-identity-unresolved',
      entity,
      filing,
      enumeratedMembers: scan.allMemberQNames,
      reportedSegmentCount: null,
      detail:
        `${scan.unclassified.map((item) => item.member).join(', ')} ` +
        `${scan.unclassified.length === 1 ? 'is' : 'are'} tagged on the segment axis for ` +
        `${period.label} only alongside ` +
        `${[...new Set(scan.unclassified.flatMap((item) => item.companionAxes))].join(', ')}, and ` +
        `never with a total of ${scan.unclassified.length === 1 ? 'its' : 'their'} own. Adding up ` +
        'the slices would be this project inventing the total, so nothing is drawn.',
      notes,
    };
  }

  if (scan.sliced.length > 0) {
    const slicedAxes = [...new Set(scan.sliced.flatMap((item) => item.companionAxes))];
    const slicedMembers = [...new Set(scan.sliced.map((item) => item.member))];

    notes.push(
      note(
        'segment-slices-not-drawn',
        'info',
        `This filer also cuts ${slicedMembers.length === 1 ? 'a segment' : 'its segments'} by ` +
          `${slicedAxes.join(', ')}: ${String(scan.sliced.length)} such context(s) covering ` +
          `${slicedMembers.join(', ')}. Those cuts are parts of the segments below, not segments, ` +
          'so they are neither drawn nor added to any total. The rivers here carry each segment’s ' +
          'own reported total.',
      ),
    );
  }

  const countFact = findFact(instance, requiredContext.id, 'NumberOfReportableSegments');
  const reportedCount = countFact?.numeric ?? null;
  const countCheck = crossCheckSegmentCount(scan.members.length, reportedCount);

  if (!countCheck.agrees) {
    return {
      kind: 'segment-identity-unresolved',
      entity,
      filing,
      enumeratedMembers: scan.members.map((member) => member.qname),
      reportedSegmentCount: reportedCount,
      detail:
        `The filing states ${String(reportedCount)} reportable segments in ` +
        `us-gaap:NumberOfReportableSegments, but ${String(scan.members.length)} members are tagged ` +
        `on the segment axis for ${period.label}: ${scan.members.map((member) => member.qname).join(', ')}. ` +
        'One of the two is wrong and this filing does not say which.',
      notes,
    };
  }

  if (!countCheck.verified) {
    notes.push(
      note(
        'segment-count-unverified',
        'warning',
        'This filer does not tag us-gaap:NumberOfReportableSegments, so the number of segments ' +
          'below is what the axis carries and is not confirmed by the filer’s own count.',
      ),
    );
  }

  if (input.documents.metaLinksText === null) {
    return {
      kind: 'incomplete-filing',
      entity,
      filing,
      missing: ['MetaLinks.json'],
      detail:
        'MetaLinks.json is absent from this accession, so the filer’s own labels and the set of ' +
        'measures it discloses per segment cannot be read. Naming them from the tags would be ' +
        'this project inventing a disclosure the filer did not make.',
    };
  }

  const taxonomy = readTaxonomyIndex(input.documents.metaLinksText);

  if (taxonomy.kind !== 'ok') {
    return {
      kind: 'incomplete-filing',
      entity,
      filing,
      missing: ['MetaLinks.json'],
      detail: taxonomy.detail,
    };
  }

  const index = taxonomy.index;
  const rendered =
    input.documents.renderedSegmentReportText === null
      ? null
      : scanRenderedReport(input.documents.renderedSegmentReportText);

  if (reportForRoleId(index, SEGMENT_NOTE_ROLE_ID) === null) {
    notes.push(
      note(
        'segment-note-role-absent',
        'info',
        `This filing carries no disclosure role ${SEGMENT_NOTE_ROLE_ID}. Segments were read from ` +
          'the segment axis, which is the authoritative source either way.',
      ),
    );
  }

  const roleChoice = selectSegmentScheduleRole(index);

  if (roleChoice.kind !== 'ok') {
    return {
      kind: 'segment-identity-unresolved',
      entity,
      filing,
      enumeratedMembers: scan.members.map((member) => member.qname),
      reportedSegmentCount: reportedCount,
      detail:
        roleChoice.kind === 'absent'
          ? 'No disclosure role in this filing presents both the business-segments axis and a ' +
            'revenue concept, so the schedule carrying segment figures cannot be identified.'
          : roleChoice.qualified.length === 0
            ? `${String(roleChoice.candidates.length)} disclosure roles present both the ` +
              'business-segments axis and a revenue concept, and none of them presents ' +
              `us-gaap:${CONSOLIDATED_OPERATING_INCOME_CONCEPT}, so this filing does not say which ` +
              'of them is the segment schedule and none of them ends a river where D16 ends one: ' +
              `${roleChoice.candidates.join(', ')}.`
            : `${String(roleChoice.qualified.length)} disclosure roles present the ` +
              `business-segments axis, a revenue concept and us-gaap:${CONSOLIDATED_OPERATING_INCOME_CONCEPT}, ` +
              'so which one is the segment schedule is still ambiguous and this project will not ' +
              `choose between them: ${roleChoice.qualified.join(', ')}.`,
      notes,
    };
  }

  const roles = [roleChoice.role];

  const measures = selectSegmentMeasures(index, roles[0]!, rendered);

  if (measures.kind !== 'ok') {
    return {
      kind: 'segment-identity-unresolved',
      entity,
      filing,
      enumeratedMembers: scan.members.map((member) => member.qname),
      reportedSegmentCount: reportedCount,
      detail: measures.detail,
      notes,
    };
  }

  const selection = measures.selection;

  if (selection.orderSource !== 'rendered-report') {
    notes.push(
      note(
        'constriction-order-not-sourced',
        'info',
        'The filer’s rendered segment schedule was unavailable, so the cost categories below are ' +
          'in linkbase order rather than the order the filer presents them in.',
      ),
    );
  }

  const labelling = resolveSegmentLabels(scan.members, index, rendered);

  if (labelling.conflicts.length > 0) {
    return {
      kind: 'segment-identity-unresolved',
      entity,
      filing,
      enumeratedMembers: scan.members.map((member) => member.qname),
      reportedSegmentCount: reportedCount,
      detail:
        'The filer’s label linkbase and its own rendered schedule give different names to the ' +
        `same segment: ${labelling.conflicts.map((conflict) => `${conflict.member} is “${conflict.linkbaseLabel}” in the linkbase and “${conflict.renderedLabel}” in the schedule`).join('; ')}. ` +
        'Naming a river wrongly is a wrong figure with a confident caption.',
      notes,
    };
  }

  const segments: Segment[] = [];
  const segmentRevenues: Figure[] = [];
  const segmentProfits: Figure[] = [];

  /**
   * Rule `consolidated-operating-income-from-income-statement-v1`.
   *
   * The consolidated operating income the trunk is measured against is read from
   * `us-gaap:OperatingIncomeLoss` on the undimensioned required context — the
   * income statement — and from nothing else.
   *
   * This used to be read on whatever concept the *segment schedule* happened to
   * use for profit. For a filer whose segment schedule ends at net income that
   * put consolidated net income into a field named consolidated operating
   * income: Autodesk FY2026 displayed $1,124M where the filing's
   * `us-gaap:OperatingIncomeLoss` is $1,578M. The label and the figure have to
   * come from the same concept.
   */
  const consolidatedOperatingIncomeFact = findFact(
    instance,
    requiredContext.id,
    CONSOLIDATED_OPERATING_INCOME_CONCEPT,
  );
  const consolidatedOperatingIncome =
    consolidatedOperatingIncomeFact === null
      ? null
      : figureFrom(consolidatedOperatingIncomeFact, instance, refContext);

  for (const member of scan.members) {
    const revenueLookup = findMemberFact(instance, member.contextIds, selection.revenue.key);
    const revenue =
      revenueLookup.kind === 'found' ? figureFrom(revenueLookup.fact, instance, refContext) : null;
    const label = labelling.labels.get(member.qname);

    if (revenue === null || label === undefined) {
      return {
        kind: 'segment-identity-unresolved',
        entity,
        filing,
        enumeratedMembers: scan.members.map((item) => item.qname),
        reportedSegmentCount: reportedCount,
        detail:
          `Segment ${member.qname} is tagged on the axis for ${period.label} but does not carry ` +
          `${tagKeyToQName(selection.revenue.key)}. A river with no source for its width cannot ` +
          'be drawn.' +
          (revenueLookup.kind === 'ambiguous'
            ? ` Its clean contexts disagree about that concept: ${revenueLookup.values.join(' / ')}.`
            : '') +
          member.contextIds
            .map((contextId) =>
              conflictClause(
                conflictAt(instance, contextId, localNameOfKey(selection.revenue.key)),
              ),
            )
            .join(''),
        notes,
      };
    }

    const constrictions: Constriction[] = [];

    for (const cost of selection.costs) {
      const lookup = findMemberFact(instance, member.contextIds, cost.key);
      const amount = lookup.kind === 'found' ? figureFrom(lookup.fact, instance, refContext) : null;

      if (amount === null) continue;

      constrictions.push({
        id: tagKeyToQName(cost.key),
        label: measureLabel(cost, rendered),
        amount,
        direction: 'reduces',
      });
    }

    if (constrictions.length !== selection.costs.length) {
      notes.push(
        note(
          'segment-cost-not-disclosed',
          'info',
          `${label.label} does not carry every cost category this filer discloses for its other ` +
            'segments. The missing ones are shown as not disclosed rather than estimated.',
        ),
      );
    }

    const endpoint = segmentOperatingIncome({
      instance,
      refContext,
      member,
      selection,
      memberCount: scan.members.length,
      revenue,
      costs: constrictions.map((constriction) => constriction.amount),
      consolidatedOperatingIncome,
    });

    if (endpoint.kind !== 'ok') {
      return {
        kind: 'segment-identity-unresolved',
        entity,
        filing,
        enumeratedMembers: scan.members.map((item) => item.qname),
        reportedSegmentCount: reportedCount,
        detail: `Segment ${member.qname}: ${endpoint.detail}`,
        notes,
      };
    }

    const profit = endpoint.figure;

    if (endpoint.derived) {
      notes.push(
        note(
          'segment-operating-income-derived',
          'warning',
          `${label.label} is this filer’s only reportable segment, and the filer tags no operating ` +
            'income on the segment axis. The end of the river is the company’s consolidated ' +
            'operating income, attributed to the single segment. It is marked derived, and the ' +
            'filer’s own disclosed costs carry its revenue to exactly that amount.',
        ),
      );
    }

    if (selection.belowTheLine.length > 0) {
      notes.push(
        note(
          'segment-below-the-line-not-a-constriction',
          'info',
          `This filer tags ${selection.belowTheLine.map((tag) => tagKeyToQName(tag.key)).join(', ')} ` +
            'on its segment axis. Those items sit below operating income, are attributable to no ' +
            'segment, and are carried on the shared trunk constriction rather than narrowing this ' +
            'river (Invariant 1, D16).',
        ),
      );
    }

    const bridge = bridgeSegment(
      revenue,
      constrictions.map((constriction) => constriction.amount),
      profit,
    );
    const residual = bridge.ok ? bridge.figure : null;
    const closes =
      residual !== null && Math.abs(residual.value) <= roundingTolerance(residual.decimals);

    /**
     * Rule `segment-bridge-must-close-v1`.
     *
     * A segment whose disclosed costs do not carry its revenue to its reported
     * operating income is refused. It used to be a warning on a company that
     * rendered anyway, and that was the wrong trade: Invariant 3.1 makes river
     * width a quantitative claim in dollars, so a constriction that does not
     * belong in the stack — a subtotal like gross profit tagged beside the cost
     * of revenue it already contains — is drawn to scale as money the segment
     * did not spend. A wrong width is silent. A refusal a reader can see beats a
     * warning a reader will not read (decision 0016 is the standing lesson).
     *
     * The whole filing is refused rather than the one segment. There is no
     * refused state on a segment, so dropping it would either shrink the revenue
     * sum until Invariant 2.4's check fails anyway or — for a small segment —
     * pass that check and draw a picture in which a real segment silently does
     * not exist.
     *
     * The tolerance is the filer's own `decimals`, unchanged. Nothing here
     * touches the profit side of the trunk, which is D18 and stays closed.
     */
    if (!closes) {
      const spent = constrictions
        .map((constriction) => `${constriction.id} ${format(constriction.amount)}`)
        .join(', ');

      return {
        kind: 'segment-identity-unresolved',
        entity,
        filing,
        enumeratedMembers: scan.members.map((item) => item.qname),
        reportedSegmentCount: reportedCount,
        detail:
          `The arithmetic for segment ${label.label} does not close. ` +
          (residual === null
            ? 'Its revenue, its disclosed costs and its operating income are not all in the same ' +
              'unit, so the reduction from one to the other is not a quantity that can be drawn.'
            : `Revenue of ${format(revenue)} less ${constrictions.length === 0 ? 'no disclosed costs' : spent} ` +
              `leaves ${format(bridgeResult(revenue, constrictions))}, but the filer reports operating ` +
              `income of ${format(profit)} — a gap of ${format(residual)}, ` +
              `${residual.value > 0 ? 'more cost than the categories account for' : 'more profit than the categories leave'}. ` +
              'The segments were identified and named; it is the cost stack that does not add up. ' +
              'Drawing it would put a constriction on screen whose width is not a number this ' +
              'filer reported (Invariant 3.1), so nothing is drawn.'),
        notes,
      };
    }

    segments.push({
      id: member.qname,
      label: label.label,
      labelSource: label.source,
      revenue,
      constrictions,
      operatingIncome: profit,
      bridge: { closes, residual: null },
    });
    segmentRevenues.push(revenue);
    segmentProfits.push(profit);
  }

  const consolidatedRevenueFact = findFactByKey(
    instance,
    requiredContext.id,
    selection.revenue.key,
  );
  const consolidatedRevenue =
    consolidatedRevenueFact === null
      ? null
      : figureFrom(consolidatedRevenueFact, instance, refContext);

  if (consolidatedRevenue === null) {
    return {
      kind: 'incomplete-filing',
      entity,
      filing,
      missing: [tagKeyToQName(selection.revenue.key)],
      detail:
        'The filing does not report consolidated revenue on the concept it uses for segment ' +
        'revenue, so Invariant 2.4’s reconciliation has nothing to reconcile against.' +
        conflictClause(
          conflictAt(instance, requiredContext.id, localNameOfKey(selection.revenue.key)),
        ),
    };
  }

  /**
   * Rule `reconciling-items-are-rendered-not-rivers-v1`.
   *
   * The amounts a filer tags on the segment axis under a reconciling member of
   * `ConsolidationItemsAxis` — eliminations, unallocated corporate, other
   * material reconciling items — are read here and handed to the reconciliation
   * as explicit unallocated figures. Invariant 2.4 requires them to be rendered
   * rather than dropped, and they are never counted as a segment.
   *
   * Each carries the filer's own sign, and `increases` means "added to the
   * segment total on the way to consolidated revenue". An elimination tagged
   * negative therefore reduces it without this project flipping any sign.
   */
  const unallocated: Constriction[] = [];

  for (const item of scan.reconciling) {
    const fact = findFactByKey(instance, item.contextId, selection.revenue.key);
    const amount = fact === null ? null : figureFrom(fact, instance, refContext);

    if (amount === null) continue;

    unallocated.push({
      id: `${item.member} / ${item.consolidationItem}`,
      label:
        labelling.labels.get(item.member)?.label ?? humanize(localNameOf(item.consolidationItem)),
      amount,
      direction: 'increases',
    });
  }

  const reconciliation = reconcileRevenue(segmentRevenues, consolidatedRevenue, unallocated);

  if (reconciliation.kind !== 'ok') {
    return {
      kind: 'incomplete-filing',
      entity,
      filing,
      missing: ['revenue-reconciliation'],
      detail: reconciliation.detail,
    };
  }

  if (!reconciliation.reconciliation.withinTolerance) {
    return {
      kind: 'reconciliation-break',
      entity,
      filing,
      period,
      reconciliation: reconciliation.reconciliation,
      detail:
        `Segment revenues sum to ${format(reconciliation.reconciliation.segmentRevenueTotal)} but ` +
        `the filing reports consolidated revenue of ${format(reconciliation.reconciliation.consolidatedRevenue)}, ` +
        `a difference of ${format(reconciliation.reconciliation.difference)} — ` +
        `${(reconciliation.reconciliation.ratio * 100).toFixed(2)}%, outside the ` +
        `${(reconciliation.reconciliation.tolerance * 100).toFixed(1)}% tolerance in Invariant 2.4.`,
      notes,
    };
  }

  const netEarningsFact = CONSOLIDATED_NET_EARNINGS_CONCEPTS.map((concept) =>
    findFact(instance, requiredContext.id, concept),
  ).find((fact): fact is XbrlFact => fact !== null);
  const netEarnings =
    netEarningsFact === undefined ? null : figureFrom(netEarningsFact, instance, refContext);

  if (netEarnings === null) {
    return {
      kind: 'incomplete-filing',
      entity,
      filing,
      missing: ['us-gaap:NetIncomeLoss'],
      detail:
        'The filing reports no consolidated net earnings, so the lake has nothing to encode and ' +
        'the trunk constriction has no destination.' +
        CONSOLIDATED_NET_EARNINGS_CONCEPTS.map((concept) =>
          conflictClause(conflictAt(instance, requiredContext.id, concept)),
        ).join(''),
    };
  }

  const components = collectTrunkComponents(instance, requiredContext.id, refContext);
  const withComponents = composeTrunkConstriction({
    segmentOperatingIncome: segmentProfits,
    consolidatedOperatingIncome,
    netEarnings,
    components,
  });
  const withoutComponents = composeTrunkConstriction({
    segmentOperatingIncome: segmentProfits,
    consolidatedOperatingIncome,
    netEarnings,
    components: [],
  });

  if (withComponents.kind !== 'ok' || withoutComponents.kind !== 'ok') {
    return {
      kind: 'incomplete-filing',
      entity,
      filing,
      missing: ['trunk-constriction'],
      detail:
        withComponents.kind === 'uncomputable'
          ? withComponents.detail
          : withoutComponents.kind === 'uncomputable'
            ? withoutComponents.detail
            : 'The trunk constriction could not be composed.',
    };
  }

  /**
   * Rule `bridge-components-must-explain-not-worsen-v1`.
   *
   * The reported bridge items are used only if, taken together, they leave less
   * of the gap unexplained than claiming nothing at all would. A filer that tags
   * both an aggregate and its parts would otherwise be counted twice, and a
   * double-counted trunk narrows the flow by money the company never lost. When
   * the set fails this test it is discarded whole — the gap is then honestly
   * unexplained rather than dishonestly itemised.
   */
  const componentsExplain =
    Math.abs(withComponents.trunk.unexplained.value) <
    Math.abs(withoutComponents.trunk.unexplained.value);
  const trunk = componentsExplain ? withComponents : withoutComponents;

  if (components.length > 0 && !componentsExplain) {
    notes.push(
      note(
        'trunk-components-discarded',
        'warning',
        'The reported items this filing tags between operating income and net earnings do not ' +
          'account for the gap between them — together they widen it, which is the signature of ' +
          'a figure tagged both in aggregate and in parts. They are left off the trunk rather ' +
          'than itemised wrongly, and the whole gap is shown as unexplained.',
      ),
    );
  }

  if (!trunk.trunk.fullyExplained) {
    notes.push(
      note(
        'trunk-partially-explained',
        'warning',
        'The reported items between segment operating income and net earnings do not account for ' +
          'the whole gap. The unexplained amount is carried on the trunk constriction rather than ' +
          'attributed to any of them.',
      ),
    );
  }

  return {
    kind: 'renderable',
    entity,
    filing,
    period,
    segments: orderSegments(segments, rendered),
    trunk: trunk.trunk,
    reconciliation: reconciliation.reconciliation,
    segmentCount: {
      enumerated: scan.members.length,
      reported: reportedCount,
      agrees: countCheck.agrees,
      reportedSourceRef: countFact === null ? null : sourceRefFor(countFact, instance, refContext),
    },
    notes,
  };
}

/**
 * Rule `segment-order-from-rendered-report-v1`.
 *
 * Segments come out in the order the filer presents them, taken from the column
 * order of its own rendered schedule. Where that is unavailable they are ordered
 * by revenue, descending, which is deterministic and is the order Invariant 3.7's
 * display cap needs anyway. Context iteration order is neither, and a list whose
 * order changes between runs is a list a test cannot pin.
 */
function orderSegments(
  segments: readonly Segment[],
  rendered: RenderedReportScan | null,
): readonly Segment[] {
  const presented = [...(rendered?.memberLabels.keys() ?? [])];
  const position = new Map(presented.map((member, at) => [member, at]));
  const ordered = [...segments];

  ordered.sort((left, right) => {
    const leftAt = position.get(left.id);
    const rightAt = position.get(right.id);

    if (leftAt !== undefined && rightAt !== undefined) return leftAt - rightAt;
    if (leftAt !== undefined) return -1;
    if (rightAt !== undefined) return 1;

    return right.revenue.value - left.revenue.value;
  });

  return ordered;
}

/**
 * The reported items that sit between segment operating income and net
 * earnings, taken from `TRUNK_BRIDGE_CONCEPTS` in that order.
 *
 * This collects; it does not judge. Whether the set it returns actually explains
 * the gap is decided once, over the whole set, by
 * `bridge-components-must-explain-not-worsen-v1` in `buildCompanyView`. Judging
 * item by item would be unsound: Microsoft's non-operating income *widens* the
 * gap on its own and only makes sense alongside the tax charge, so a rule that
 * dropped any item failing to shrink the remainder would drop a correct one.
 */
function collectTrunkComponents(
  instance: XbrlInstance,
  contextId: string,
  refContext: RefContext,
): readonly Constriction[] {
  const found: Constriction[] = [];
  const present = new Set(
    TRUNK_BRIDGE_CONCEPTS.filter(
      (concept) => findFact(instance, contextId, concept.localName) !== null,
    ).map((concept) => concept.localName),
  );

  for (const concept of TRUNK_BRIDGE_CONCEPTS) {
    if (concept.partOf?.some((aggregate) => present.has(aggregate)) === true) continue;

    const fact = findFact(instance, contextId, concept.localName);

    if (fact === null) continue;

    const amount = figureFrom(fact, instance, refContext);

    if (amount === null) continue;

    found.push({
      id: `us-gaap:${concept.localName}`,
      label: humanize(concept.localName),
      amount,
      direction: concept.direction,
    });
  }

  return found;
}

/** Revenue less the disclosed costs — what the filer's own cost stack leaves. */
function bridgeResult(revenue: Figure, constrictions: readonly Constriction[]): Figure {
  return {
    ...revenue,
    value: constrictions.reduce(
      (running, constriction) => running - constriction.amount.value,
      revenue.value,
    ),
  };
}

/** The local name of a QName as written, for labelling. */
function localNameOf(qname: string): string {
  const colon = qname.indexOf(':');

  return colon === -1 ? qname : qname.slice(colon + 1);
}

function humanize(localName: string): string {
  return localName.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

function format(figure: Figure): string {
  const currency = figure.unit.kind === 'monetary' ? `${figure.unit.currency} ` : '';

  return `${currency}${figure.value.toLocaleString('en-US')}`;
}

export type IngestResult =
  | { readonly kind: 'view'; readonly view: CompanyView; readonly provenance: EdgarProvenance }
  | { readonly kind: 'transport-failure'; readonly failure: EdgarFailure }
  | {
      readonly kind: 'incomplete-accession';
      readonly view: CompanyView;
      readonly missing: readonly string[];
    };

export interface IngestOptions {
  /** Defaults to `10-K`. */
  readonly form?: string;
  /** Pin a specific accession; otherwise the most recent of that form is used. */
  readonly accession?: string;
}

/**
 * Fetches one annual filing and builds its company view.
 *
 * This is the entry point a server route calls. Everything it needs from EDGAR
 * goes through Conduit's client, which owns the User-Agent, the rate limit and
 * the cache; this module issues no request of its own.
 */
export async function ingestAnnualSegments(
  client: EdgarClient,
  cik: string,
  options: IngestOptions = {},
): Promise<IngestResult> {
  const form = options.form ?? '10-K';
  const submissions = await client.getSubmissions(cik);

  if (submissions.kind !== 'ok') return { kind: 'transport-failure', failure: submissions };

  const entity = submissions.value;
  const coverage = checkCoverage(entity.sic, entity.sicDescription);

  if (!coverage.inScope) {
    return {
      kind: 'view',
      provenance: submissions.provenance,
      view: {
        kind: 'out-of-coverage',
        entity: {
          cik: entity.cik,
          name: entity.entityName,
          sic: entity.sic,
          sicDescription: entity.sicDescription,
          filerCategory: entity.filerCategory,
          tickers: entity.tickers,
          exchanges: entity.exchanges,
        },
        detail: coverage.detail,
        // The one list, never a copy of it: a second literal here is how a
        // refused filer comes to be told a band the code no longer applies.
        ranges: COVERAGE_SIC_RANGES.map((range) => [...range]),
      },
    };
  }

  const series = await client.getFilingSeries(cik, form);

  if (series.kind !== 'ok') return { kind: 'transport-failure', failure: series };

  const target =
    options.accession === undefined
      ? series.value.find((entry) => entry.original !== null)?.original
      : series.value
          .flatMap((entry) => [entry.original, ...entry.amendments])
          .find((record) => record !== null && record.accession === options.accession);

  if (target === undefined || target === null) {
    return {
      kind: 'transport-failure',
      failure: {
        kind: 'not-found',
        provenance: series.provenance,
        detail: `No ${form} found for CIK ${cik}${options.accession === undefined ? '' : ` with accession ${options.accession}`}.`,
      },
    };
  }

  const inventory = await client.getFilingIndex(cik, target.accession, {
    filedAt: target.filingDate,
  });

  if (inventory.kind !== 'ok' && inventory.kind !== 'incomplete-xbrl') {
    return { kind: 'transport-failure', failure: inventory };
  }

  const files = inventory.value;

  if (files.instanceDocument === null) {
    return {
      kind: 'incomplete-accession',
      missing: files.missing,
      view: {
        kind: 'incomplete-filing',
        entity: {
          cik: entity.cik,
          name: entity.entityName,
          sic: entity.sic,
          sicDescription: entity.sicDescription,
          filerCategory: entity.filerCategory,
          tickers: entity.tickers,
          exchanges: entity.exchanges,
        },
        filing: {
          accession: target.accession,
          form: target.form,
          filedAt: target.filingDate,
          periodOfReport: target.reportDate ?? '',
          documentFile: '',
        },
        missing: files.missing,
        detail:
          `Accession ${target.accession} carries no XBRL instance document, so it has no ` +
          'dimensional facts to read segments from.',
      },
    };
  }

  const instanceDocument = await client.getArchiveDocument(
    cik,
    target.accession,
    files.instanceDocument,
  );

  if (instanceDocument.kind !== 'ok') {
    return { kind: 'transport-failure', failure: instanceDocument };
  }

  const metaLinks =
    files.metaLinks === null
      ? null
      : await client.getArchiveDocument(cik, target.accession, files.metaLinks);
  const metaLinksText = metaLinks !== null && metaLinks.kind === 'ok' ? metaLinks.value.text : null;
  const renderedText = await fetchRenderedSegmentReport(
    client,
    cik,
    target.accession,
    metaLinksText,
  );

  return {
    kind: 'view',
    provenance: instanceDocument.provenance,
    view: buildCompanyView({
      submissions: {
        cik: entity.cik,
        entityName: entity.entityName,
        sic: entity.sic,
        sicDescription: entity.sicDescription,
        filerCategory: entity.filerCategory,
        tickers: entity.tickers,
        exchanges: entity.exchanges,
      },
      documents: {
        accession: target.accession,
        form: target.form,
        filedAt: target.filingDate,
        instanceFile: files.instanceDocument,
        instanceText: instanceDocument.value.text,
        metaLinksText,
        renderedSegmentReportText: renderedText,
      },
    }),
  };
}

async function fetchRenderedSegmentReport(
  client: EdgarClient,
  cik: string,
  accession: string,
  metaLinksText: string | null,
): Promise<string | null> {
  if (metaLinksText === null) return null;

  const taxonomy = readTaxonomyIndex(metaLinksText);

  if (taxonomy.kind !== 'ok') return null;

  // The same selector the figures use. If these two ever disagreed about which
  // role is the schedule, the labels and the ordering would come from one table
  // and the numbers from another.
  const choice = selectSegmentScheduleRole(taxonomy.index);
  const report = choice.kind === 'ok' ? findReportForRole(taxonomy.index, choice.role) : null;

  if (report === null) return null;

  const document = await client.getArchiveDocument(cik, accession, report);

  return document.kind === 'ok' ? document.value.text : null;
}

function findReportForRole(index: TaxonomyIndex, role: string): string | null {
  return index.reports.find((report) => report.role === role)?.file ?? null;
}

export { qNameToTagKey };
