/**
 * The filer's own taxonomy, read from `MetaLinks.json`.
 *
 * `MetaLinks.json` is EDGAR's rendering of the filing's label and presentation
 * linkbases. Two things live here that the instance document cannot tell us.
 *
 * **What a segment is called.** `msft:IntelligentCloudMember` is an identifier,
 * not a name. The filer's own label for it — "Intelligent Cloud" — is in the
 * label linkbase. De-camel-casing the local name would be inventing a name,
 * and a wrong segment name is a segment-identity error.
 *
 * **Which measures constitute the segment cost stack.** D11 forbids a fixed
 * category set, so the categories have to come from the filer. They do: the
 * presentation linkbase says which concepts the filer put in its segment
 * disclosure role, and that set is the filer's own answer to "what costs do I
 * disclose per segment". Nothing here is chosen by this project.
 *
 * Role ids, not note numbers. The segment note is Note 18 in FY2026 and FY2025
 * and Note 19 in FY2024, so a note number is not an identifier. The role id in
 * `longName` — `995637 - Disclosure - SEGMENT INFORMATION AND GEOGRAPHIC DATA`
 * — is stable, and so is the axis itself.
 */

export interface ReportRef {
  /** `R107`, the key MetaLinks uses; the file is `R107.htm`. */
  readonly key: string;
  readonly file: string;
  readonly role: string;
  readonly longName: string;
  readonly shortName: string;
  /** The numeric prefix of `longName`, e.g. `995637`. `null` when absent. */
  readonly roleId: string | null;
}

export interface TagInfo {
  /** The MetaLinks key, e.g. `us-gaap_OperatingIncomeLoss`. */
  readonly key: string;
  readonly prefix: string;
  readonly localName: string;
  readonly namespace: string;
  /** `monetaryItemType`, `domainItemType`, `integerItemType`, ... */
  readonly xbrlType: string;
  readonly presentationRoles: readonly string[];
  readonly label: string | null;
  readonly terseLabel: string | null;
}

export interface TaxonomyIndex {
  /** The inline document the linkbases belong to, e.g. `msft-20260630.htm`. */
  readonly document: string;
  readonly reports: readonly ReportRef[];
  readonly tags: ReadonlyMap<string, TagInfo>;
}

export type TaxonomyReadResult =
  | { readonly kind: 'ok'; readonly index: TaxonomyIndex }
  | { readonly kind: 'unreadable'; readonly detail: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Rule `decode-entities-in-linkbase-labels-v1`.
 *
 * `MetaLinks.json` carries labels with HTML entities left in, exactly as the
 * filer wrote them into its linkbase: NVIDIA's segment is
 * `Compute &amp;amp; Networking`. Two things go wrong if they are not decoded.
 * The label reaches a reader as literal `&amp;amp;`, and the cross-check against
 * the filer's own rendered schedule — which *is* decoded — compares
 * "compute amp networking" to "compute networking" and reports a naming conflict
 * where the filer used one name twice. NVIDIA was refused on exactly that.
 */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** A label as the filer meant it to read, with the linkbase's entities resolved. */
function asLabel(value: unknown): string | null {
  const text = asString(value);

  return text === null ? null : decodeEntities(text);
}

/** `us-gaap_OperatingIncomeLoss` to the QName `us-gaap:OperatingIncomeLoss`. */
export function tagKeyToQName(key: string): string {
  const underscore = key.indexOf('_');

  return underscore === -1 ? key : `${key.slice(0, underscore)}:${key.slice(underscore + 1)}`;
}

/** The QName `msft:IntelligentCloudMember` to the MetaLinks key. */
export function qNameToTagKey(qname: string): string {
  return qname.replace(':', '_');
}

export function readTaxonomyIndex(text: string): TaxonomyReadResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch (cause) {
    return {
      kind: 'unreadable',
      detail: `MetaLinks.json is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }

  const root = asRecord(parsed);
  const instances = root === null ? null : asRecord(root['instance']);

  if (instances === null) {
    return { kind: 'unreadable', detail: 'MetaLinks.json has no `instance` object.' };
  }

  const entry = Object.entries(instances)[0];

  if (entry === undefined) {
    return { kind: 'unreadable', detail: 'MetaLinks.json names no instance document.' };
  }

  const body = asRecord(entry[1]);

  if (body === null) {
    return { kind: 'unreadable', detail: `MetaLinks entry for ${entry[0]} is not an object.` };
  }

  const reports: ReportRef[] = [];
  const reportMap = asRecord(body['report']) ?? {};

  for (const [key, raw] of Object.entries(reportMap)) {
    const report = asRecord(raw);

    if (report === null) continue;

    const longName = asString(report['longName']) ?? '';

    reports.push({
      key,
      file: `${key}.htm`,
      role: asString(report['role']) ?? '',
      longName,
      shortName: asString(report['shortName']) ?? '',
      roleId: /^(\d+)\s*-\s/.exec(longName)?.[1] ?? null,
    });
  }

  const tags = new Map<string, TagInfo>();
  const tagMap = asRecord(body['tag']) ?? {};

  for (const [key, raw] of Object.entries(tagMap)) {
    const tag = asRecord(raw);

    if (tag === null) continue;

    const roles = asRecord(asRecord(asRecord(tag['lang'])?.['en-us'])?.['role']);
    const presentation = tag['presentation'];
    const underscore = key.indexOf('_');

    tags.set(key, {
      key,
      prefix: underscore === -1 ? '' : key.slice(0, underscore),
      localName: asString(tag['localname']) ?? key.slice(underscore + 1),
      namespace: asString(tag['nsuri']) ?? '',
      xbrlType: asString(tag['xbrltype']) ?? '',
      presentationRoles: Array.isArray(presentation)
        ? presentation.filter((role): role is string => typeof role === 'string')
        : [],
      label: asLabel(roles?.['label']),
      terseLabel: asLabel(roles?.['terseLabel']),
    });
  }

  if (reports.length === 0 && tags.size === 0) {
    return {
      kind: 'unreadable',
      detail:
        `MetaLinks.json parsed but named no reports and no tags in ${String(text.length)} ` +
        'characters. A non-empty document that yields nothing is a parse defect.',
    };
  }

  return { kind: 'ok', index: { document: entry[0], reports, tags } };
}

/** The report carrying a given disclosure role id, e.g. `995637`. */
export function reportForRoleId(index: TaxonomyIndex, roleId: string): ReportRef | null {
  return index.reports.find((report) => report.roleId === roleId) ?? null;
}

export function reportForRole(index: TaxonomyIndex, role: string): ReportRef | null {
  return index.reports.find((report) => report.role === role) ?? null;
}

/**
 * The roles in which every one of the given tags is presented together.
 *
 * This is how the segment *detail* report is found without a note number and
 * without matching on report titles: the one role that presents both the
 * business-segments axis and the filer's revenue concept is the schedule of
 * segment revenue and profit. A filer that presents them in two roles returns
 * two, and the caller decides rather than guessing.
 */
export function rolesPresentingAll(
  index: TaxonomyIndex,
  tagKeys: readonly string[],
): readonly string[] {
  const lists = tagKeys.map((key) => index.tags.get(key)?.presentationRoles ?? []);
  const first = lists[0];

  if (first === undefined || lists.some((list) => list.length === 0)) return [];

  return first.filter((role) => lists.every((list) => list.includes(role)));
}

/** Every tag presented in one role, optionally filtered by XBRL type. */
export function tagsInRole(
  index: TaxonomyIndex,
  role: string,
  xbrlType?: string,
): readonly TagInfo[] {
  const found: TagInfo[] = [];

  for (const tag of index.tags.values()) {
    if (!tag.presentationRoles.includes(role)) continue;
    if (xbrlType !== undefined && tag.xbrlType !== xbrlType) continue;
    found.push(tag);
  }

  return found;
}

/**
 * The filer's display name for a concept.
 *
 * Prefers `terseLabel`, which is the wording the filer puts in the table
 * heading. Falls back to the standard label with the `[Member]` and `[Axis]`
 * suffixes removed, since those are taxonomy bookkeeping and not a name anyone
 * reads. Returns `null` rather than inventing one.
 */
export function labelForTag(index: TaxonomyIndex, key: string): string | null {
  const tag = index.tags.get(key);

  if (tag === undefined) return null;
  if (tag.terseLabel !== null && tag.terseLabel.length > 0) return tag.terseLabel;
  if (tag.label === null) return null;

  const stripped = tag.label
    .replace(/\s*\[(Member|Axis|Domain|Line Items|Table)\]\s*$/i, '')
    .trim();

  return stripped.length === 0 ? null : stripped;
}
