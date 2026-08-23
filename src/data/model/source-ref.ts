/**
 * Provenance as a type, not an annotation (Invariant 2.2).
 *
 * A `SourceRef` names one tagged fact in one filing precisely enough that a
 * reader can open the Form 10-K and find it: the accession, the form, the fiscal
 * period, the XBRL tag with its namespace, the context it was reported in, and
 * the dimensional axis and member that make it a segment figure rather than a
 * consolidated one.
 *
 * Nothing in this project constructs a financial figure without one. That is
 * enforced by `figure.ts`, whose only constructors demand either a `SourceRef`
 * or a non-empty list of them.
 */

/** One axis/member pair from an XBRL context. Both sides are kept as QNames. */
export interface DimensionRef {
  /** The axis as written in the instance, e.g. `us-gaap:StatementBusinessSegmentsAxis`. */
  readonly axis: string;
  /** The axis namespace URI, so a prefix rebinding cannot change identity. */
  readonly axisNamespace: string;
  readonly axisLocalName: string;
  /** The member as written, e.g. `msft:IntelligentCloudMember`. */
  readonly member: string;
  readonly memberNamespace: string;
  readonly memberLocalName: string;
}

export interface SourceRef {
  readonly cik: string;
  /** Dashed accession, e.g. `0001193125-26-323660`. */
  readonly accession: string;
  /** As filed: `10-K`, `10-K/A`. */
  readonly form: string;
  /** The archive file the fact was read out of. */
  readonly documentFile: string;
  /** `2026` for a filing whose `dei:DocumentFiscalYearFocus` is 2026. */
  readonly fiscalYear: number;
  /** `FY`, `Q1`..`Q4`, as the filer focuses it. */
  readonly fiscalPeriod: string;
  /** Period start for a duration fact; `null` for an instant. */
  readonly periodStart: string | null;
  /** Period end for a duration, or the instant date. */
  readonly periodEnd: string;
  /** Namespace prefix as written, e.g. `us-gaap`. */
  readonly taxonomy: string;
  readonly namespace: string;
  /** Local name only, e.g. `OperatingIncomeLoss`. */
  readonly tag: string;
  readonly contextRef: string;
  readonly unitRef: string | null;
  /** XBRL `decimals`. `-6` means the figure is reported to the million. */
  readonly decimals: number | null;
  /** Empty for a consolidated fact; one entry for a plain segment fact. */
  readonly dimensions: readonly DimensionRef[];
  /** The instance's own fact id, when it carries one. */
  readonly factId: string | null;
}

/** `us-gaap:OperatingIncomeLoss`. */
export function qualifiedTag(ref: SourceRef): string {
  return `${ref.taxonomy}:${ref.tag}`;
}

/**
 * A stable identity for one fact: tag, context and unit. Two facts sharing this
 * key must carry the same value, and `xbrl-instance.ts` reports it as a conflict
 * when they do not.
 */
export function factKey(ref: SourceRef): string {
  return `${ref.namespace}#${ref.tag}@${ref.contextRef}/${ref.unitRef ?? '-'}`;
}

/** One line an analyst can check against the filing. Used in detail surfaces. */
export function describeSourceRef(ref: SourceRef): string {
  const period =
    ref.periodStart === null ? ref.periodEnd : `${ref.periodStart} to ${ref.periodEnd}`;
  const dimensions =
    ref.dimensions.length === 0
      ? 'consolidated'
      : ref.dimensions.map((d) => `${d.axis}=${d.member}`).join(', ');

  return `${qualifiedTag(ref)} · ${ref.form} ${ref.accession} · FY${String(ref.fiscalYear)} ${ref.fiscalPeriod} · ${period} · ${dimensions}`;
}
