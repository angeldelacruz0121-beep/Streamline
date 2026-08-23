/**
 * Which measures make up a segment, and the figures for them.
 *
 * D11 settled that the constriction set is filer-shaped: each river carries
 * exactly the cost categories that filer discloses, and no fixed taxonomy is
 * imposed. That decision only works if the categories come from somewhere real,
 * and they do — the filer's presentation linkbase says which concepts it put in
 * its segment schedule. Microsoft's answer is revenue, cost of revenue,
 * operating expenses and operating income. Another filer's will differ, and the
 * difference is the point.
 *
 * Two slots are classified rather than discovered, because the metaphor needs
 * to know which figure the river starts at and which it ends at. Those
 * classifications are documented lists of standard us-gaap concepts, and a
 * filing that matches none of them, or more than one, is refused rather than
 * guessed at.
 */
import {
  qNameToTagKey,
  rolesPresentingAll,
  tagKeyToQName,
  tagsInRole,
  type TagInfo,
  type TaxonomyIndex,
} from './taxonomy-presentation.ts';
import type { RenderedReportScan } from './segment-labels.ts';

/**
 * The us-gaap concepts a filer may use for the top of a segment river.
 *
 * These are the revenue concepts the segment schedules of technology filers
 * actually use. The list is a classification of standard taxonomy elements, not
 * a source of figures: it decides which of the filer's own tagged amounts is
 * "revenue", and nothing about its value.
 */
export const SEGMENT_REVENUE_CONCEPTS: readonly string[] = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'Revenues',
  'RevenueNotFromContractWithCustomer',
  'SalesRevenueNet',
  'SalesRevenueGoodsNet',
  'SalesRevenueServicesNet',
];

/**
 * The us-gaap concept a river ends at.
 *
 * One concept, not a list. Invariant 1 and D16 put the end of every river at
 * operating income and everything after it — tax, interest, other non-operating
 * items — on the shared trunk constriction, because those items are attributable
 * to no segment. A river that ended at net income would have to narrow for the
 * company's tax bill, which is exactly the invented per-segment geometry D16
 * rejected.
 *
 * A filer whose segment profit measure is not GAAP operating income (Oracle's
 * excludes stock compensation and amortisation) does not resolve here, and that
 * refusal is correct.
 */
export const SEGMENT_OPERATING_PROFIT_CONCEPTS: readonly string[] = ['OperatingIncomeLoss'];

/**
 * Concepts that sit below the operating line, and therefore below every river.
 *
 * ASU 2023-07 is why this list has to exist. It lets a single-segment filer tag
 * its whole income statement to its one segment, and Autodesk does exactly that:
 * on the segment axis it tags `IncomeTaxExpenseBenefit` at $479M,
 * `InterestIncomeExpenseNonoperatingNet` at $25M and `NetIncomeLoss` at $1,124M
 * alongside its eleven operating costs. Read naively, that draws a river
 * constricting for income tax, which Invariant 1 and D16 forbid.
 *
 * Membership here means two things: the concept is never a river constriction,
 * and it is never the measure a river ends at. Where these items belong is the
 * trunk, and `TRUNK_BRIDGE_CONCEPTS` in `ingest.ts` is where they are read.
 *
 * The net-income concepts are here for the same reason. They are profit
 * measures, but not *operating* profit measures.
 */
export const BELOW_THE_LINE_CONCEPTS: readonly string[] = [
  'IncomeTaxExpenseBenefit',
  'IncomeTaxExpenseBenefitContinuingOperations',
  'CurrentIncomeTaxExpenseBenefit',
  'DeferredIncomeTaxExpenseBenefit',
  'NonoperatingIncomeExpense',
  'InterestIncomeExpenseNonoperatingNet',
  'InterestIncomeExpenseNet',
  'InterestExpense',
  'InterestExpenseNonoperating',
  'InvestmentIncomeInterest',
  'OtherNonoperatingIncomeExpense',
  'IncomeLossFromEquityMethodInvestments',
  'IncomeLossFromDiscontinuedOperationsNetOfTax',
  'NetIncomeLossAttributableToNoncontrollingInterest',
  'ProfitLoss',
  'NetIncomeLoss',
  'NetIncomeLossAvailableToCommonStockholdersBasic',
  'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
  'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
];

/**
 * Rule `resolve-segment-schedule-by-axis-v1`.
 *
 * The schedule carrying segment figures is the disclosure role that presents
 * both the business-segments axis and one of the classified revenue concepts.
 * That is a property of the filer's own linkbase, so it survives the note
 * renumbering that makes a note-based lookup unusable — Microsoft's segment note
 * is 18 in FY2026 and 19 in FY2024.
 *
 * The revenue classification is load-bearing here. Intersecting the axis with
 * *any* monetary concept also matches the goodwill-by-segment schedule, which
 * carries the same axis and no revenue at all.
 *
 * Returns every *candidate* role. Which of several is the segment schedule is
 * decided by `selectSegmentScheduleRole`, not here: enumeration and selection
 * are separate so each can be tested on its own.
 */
export function resolveSegmentScheduleRoles(index: TaxonomyIndex): readonly string[] {
  const axisKey = [...index.tags.values()].find(
    (tag) => isUsGaap(tag) && tag.localName === 'StatementBusinessSegmentsAxis',
  )?.key;

  if (axisKey === undefined) return [];

  const revenueKeys = [...index.tags.values()]
    .filter((tag) => isUsGaap(tag) && SEGMENT_REVENUE_CONCEPTS.includes(tag.localName))
    .map((tag) => tag.key);
  const roles = new Set<string>();

  for (const revenueKey of revenueKeys) {
    for (const role of rolesPresentingAll(index, [axisKey, revenueKey])) roles.add(role);
  }

  return [...roles];
}

/**
 * Rule `prefer-role-presenting-operating-profit-v1`.
 *
 * Several roles can present the business-segments axis beside a revenue concept,
 * because a filer that discloses revenue by product on the segment axis produces
 * a disaggregation-of-revenue role that looks just like its segment note to the
 * enumerator. Meta and Alphabet have two such roles, Diebold two, IBM three.
 *
 * The tie is broken structurally, on what the filer disclosed rather than on a
 * note title, an ordering or an id: the segment schedule is the role that also
 * presents the measure the rivers end at. A revenue-disaggregation note carries
 * revenue only.
 *
 * Three outcomes, and none of them is "first wins":
 *
 * - exactly one candidate presents operating profit — that is the schedule;
 * - several do — still ambiguous, and the caller refuses naming them, because
 *   falling back to document order would reintroduce the ordering luck that
 *   `read-a-member-from-every-clean-context-v1` exists to remove;
 * - none does — refused as before. The revenue-only role is not picked and a
 *   profit measure is not derived for it;
 *   `single-segment-operating-income-from-consolidated-v1` is scoped to a filer
 *   with one member by design.
 *
 * Qualification is on the role *presenting* the concept in the filer's own
 * presentation linkbase, not on facts existing for it on every member. A role
 * that presents operating income whose members do not carry it wins selection
 * and then refuses at the endpoint, which keeps "the schedule could not be
 * identified" and "the schedule was identified and the figures are not there" as
 * two distinguishable failures.
 *
 * Selection happens before reconciliation and is never revisited by it. If the
 * chosen role's revenues miss consolidated revenue by more than Invariant 2.4
 * allows, that is a reconciliation break and it is reported as one — not a
 * silent re-pick of the other role.
 */
export type SegmentScheduleRoleResult =
  | { readonly kind: 'ok'; readonly role: string; readonly candidates: readonly string[] }
  | {
      readonly kind: 'ambiguous';
      readonly candidates: readonly string[];
      readonly qualified: readonly string[];
    }
  | { readonly kind: 'absent' };

export function selectSegmentScheduleRole(index: TaxonomyIndex): SegmentScheduleRoleResult {
  const candidates = resolveSegmentScheduleRoles(index);
  const only = candidates[0];

  if (only === undefined) return { kind: 'absent' };
  if (candidates.length === 1) return { kind: 'ok', role: only, candidates };

  const profitRoles = new Set(
    [...index.tags.values()]
      .filter((tag) => isUsGaap(tag) && SEGMENT_OPERATING_PROFIT_CONCEPTS.includes(tag.localName))
      .flatMap((tag) => tag.presentationRoles),
  );
  const qualified = candidates.filter((role) => profitRoles.has(role));
  const chosen = qualified[0];

  if (qualified.length === 1 && chosen !== undefined) {
    return { kind: 'ok', role: chosen, candidates };
  }

  return { kind: 'ambiguous', candidates, qualified };
}

export interface MeasureSelection {
  /** The disclosure role the measures were read from. */
  readonly role: string;
  readonly revenue: TagInfo;
  /**
   * The operating-level profit the rivers end at, or `null` when the filer tags
   * none on the segment axis. `null` is not a failure — it is the ASU 2023-07
   * single-segment shape, which the caller resolves by a named, guarded rule or
   * refuses. It is never filled in with a measure from below the operating line.
   */
  readonly profit: TagInfo | null;
  /** Everything else the filer presents in that role, in its own order. */
  readonly costs: readonly TagInfo[];
  /**
   * Concepts the filer presents in its segment schedule that sit below operating
   * income. Reported and kept, so a caller can say what the filer disclosed, but
   * never drawn as a river constriction.
   */
  readonly belowTheLine: readonly TagInfo[];
  readonly orderSource: 'rendered-report' | 'linkbase-order';
}

export type MeasureSelectionResult =
  | { readonly kind: 'ok'; readonly selection: MeasureSelection }
  | { readonly kind: 'unresolved'; readonly detail: string };

function isUsGaap(tag: TagInfo): boolean {
  return /^https?:\/\/fasb\.org\/us-gaap\//.test(tag.namespace);
}

/**
 * Rule `measures-from-segment-detail-presentation-v1`.
 *
 * Takes the monetary concepts the filer presents in its segment disclosure role
 * as the complete set of measures for that segment, classifies exactly one as
 * revenue, at most one as the operating profit the river ends at, sets aside
 * everything below the operating line, and treats what remains as the disclosed
 * cost categories. Ordering comes from the filer's rendered table where one is
 * available, because that is the only place the presentation order survives;
 * otherwise the linkbase order is used and the caller is told.
 *
 * Refuses, rather than choosing, when zero or several concepts classify as
 * revenue, or when several classify as operating profit.
 *
 * Rule `below-the-line-is-never-a-river-cost-v1` runs here. A concept in
 * `BELOW_THE_LINE_CONCEPTS` is removed from the cost set before anything is
 * drawn, so tax and non-operating items cannot become segment constrictions no
 * matter how the filer tagged them.
 */
export function selectSegmentMeasures(
  index: TaxonomyIndex,
  role: string,
  rendered: RenderedReportScan | null,
): MeasureSelectionResult {
  const monetary = tagsInRole(index, role, 'monetaryItemType');

  if (monetary.length === 0) {
    return {
      kind: 'unresolved',
      detail: `The filer presents no monetary concepts in segment role ${role}.`,
    };
  }

  const ordered = orderTags(monetary, rendered);
  const revenues = ordered.tags.filter(
    (tag) => isUsGaap(tag) && SEGMENT_REVENUE_CONCEPTS.includes(tag.localName),
  );
  const profits = ordered.tags.filter(
    (tag) => isUsGaap(tag) && SEGMENT_OPERATING_PROFIT_CONCEPTS.includes(tag.localName),
  );
  const belowTheLine = ordered.tags.filter(
    (tag) => isUsGaap(tag) && BELOW_THE_LINE_CONCEPTS.includes(tag.localName),
  );

  if (revenues.length !== 1) {
    return {
      kind: 'unresolved',
      detail:
        `Expected exactly one segment revenue concept in role ${role}; found ` +
        `${String(revenues.length)}${revenues.length === 0 ? '' : ` (${revenues.map((tag) => tagKeyToQName(tag.key)).join(', ')})`}.`,
    };
  }

  if (profits.length > 1) {
    return {
      kind: 'unresolved',
      detail:
        `Expected at most one operating profit concept in role ${role}; found ` +
        `${String(profits.length)} (${profits.map((tag) => tagKeyToQName(tag.key)).join(', ')}). ` +
        'A river cannot end at two different measures.',
    };
  }

  const revenue = revenues[0]!;
  const profit = profits[0] ?? null;

  return {
    kind: 'ok',
    selection: {
      role,
      revenue,
      profit,
      costs: ordered.tags.filter(
        (tag) => tag !== revenue && tag !== profit && !belowTheLine.includes(tag),
      ),
      belowTheLine,
      orderSource: ordered.source,
    },
  };
}

function orderTags(
  tags: readonly TagInfo[],
  rendered: RenderedReportScan | null,
): { readonly tags: readonly TagInfo[]; readonly source: 'rendered-report' | 'linkbase-order' } {
  if (rendered === null || rendered.concepts.length === 0) {
    return { tags, source: 'linkbase-order' };
  }

  const position = new Map<string, number>();

  rendered.concepts.forEach((anchor, at) => {
    if (!position.has(anchor.ref)) position.set(anchor.ref, at);
  });

  const known = tags.filter((tag) => position.has(tag.key));
  const unknown = tags.filter((tag) => !position.has(tag.key));

  if (known.length === 0) return { tags, source: 'linkbase-order' };

  known.sort((left, right) => (position.get(left.key) ?? 0) - (position.get(right.key) ?? 0));

  return { tags: [...known, ...unknown], source: 'rendered-report' };
}

/** The filer's label for a measure, preferring the rendered heading it printed. */
export function measureLabel(tag: TagInfo, rendered: RenderedReportScan | null): string {
  const anchored = rendered?.concepts.find((concept) => concept.ref === tag.key)?.label;

  if (anchored !== undefined && anchored.length > 0) return anchored;
  if (tag.terseLabel !== null && tag.terseLabel.length > 0) return tag.terseLabel;

  return tag.label ?? tagKeyToQName(tag.key);
}

/** The MetaLinks key for a QName, so callers need not know the two spellings. */
export { qNameToTagKey };
