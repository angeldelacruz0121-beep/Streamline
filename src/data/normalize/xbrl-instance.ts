/**
 * The only module in this project that knows what XML looks like.
 *
 * It reads an extracted XBRL instance document into contexts, units and facts,
 * and hands those on as plain structures. Everything downstream — member
 * enumeration, measure selection, reconciliation — consumes those structures
 * and never the parser's output shape, so swapping the parser cannot reach
 * past this file.
 *
 * Two properties matter more than convenience here.
 *
 * **Names are resolved by namespace URI, never by prefix.** A filer may bind
 * `us-gaap` to any prefix it likes, and the instance's default namespace is the
 * XBRL instance namespace, so `context` is unprefixed while facts are not.
 * Matching on the literal string `us-gaap:` would be matching on a convention.
 *
 * **Values are never coerced by the parser.** `parseTagValue` and
 * `parseAttributeValue` are off, so `155237000000` arrives as the string the
 * filer wrote and this module decides what it means. A parser that silently
 * turns a tagged amount into a float is exactly the silent-wrong-number failure
 * Invariant 2.2 exists to prevent.
 */
import { XMLParser } from 'fast-xml-parser';
import type { Unit } from '../model/figure.ts';

export const XBRL_INSTANCE_NS = 'http://www.xbrl.org/2003/instance';
export const XBRLDI_NS = 'http://xbrl.org/2006/xbrldi';
export const ISO4217_NS = 'http://www.xbrl.org/2003/iso4217';

export interface XbrlQName {
  /** The prefix as written, or `null` when the default namespace applied. */
  readonly prefix: string | null;
  readonly localName: string;
  /** `null` when the prefix is not declared, which is itself a finding. */
  readonly namespace: string | null;
  /** Exactly as it appeared in the document. */
  readonly source: string;
}

export type XbrlPeriod =
  | { readonly kind: 'duration'; readonly start: string; readonly end: string }
  | { readonly kind: 'instant'; readonly date: string };

export interface XbrlDimension {
  readonly axis: XbrlQName;
  readonly member: XbrlQName;
}

export interface XbrlContext {
  readonly id: string;
  readonly entityIdentifier: string;
  readonly entityScheme: string | null;
  readonly period: XbrlPeriod;
  readonly dimensions: readonly XbrlDimension[];
}

export interface XbrlUnit {
  readonly id: string;
  /** `['iso4217:USD']`, or numerator and denominator joined for a divide unit. */
  readonly measures: readonly string[];
  readonly isRatio: boolean;
}

export interface XbrlFact {
  readonly qname: XbrlQName;
  readonly contextRef: string;
  readonly unitRef: string | null;
  readonly decimals: number | null;
  /**
   * The filer wrote `decimals="INF"`: the amount is exact, not rounded.
   *
   * Kept beside `decimals` rather than inside it so nothing downstream ever sees
   * a non-finite number in provenance or in JSON, where `Infinity` serialises to
   * `null` and would silently become "precision unknown".
   */
  readonly exact: boolean;
  readonly factId: string | null;
  /** The characters between the tags, untouched. */
  readonly raw: string;
  /** `null` when the fact is not numeric or the text does not parse. */
  readonly numeric: number | null;
}

/**
 * Two facts claiming the same tag, context and unit but different values, where
 * neither is a rounding of the other. Never resolved by picking one: the filing
 * contradicts itself about that concept and a reader must be told which numbers
 * disagree.
 *
 * The conflicting facts are dropped from `facts` entirely, so no ambiguous value
 * can reach a figure. The record is structured rather than a formatted string so
 * a caller can ask the only question that matters — *is this concept, in this
 * context, one I was about to render?* A contradiction in a concept nothing
 * renders is a note about the filing, not grounds to refuse it.
 */
export interface FactConflict {
  readonly key: string;
  readonly namespace: string | null;
  readonly localName: string;
  readonly contextRef: string;
  readonly unitRef: string | null;
  readonly values: readonly string[];
}

export interface XbrlInstance {
  readonly defaultNamespace: string | null;
  readonly namespacesByPrefix: ReadonlyMap<string, string>;
  readonly contexts: ReadonlyMap<string, XbrlContext>;
  readonly units: ReadonlyMap<string, XbrlUnit>;
  readonly facts: readonly XbrlFact[];
  readonly factsByContext: ReadonlyMap<string, readonly XbrlFact[]>;
  readonly conflicts: readonly FactConflict[];
  /** Identical facts repeated in the document, collapsed to one. */
  readonly duplicatesCollapsed: number;
  /**
   * Facts the filer stated twice at different precisions — "$24.7 billion" in
   * prose and "$24,729 million" in a table — where the coarser one was dropped
   * in favour of the finer. Counted rather than passed over in silence.
   */
  readonly precisionMerged: number;
  /** Numeric facts too large to hold exactly in a double. Flagged, not dropped. */
  readonly precisionLoss: readonly string[];
}

export type InstanceReadResult =
  | { readonly kind: 'ok'; readonly instance: XbrlInstance }
  | { readonly kind: 'unreadable'; readonly detail: string };

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  // `isAttribute` matters: without it this predicate also wraps the root's
  // namespace declarations in arrays, the prefix map comes out empty, and every
  // name resolves to no namespace. Attributes are never arrays.
  isArray: (_name, jpath, _isLeafNode, isAttribute) => {
    if (isAttribute) return false;

    // The parser hands the path as a string or as a live matcher view depending
    // on its `jPath` mode; both stringify to the same dotted path.
    const path = typeof jpath === 'string' ? jpath : jpath.toString();

    return path.split('.').length === 2 || path.endsWith('explicitMember');
  },
});

function toArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) return [];

  return Array.isArray(value) ? value : [value as T];
}

function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The text of an element, whether the parser collapsed it to a string or not. */
function textOf(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return textOf((value as unknown[])[0]);
  if (isNode(value)) {
    const text = value['#text'];

    return typeof text === 'string' ? text : null;
  }

  return null;
}

function attr(node: XmlNode, name: string): string | null {
  const value = node[`@_${name}`];

  if (typeof value === 'string') return value;

  const first = Array.isArray(value) ? (value as unknown[])[0] : undefined;

  return typeof first === 'string' ? first : null;
}

function resolveQName(
  source: string,
  byPrefix: ReadonlyMap<string, string>,
  defaultNamespace: string | null,
): XbrlQName {
  const colon = source.indexOf(':');

  if (colon === -1) {
    return { prefix: null, localName: source, namespace: defaultNamespace, source };
  }

  const prefix = source.slice(0, colon);
  const localName = source.slice(colon + 1);

  return { prefix, localName, namespace: byPrefix.get(prefix) ?? null, source };
}

function sameName(qname: XbrlQName, namespace: string, localName: string): boolean {
  return qname.namespace === namespace && qname.localName === localName;
}

/**
 * Children of an element matching a namespace and local name.
 *
 * Resolving here rather than indexing by literal key is what makes this module
 * work on an instance that prefixes the XBRL instance namespace instead of
 * defaulting it. `entity`, `period`, `segment` and the rest are all in that
 * namespace, and `node['segment']` finds none of them when the filer wrote
 * `x:segment`.
 */
function childrenNamed(
  node: XmlNode,
  byPrefix: ReadonlyMap<string, string>,
  defaultNamespace: string | null,
  namespace: string,
  localName: string,
): readonly unknown[] {
  const found: unknown[] = [];

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    if (!sameName(resolveQName(key, byPrefix, defaultNamespace), namespace, localName)) continue;
    found.push(...toArray(value));
  }

  return found;
}

function readContext(
  id: string,
  node: XmlNode,
  byPrefix: ReadonlyMap<string, string>,
  defaultNamespace: string | null,
): XbrlContext | null {
  const inInstanceNs = (from: XmlNode, localName: string): readonly unknown[] =>
    childrenNamed(from, byPrefix, defaultNamespace, XBRL_INSTANCE_NS, localName);

  const entityNode = inInstanceNs(node, 'entity')[0];
  const periodNode = inInstanceNs(node, 'period')[0];

  if (!isNode(entityNode) || !isNode(periodNode)) return null;

  const identifierNode = inInstanceNs(entityNode, 'identifier')[0];
  const entityIdentifier = textOf(identifierNode);

  if (entityIdentifier === null) return null;

  const instant = textOf(inInstanceNs(periodNode, 'instant')[0]);
  const start = textOf(inInstanceNs(periodNode, 'startDate')[0]);
  const end = textOf(inInstanceNs(periodNode, 'endDate')[0]);

  let period: XbrlPeriod;

  if (instant !== null) {
    period = { kind: 'instant', date: instant };
  } else if (start !== null && end !== null) {
    period = { kind: 'duration', start, end };
  } else {
    return null;
  }

  const dimensions: XbrlDimension[] = [];

  for (const container of ['segment', 'scenario'] as const) {
    const containerNode =
      inInstanceNs(entityNode, container)[0] ?? inInstanceNs(node, container)[0];

    if (!isNode(containerNode)) continue;

    for (const [key, raw] of Object.entries(containerNode)) {
      const qname = resolveQName(key, byPrefix, defaultNamespace);

      if (!sameName(qname, XBRLDI_NS, 'explicitMember')) continue;

      for (const member of toArray(raw)) {
        if (!isNode(member)) continue;

        const axisSource = attr(member, 'dimension');
        const memberSource = textOf(member);

        if (axisSource === null || memberSource === null) continue;

        dimensions.push({
          axis: resolveQName(axisSource, byPrefix, defaultNamespace),
          member: resolveQName(memberSource, byPrefix, defaultNamespace),
        });
      }
    }
  }

  return {
    id,
    entityIdentifier,
    entityScheme: isNode(identifierNode) ? attr(identifierNode, 'scheme') : null,
    period,
    dimensions,
  };
}

function readUnit(
  id: string,
  node: XmlNode,
  byPrefix: ReadonlyMap<string, string>,
  defaultNamespace: string | null,
): XbrlUnit {
  const measuresIn = (from: unknown): readonly string[] =>
    isNode(from)
      ? childrenNamed(from, byPrefix, defaultNamespace, XBRL_INSTANCE_NS, 'measure')
          .map((measure) => textOf(measure))
          .filter((measure): measure is string => measure !== null)
      : [];

  const divide = childrenNamed(node, byPrefix, defaultNamespace, XBRL_INSTANCE_NS, 'divide')[0];

  if (isNode(divide)) {
    const numerator = childrenNamed(
      divide,
      byPrefix,
      defaultNamespace,
      XBRL_INSTANCE_NS,
      'unitNumerator',
    )[0];
    const denominator = childrenNamed(
      divide,
      byPrefix,
      defaultNamespace,
      XBRL_INSTANCE_NS,
      'unitDenominator',
    )[0];

    return {
      id,
      measures: [...measuresIn(numerator), ...measuresIn(denominator)],
      isRatio: true,
    };
  }

  return { id, measures: measuresIn(node), isRatio: false };
}

/**
 * Rule `inf-decimals-is-exact-not-unknown-v1`.
 *
 * Reads the `decimals` attribute. `INF` is a precision claim, not the absence of
 * one: it says the amount is stated exactly. Treating it as unknown was a defect
 * — it turned every exact-beside-rounded pair into a false contradiction
 * (ServiceNow tags `CommonStockSharesOutstanding` as 1,047,278,000 at `INF` and
 * 1,047,000,000 at `-6`, and IBM tags `TreasuryStockCommonShares` as
 * 1,353,666,394 at `INF` and 1,354,000,000 at `-6`) and, worse, let a coarser
 * twin overwrite an exact fact when the two happened to agree.
 *
 * A missing or unparseable attribute stays genuinely unknown.
 */
function readPrecision(value: string | null): { decimals: number | null; exact: boolean } {
  if (value === null) return { decimals: null, exact: false };
  if (value === 'INF') return { decimals: null, exact: true };

  const parsed = Number(value);

  return { decimals: Number.isFinite(parsed) ? parsed : null, exact: false };
}

/**
 * The precision a fact actually claims, for comparison only. An exact fact is
 * finer than any rounded one; an absent `decimals` claims nothing.
 */
function effectivePrecision(fact: XbrlFact): number | null {
  if (fact.exact) return Number.POSITIVE_INFINITY;

  return fact.decimals;
}

/** The tag, context and unit a fact is about — what makes two facts comparable. */
export function factIdentity(fact: XbrlFact): string {
  return (
    `${fact.qname.namespace ?? fact.qname.source}#${fact.qname.localName}` +
    `@${fact.contextRef}/${fact.unitRef ?? '-'}`
  );
}

function parseNumeric(raw: string): number | null {
  if (raw.length === 0) return null;

  const cleaned = raw.replace(/,/g, '');

  if (!/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(cleaned)) return null;

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Reads an instance document.
 *
 * Returns `unreadable` — never an empty success — when the root is not an XBRL
 * instance, and when a non-empty document yields no facts at all. Decision 0010
 * exists because a parser that returns `{ records: [], kind: 'ok' }` from an
 * 861 KB payload dropped the payload and reported no loss.
 */
export function readXbrlInstance(text: string): InstanceReadResult {
  if (text.trim().length === 0) {
    return { kind: 'unreadable', detail: 'The instance document is empty.' };
  }

  let parsed: unknown;

  try {
    parsed = parser.parse(text) as unknown;
  } catch (cause) {
    return {
      kind: 'unreadable',
      detail: `The instance document is not well-formed XML: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }

  if (!isNode(parsed)) {
    return { kind: 'unreadable', detail: 'The instance document has no root element.' };
  }

  const rootEntry = Object.entries(parsed).find(([key]) => !key.startsWith('@_'));

  if (rootEntry === undefined) {
    return { kind: 'unreadable', detail: 'The instance document has no root element.' };
  }

  const rootNode = toArray(rootEntry[1])[0];

  if (!isNode(rootNode)) {
    return { kind: 'unreadable', detail: 'The instance root element has no children.' };
  }

  const byPrefix = new Map<string, string>();
  let defaultNamespace: string | null = null;

  for (const [key, value] of Object.entries(rootNode)) {
    if (typeof value !== 'string') continue;
    if (key === '@_xmlns') defaultNamespace = value;
    else if (key.startsWith('@_xmlns:')) byPrefix.set(key.slice('@_xmlns:'.length), value);
  }

  const rootName = resolveQName(rootEntry[0], byPrefix, defaultNamespace);

  if (!sameName(rootName, XBRL_INSTANCE_NS, 'xbrl')) {
    return {
      kind: 'unreadable',
      detail:
        `Root element is ${rootName.source} in namespace ${rootName.namespace ?? 'none'}; ` +
        `an XBRL instance has {${XBRL_INSTANCE_NS}}xbrl. This is not an instance document.`,
    };
  }

  const contexts = new Map<string, XbrlContext>();
  const units = new Map<string, XbrlUnit>();
  const seen = new Map<string, XbrlFact>();
  const conflicting = new Map<string, { fact: XbrlFact; values: Set<string> }>();
  const precisionLoss: string[] = [];
  const facts: XbrlFact[] = [];
  let duplicatesCollapsed = 0;
  let precisionMerged = 0;

  for (const [key, raw] of Object.entries(rootNode)) {
    if (key.startsWith('@_') || key === '#text') continue;

    const qname = resolveQName(key, byPrefix, defaultNamespace);

    for (const child of toArray(raw)) {
      if (!isNode(child)) continue;

      if (sameName(qname, XBRL_INSTANCE_NS, 'context')) {
        const id = attr(child, 'id');

        if (id === null) continue;

        const context = readContext(id, child, byPrefix, defaultNamespace);

        if (context !== null) contexts.set(id, context);
        continue;
      }

      if (sameName(qname, XBRL_INSTANCE_NS, 'unit')) {
        const id = attr(child, 'id');

        if (id !== null) units.set(id, readUnit(id, child, byPrefix, defaultNamespace));
        continue;
      }

      const contextRef = attr(child, 'contextRef');

      if (contextRef === null) continue;

      const rawText = textOf(child) ?? '';
      const unitRef = attr(child, 'unitRef');
      const numeric = unitRef === null ? null : parseNumeric(rawText);
      const precision = readPrecision(attr(child, 'decimals'));
      const fact: XbrlFact = {
        qname,
        contextRef,
        unitRef,
        decimals: precision.decimals,
        exact: precision.exact,
        factId: attr(child, 'id'),
        raw: rawText,
        numeric,
      };

      if (numeric !== null && Number.isInteger(numeric) && !Number.isSafeInteger(numeric)) {
        precisionLoss.push(`${qname.source}@${contextRef}`);
      }

      const identity = factIdentity(fact);
      const previous = seen.get(identity);

      if (previous === undefined) {
        seen.set(identity, fact);
        facts.push(fact);
        continue;
      }

      const agreement = compareFacts(previous, fact);

      if (agreement === 'duplicate') {
        duplicatesCollapsed += 1;
        continue;
      }

      if (agreement === 'refines') {
        precisionMerged += 1;
        seen.set(identity, fact);
        facts[facts.indexOf(previous)] = fact;
        continue;
      }

      // The filer restated an amount it had already given more precisely. The
      // finer fact stands and the rounding is dropped, but this is a merge, not
      // a repeat, so it is counted as one.
      if (agreement === 'coarsens') {
        precisionMerged += 1;
        continue;
      }

      const bucket = conflicting.get(identity) ?? {
        fact: previous,
        values: new Set<string>([previous.raw]),
      };
      bucket.values.add(fact.raw);
      conflicting.set(identity, bucket);
    }
  }

  if (facts.length === 0) {
    return {
      kind: 'unreadable',
      detail:
        `The instance parsed but produced no facts from ${String(text.length)} characters. ` +
        'A non-empty document that yields nothing is a parse defect, not an empty filing.',
    };
  }

  // A fact this document contradicts itself about is removed outright. Leaving
  // the first-seen value in place would let one of two disagreeing numbers render
  // with full provenance and no sign that the other exists.
  const kept = facts.filter((fact) => !conflicting.has(factIdentity(fact)));

  return {
    kind: 'ok',
    instance: {
      defaultNamespace,
      namespacesByPrefix: byPrefix,
      contexts,
      units,
      facts: kept,
      factsByContext: groupByContext(kept),
      conflicts: [...conflicting].map(([key, entry]) => ({
        key,
        namespace: entry.fact.qname.namespace,
        localName: entry.fact.qname.localName,
        contextRef: entry.fact.contextRef,
        unitRef: entry.fact.unitRef,
        values: [...entry.values],
      })),
      duplicatesCollapsed,
      precisionMerged,
      precisionLoss,
    },
  };
}

/**
 * Whether two facts of the same tag, context and unit say the same thing, and
 * if so which of the two says it better.
 *
 * Inline filings state the same amount more than once, and not always the same
 * way. Two patterns are real and neither is a contradiction.
 *
 * The same value written differently: Microsoft tags basic earnings per share as
 * both `18.00` and `18` in the required context.
 *
 * The same value at two precisions: `$24.7 billion` in the narrative and
 * `$24,729 million` in a table, tagged `decimals="-8"` and `decimals="-6"`. XBRL
 * settles this — the two are consistent when the finer amount, rounded to the
 * precision the coarser one claims, *is* the coarser amount.
 *
 * Rule `rounding-is-not-contradiction-v1`. The test is rounding, not a tolerance
 * subtraction, because subtraction fails on the boundary that matters. IBM tags
 * its effective tax rate as `0.14` at `decimals="2"` and `0.135` at
 * `decimals="3"`; 0.135 rounds to 0.14 and the filing says one thing, but in
 * binary floating point `|0.14 − 0.135|` evaluates to 0.0050000000000000044,
 * which exceeds the ±0.005 envelope by 4.34e-18 and refused the whole 10-K.
 * Rounding both sides to the coarser precision and comparing whole units has no
 * such edge: the comparison is between integers.
 *
 * Treating either pattern as a conflict would refuse a filing that says nothing
 * contradictory, and picking the coarser one would throw away precision the
 * filer supplied. So the finer fact wins and the merge is counted.
 */
/**
 * `duplicate` — the same amount at the same precision, however it is written.
 * `refines` — the later fact is finer; it replaces the earlier one.
 * `coarsens` — the later fact is a rounding of the earlier, finer one; it is
 * dropped. Both merges are counted in `precisionMerged`, because in neither case
 * did the filer simply repeat itself.
 * `conflict` — the filing disagrees with itself.
 */
type FactAgreement = 'duplicate' | 'refines' | 'coarsens' | 'conflict';

/**
 * The amount in whole units of the given precision, rounded half away from zero
 * — the direction SEC filers round by, and the direction that makes 0.135 read
 * as 0.14 rather than 0.13.
 */
function unitsAt(value: number, decimals: number): number {
  const scaled = value * 10 ** decimals;

  return Math.sign(scaled) * Math.round(Math.abs(scaled));
}

function compareFacts(previous: XbrlFact, next: XbrlFact): FactAgreement {
  if (previous.raw === next.raw) return 'duplicate';
  if (previous.numeric === null || next.numeric === null) return 'conflict';

  const previousPrecision = effectivePrecision(previous);
  const nextPrecision = effectivePrecision(next);

  if (previous.numeric === next.numeric) {
    if (previousPrecision === nextPrecision) return 'duplicate';
    if (nextPrecision === null) return 'coarsens';
    if (previousPrecision === null) return 'refines';

    return nextPrecision > previousPrecision ? 'refines' : 'coarsens';
  }

  // One of them claims no precision at all, so there is no envelope to test the
  // other against and the disagreement stands.
  if (previousPrecision === null || nextPrecision === null) return 'conflict';

  const coarsest = Math.min(previousPrecision, nextPrecision);

  // Both exact, and they disagree. Nothing to reconcile.
  if (!Number.isFinite(coarsest)) return 'conflict';

  if (unitsAt(previous.numeric, coarsest) !== unitsAt(next.numeric, coarsest)) return 'conflict';

  return nextPrecision > previousPrecision ? 'refines' : 'coarsens';
}

function groupByContext(facts: readonly XbrlFact[]): ReadonlyMap<string, readonly XbrlFact[]> {
  const grouped = new Map<string, XbrlFact[]>();

  for (const fact of facts) {
    const bucket = grouped.get(fact.contextRef);

    if (bucket === undefined) grouped.set(fact.contextRef, [fact]);
    else bucket.push(fact);
  }

  return grouped;
}

/**
 * Maps a declared XBRL unit onto the model's unit type. Returns `null` for a
 * unit this project does not model, so an unrecognised unit becomes a refusal
 * rather than an assumed USD (Invariant 2.6 forbids implicit currency).
 */
export function toModelUnit(unit: XbrlUnit | undefined): Unit | null {
  if (unit === undefined || unit.isRatio) return null;

  const measure = unit.measures[0];

  if (measure === undefined || unit.measures.length !== 1) return null;
  if (measure === 'pure') return { kind: 'pure' };

  const colon = measure.indexOf(':');

  if (colon === -1) return { kind: 'count', measure };

  const prefix = measure.slice(0, colon);
  const localName = measure.slice(colon + 1);

  if (prefix === 'iso4217') return { kind: 'monetary', currency: localName };

  return { kind: 'count', measure: localName };
}

/** True when the namespace is a us-gaap taxonomy release of any year. */
export function isUsGaapNamespace(namespace: string | null): boolean {
  return (
    namespace !== null && /^https?:\/\/fasb\.org\/us-gaap\/\d{4}(-\d{2}-\d{2})?$/.test(namespace)
  );
}

/**
 * True when the namespace is an `srt` (SEC Reporting Taxonomy) release of any
 * year.
 *
 * `srt` is a separate namespace from `us-gaap`, and several axes that dimension
 * segment facts live in it — `srt:ConsolidationItemsAxis` and
 * `srt:ProductOrServiceAxis` among them. Testing those with
 * `isUsGaapNamespace` is always false, which is how the companion-axis allowlist
 * in `segment-contexts.ts` came to be unreachable code.
 */
export function isSrtNamespace(namespace: string | null): boolean {
  return namespace !== null && /^https?:\/\/fasb\.org\/srt\/\d{4}(-\d{2}-\d{2})?$/.test(namespace);
}
