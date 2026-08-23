/**
 * What a segment is called, and the cross-check that it is called that.
 *
 * A segment's identity is its member QName; its name is a label. Getting the
 * label wrong is not cosmetic — a river labelled "Intelligent Cloud" that
 * carries More Personal Computing's revenue is a wrong figure with a confident
 * caption, which is the failure this whole workstream exists to prevent. So the
 * label is read from the filer's own label linkbase and then checked against the
 * filer's own rendered table, and a disagreement between the two stops the
 * render rather than picking a winner.
 *
 * The rendered report is read for one more thing: the order the filer presents
 * its measures in. Nothing else in the filing carries that order, and a
 * constriction sequence invented by this project would be a claim it cannot
 * source.
 */
import {
  labelForTag,
  qNameToTagKey,
  tagKeyToQName,
  type TaxonomyIndex,
} from './taxonomy-presentation.ts';
import type { LabelSource } from '../model/company.ts';

/**
 * EDGAR's rendered reports anchor every concept with
 * `Show.showAR( this, 'defref_<tag key>', window );">Label</a>`, and a
 * dimensioned column with `defref_<axis key>=<member key>`. That anchor is the
 * renderer's own contract, and it is read here only for names and ordering.
 * Not one figure is taken from a rendered report.
 */
const ANCHOR = /Show\.showAR\(\s*this,\s*'defref_([^']+)',\s*window\s*\);?"\s*>([^<]*)<\/a>/g;

export interface RenderedAnchor {
  /** `us-gaap_OperatingIncomeLoss`, or `us-gaap_...Axis=msft_...Member`. */
  readonly ref: string;
  readonly label: string;
}

export interface RenderedReportScan {
  /** Concept anchors in document order — the filer's presentation order. */
  readonly concepts: readonly RenderedAnchor[];
  /** Member QName to the label the filer printed in the column heading. */
  readonly memberLabels: ReadonlyMap<string, string>;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Rule `labels-and-order-from-rendered-report-v1`. */
export function scanRenderedReport(html: string): RenderedReportScan {
  const concepts: RenderedAnchor[] = [];
  const memberLabels = new Map<string, string>();
  const seenConcepts = new Set<string>();

  ANCHOR.lastIndex = 0;

  for (const match of html.matchAll(ANCHOR)) {
    const ref = match[1] ?? '';
    const label = decodeEntities(match[2] ?? '');
    const equals = ref.indexOf('=');

    if (equals !== -1) {
      const member = tagKeyToQName(ref.slice(equals + 1));

      if (label.length > 0 && !memberLabels.has(member)) memberLabels.set(member, label);
      continue;
    }

    if (seenConcepts.has(ref)) continue;

    seenConcepts.add(ref);
    concepts.push({ ref, label });
  }

  return { concepts, memberLabels };
}

export interface ResolvedLabel {
  readonly label: string;
  readonly source: LabelSource;
}

/**
 * Rule `label-from-member-local-name-v1`, the last resort.
 *
 * Splits the member's local name on case boundaries and drops the `Member`
 * suffix. This produces a readable string but not the filer's own wording, so
 * every caller records `member-local-name` as the source and the interface says
 * so. It is used only when the filer's linkbase and rendered report are both
 * unavailable.
 */
export function labelFromMemberLocalName(localName: string): string {
  return localName
    .replace(/Member$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
}

/** Compares labels the way a reader would: case and spacing are not identity. */
function equivalent(left: string, right: string): boolean {
  const normalise = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  return normalise(left) === normalise(right);
}

/**
 * Rule `rendered-heading-may-compound-members-v1`.
 *
 * A rendered column heading names the *context*, not the member. Where the
 * context carries more than one dimension, the SEC renderer prints every
 * member's label joined by a pipe: Apple's Americas column is headed
 * `Americas | Operating segments`, because its facts are dimensioned on the
 * business-segments axis and on `srt:ConsolidationItemsAxis` together.
 *
 * Comparing that whole string to one member's linkbase label compares a column
 * to a member, and reported every Apple segment as a naming conflict. The
 * cross-check is satisfied when any part of the heading is the member's label.
 */
function renderedNames(linkbaseLabel: string, renderedHeading: string): boolean {
  return renderedHeading.split('|').some((part) => equivalent(linkbaseLabel, part));
}

export interface LabelConflict {
  readonly member: string;
  readonly linkbaseLabel: string;
  readonly renderedLabel: string;
}

export interface SegmentLabelResult {
  readonly labels: ReadonlyMap<string, ResolvedLabel>;
  /**
   * Members whose linkbase label and rendered label disagree. Non-empty is a
   * segment-identity finding: the caller stops and escalates rather than
   * choosing one of the two names.
   */
  readonly conflicts: readonly LabelConflict[];
}

/**
 * Rule `label-from-linkbase-v1`, cross-checked by the rendered report.
 *
 * Preference order is the filer's label linkbase, then the filer's rendered
 * table, then the member's local name. Where the first two are both present and
 * disagree, the member is reported as a conflict.
 */
export function resolveSegmentLabels(
  members: readonly { readonly qname: string; readonly localName: string }[],
  index: TaxonomyIndex | null,
  rendered: RenderedReportScan | null,
): SegmentLabelResult {
  const labels = new Map<string, ResolvedLabel>();
  const conflicts: LabelConflict[] = [];

  for (const member of members) {
    const linkbase = index === null ? null : labelForTag(index, qNameToTagKey(member.qname));
    const renderedLabel = rendered?.memberLabels.get(member.qname) ?? null;

    if (linkbase !== null && renderedLabel !== null && !renderedNames(linkbase, renderedLabel)) {
      conflicts.push({
        member: member.qname,
        linkbaseLabel: linkbase,
        renderedLabel,
      });
    }

    if (linkbase !== null) {
      labels.set(member.qname, { label: linkbase, source: 'label-linkbase' });
    } else if (renderedLabel !== null) {
      labels.set(member.qname, { label: renderedLabel, source: 'rendered-report' });
    } else {
      labels.set(member.qname, {
        label: labelFromMemberLocalName(member.localName),
        source: 'member-local-name',
      });
    }
  }

  return { labels, conflicts };
}
