/**
 * Named extraction rules for finding a filer's reportable segments in an XBRL
 * instance. Each rule is stated here, implemented here, and tested here.
 * `EXTRACTION-RULES.md` is the register.
 *
 * The rules exist because segment tagging is not uniform. The one thing that is
 * uniform is the axis: US filers dimension segment facts on
 * `us-gaap:StatementBusinessSegmentsAxis`. The members hung off that axis are
 * almost always in the filer's own namespace — Microsoft's are `msft:`, not
 * `us-gaap:` — so the member set has to be discovered from the document. It is
 * never a list this project keeps.
 */
import {
  isSrtNamespace,
  isUsGaapNamespace,
  type XbrlContext,
  type XbrlDimension,
  type XbrlInstance,
} from './xbrl-instance.ts';

export const SEGMENT_AXIS_LOCAL_NAME = 'StatementBusinessSegmentsAxis';

/**
 * Companion axes a segment context may also carry without ceasing to be a plain
 * segment context.
 *
 * `ConsolidationItemsAxis` is the only one, and only because filers use it to
 * say "this figure is the operating-segments column" alongside the segment
 * itself. Any other companion axis means the fact is a slice of a segment — by
 * geography, by product, by timing — and adding those to a segment total would
 * double-count. Such contexts are collected and reported, never silently
 * skipped and never silently included.
 *
 * **The axis lives in `srt`, not `us-gaap`.** `srt:ConsolidationItemsAxis` is in
 * `http://fasb.org/srt/YYYY`, so gating this allowlist on `isUsGaapNamespace`
 * made it unreachable code: the list existed, was documented, and could never
 * fire. Apple, whose every segment context carries exactly this axis, was
 * refused by it. Older filings put the same axis in the us-gaap namespace, so
 * both are accepted.
 */
export const ALLOWED_COMPANION_AXES: readonly string[] = ['ConsolidationItemsAxis'];

/**
 * The member of `ConsolidationItemsAxis` that means "this is the reportable
 * segment's own total".
 *
 * The axis alone is not enough. It is the axis a filer uses to separate segment
 * totals *from* reconciling items, so accepting every member of it would draw
 * eliminations and unallocated corporate amounts as if they were rivers, and
 * count them a second time against consolidated revenue.
 */
export const SEGMENT_TOTAL_COMPANION_MEMBERS: readonly string[] = ['OperatingSegmentsMember'];

/**
 * Members of `ConsolidationItemsAxis` that mean "this is what reconciles the
 * segments to the consolidated statement".
 *
 * These are real, reported, and Invariant 2.4 requires them to be rendered
 * rather than silently dropped — but they are not segments and never become
 * rivers. They are returned separately so the caller can carry them as the
 * reconciliation's unallocated items.
 *
 * A member on this axis that is in neither list is not guessed at: the context
 * goes to `unclassified` and the filer is refused, because this project cannot
 * tell whether it is a segment or a reconciliation of one.
 */
export const RECONCILING_COMPANION_MEMBERS: readonly string[] = [
  'MaterialReconcilingItemsMember',
  'IntersegmentEliminationMember',
  'CorporateNonSegmentMember',
  'ConsolidationEliminationsMember',
];

/**
 * Rule `resolve-axis-by-localname-in-usgaap-namespace-v1`.
 *
 * Matches the business-segments axis by namespace URI and local name, not by
 * the literal prefix `us-gaap:`. The namespace carries a taxonomy year that
 * changes every release, and the prefix is the filer's choice, so matching the
 * written QName would break on either.
 */
export function isSegmentAxis(dimension: XbrlDimension): boolean {
  return (
    isUsGaapNamespace(dimension.axis.namespace) &&
    dimension.axis.localName === SEGMENT_AXIS_LOCAL_NAME
  );
}

/**
 * Rule `companion-axis-allowlist-by-axis-and-member-v1`.
 *
 * A companion axis is accepted only when it is an allowlisted axis *and* its
 * member says the fact is the segment's own total. The member test is the half
 * that keeps a reconciling item from being drawn as a river.
 */
function isSegmentTotalCompanion(dimension: XbrlDimension): boolean {
  return (
    isConsolidationItemsAxis(dimension) &&
    SEGMENT_TOTAL_COMPANION_MEMBERS.includes(dimension.member.localName)
  );
}

function isReconcilingCompanion(dimension: XbrlDimension): boolean {
  return (
    isConsolidationItemsAxis(dimension) &&
    RECONCILING_COMPANION_MEMBERS.includes(dimension.member.localName)
  );
}

function isConsolidationItemsAxis(dimension: XbrlDimension): boolean {
  return (
    (isSrtNamespace(dimension.axis.namespace) || isUsGaapNamespace(dimension.axis.namespace)) &&
    ALLOWED_COMPANION_AXES.includes(dimension.axis.localName)
  );
}

export interface SegmentMember {
  /** The member QName as written, e.g. `msft:IntelligentCloudMember`. */
  readonly qname: string;
  readonly namespace: string | null;
  readonly localName: string;
  /**
   * Every clean context this member has for the requested period, in document
   * order.
   *
   * There is usually more than one, and they are not interchangeable in what
   * they carry. Cisco tags its Americas segment in a context dimensioned on the
   * segment axis alone — which holds only goodwill movements — and again in a
   * context that adds `ConsolidationItemsAxis`, which is where revenue, cost of
   * sales and gross profit live. Both are that segment's own totals; reading
   * only the first found HP's figures by luck of document order and lost
   * Cisco's entirely.
   */
  readonly contextIds: readonly string[];
}

/**
 * A member the filer only ever cut — it appears on the segment axis alongside an
 * axis this project will not interpret, and never carries a total of its own for
 * the requested period. There is nothing to draw for it and nothing to guess.
 */
export interface UnclassifiedSegmentContext {
  readonly contextId: string;
  readonly member: string;
  readonly companionAxes: readonly string[];
}

/**
 * A context that cuts a segment by something else — product, geography,
 * acquisition, sub-segment. It is a *part* of a segment, so it is never
 * enumerated, never merged and never added to any total. It is kept so the
 * caller can tell a reader the filer disclosed a cut Streamline did not draw.
 */
export interface SlicedSegmentContext {
  readonly contextId: string;
  readonly member: string;
  readonly companionAxes: readonly string[];
}

/**
 * A context the filer marked as a reconciling item rather than a segment total:
 * eliminations, unallocated corporate, other material reconciling items.
 * Reported and carried, never drawn as a river.
 */
export interface ReconcilingContext {
  readonly contextId: string;
  /** The segment-axis member, e.g. `us-gaap:CorporateNonSegmentMember`. */
  readonly member: string;
  /** The `ConsolidationItemsAxis` member that classified it. */
  readonly consolidationItem: string;
}

export interface SegmentContextScan {
  readonly axisPresent: boolean;
  /** Members with a duration context matching the requested period, document order. */
  readonly members: readonly SegmentMember[];
  /** Every member seen on the axis anywhere in the document, in any period. */
  readonly allMemberQNames: readonly string[];
  /** Members with no clean total for the period. The only refusal this scan produces. */
  readonly unclassified: readonly UnclassifiedSegmentContext[];
  /** Contexts that cut a segment by another axis, for the period. Reported, never drawn. */
  readonly sliced: readonly SlicedSegmentContext[];
  /** Reconciling-item contexts for the requested period, in document order. */
  readonly reconciling: readonly ReconcilingContext[];
}

function matchesDuration(context: XbrlContext, start: string, end: string): boolean {
  return (
    context.period.kind === 'duration' &&
    context.period.start === start &&
    context.period.end === end
  );
}

/**
 * Rules `enumerate-members-from-contexts-v1`, `single-axis-context-only-v1` and
 * `enumerate-members-from-clean-contexts-v1`.
 *
 * Walks every context in the instance and keeps the ones dimensioned on the
 * business-segments axis, sorting them into three kinds for the requested
 * period:
 *
 * **Clean** — the segment axis alone, or with only an allowed companion. This is
 * the segment's own total, and its member is enumerated.
 *
 * **Sliced** — the segment axis plus an axis this project will not interpret:
 * product, geography, acquisition, sub-segment. A slice is a *part* of a
 * segment. It is never enumerated, never merged and never added to any total. It
 * is returned so the caller can say the filer disclosed a cut Streamline did not
 * draw.
 *
 * **Orphan** — a member that appears only in slices and never carries a total of
 * its own. That, and only that, is a refusal: there is no figure to draw and
 * summing its slices would be this project inventing the total.
 *
 * The distinction matters because almost every large filer disclosing revenue by
 * product does so on the same axis as its segments. Refusing the filing because
 * *some* context is sliced discarded Meta, Alphabet, Cisco, HP, Snowflake, Jack
 * Henry, Diebold, IBM and NVIDIA — every one of which tags a complete, clean
 * total for every segment it reports.
 *
 * The period match is exact on both endpoints, and both the clean and the sliced
 * sets are restricted to it, so a prior-year product cut cannot refuse the
 * current year. A filer that tags a partial-period segment figure must not have
 * it counted as the year.
 */
export function scanSegmentContexts(
  instance: XbrlInstance,
  period: { readonly start: string; readonly end: string },
): SegmentContextScan {
  const members: SegmentMember[] = [];
  const seenForPeriod = new Map<string, string[]>();
  const allMembers = new Set<string>();
  const sliced: SlicedSegmentContext[] = [];
  const reconciling: ReconcilingContext[] = [];
  let axisPresent = false;

  for (const context of instance.contexts.values()) {
    const segmentDimension = context.dimensions.find(isSegmentAxis);

    if (segmentDimension === undefined) continue;

    axisPresent = true;

    const others = context.dimensions.filter((dimension) => dimension !== segmentDimension);
    const reconcilingCompanion = others.find(isReconcilingCompanion);

    const inPeriod = matchesDuration(context, period.start, period.end);

    if (reconcilingCompanion !== undefined) {
      // A reconciling item, not a segment. It is never a river, so its member is
      // deliberately not added to the member set the count cross-check reads.
      const wholeItem = others.every(
        (dimension) => isSegmentTotalCompanion(dimension) || isReconcilingCompanion(dimension),
      );

      if (inPeriod && wholeItem) {
        reconciling.push({
          contextId: context.id,
          member: segmentDimension.member.source,
          consolidationItem: reconcilingCompanion.member.source,
        });
      } else if (inPeriod) {
        // A reconciling item that is itself cut by something else. Not a segment
        // and not a whole reconciling amount, so it is reported as a slice
        // rather than dropped without trace.
        sliced.push({
          contextId: context.id,
          member: segmentDimension.member.source,
          companionAxes: others
            .filter((dimension) => !isReconcilingCompanion(dimension))
            .map((dimension) => dimension.axis.source),
        });
      }

      continue;
    }

    const companions = others.filter((dimension) => !isSegmentTotalCompanion(dimension));

    if (companions.length > 0) {
      if (inPeriod) {
        sliced.push({
          contextId: context.id,
          member: segmentDimension.member.source,
          companionAxes: companions.map((dimension) => dimension.axis.source),
        });
      }

      continue;
    }

    allMembers.add(segmentDimension.member.source);

    if (!inPeriod) continue;

    const qname = segmentDimension.member.source;
    const already = seenForPeriod.get(qname);

    if (already !== undefined) {
      already.push(context.id);
      continue;
    }

    const contextIds: string[] = [context.id];

    seenForPeriod.set(qname, contextIds);
    members.push({
      qname,
      namespace: segmentDimension.member.namespace,
      localName: segmentDimension.member.localName,
      contextIds,
    });
  }

  // A member is refused only when nothing in this period gives it a total of its
  // own. One entry per orphan member, carrying every axis it was ever cut by.
  const orphanAxes = new Map<string, { contextId: string; axes: Set<string> }>();

  for (const slice of sliced) {
    if (seenForPeriod.has(slice.member)) continue;

    const entry = orphanAxes.get(slice.member) ?? {
      contextId: slice.contextId,
      axes: new Set<string>(),
    };

    for (const axis of slice.companionAxes) entry.axes.add(axis);
    orphanAxes.set(slice.member, entry);
  }

  return {
    axisPresent,
    members,
    allMemberQNames: [...allMembers],
    unclassified: [...orphanAxes].map(([member, entry]) => ({
      contextId: entry.contextId,
      member,
      companionAxes: [...entry.axes],
    })),
    sliced,
    reconciling,
  };
}

/**
 * Rule `segment-count-crosscheck-v1`.
 *
 * `us-gaap:NumberOfReportableSegments` is the filer's own statement of how many
 * reportable segments it has. When the members enumerated from the axis do not
 * match it, one of the two is wrong and this project cannot tell which — so it
 * renders neither. The mismatch is returned as a state, not logged.
 *
 * An absent count is a different fact from a disagreeing one. A filer that never
 * tags the count leaves the enumeration unverified, which is a note on an
 * otherwise renderable company; a filer that tags a count that disagrees blocks
 * the render.
 */
export function crossCheckSegmentCount(
  enumerated: number,
  reported: number | null,
): { readonly agrees: boolean; readonly verified: boolean } {
  if (reported === null) return { agrees: true, verified: false };

  return { agrees: enumerated === reported, verified: true };
}
