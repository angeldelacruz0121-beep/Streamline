/**
 * Structural reading of EDGAR's own index data. Form codes, accession numbers,
 * dates and file names - nothing else. No number in a filing is read here, and
 * no judgement about a filing is made here.
 *
 * The line this file will not cross: it reports that a 10-K was filed 29 days
 * after its period ended and that no NT 10-K accompanies it. It does not say
 * whether that is late, because lateness depends on filer category, which the
 * submissions index does not carry. Classification is Ledger's (Invariant 2.5).
 */
import type { ArchiveIndex, FilingColumns } from './schemas.ts';

export type AmendmentRole = 'original' | 'amendment' | 'notification-of-late-filing';

/** How much XBRL a filing carries. `unknown` when EDGAR omitted the flags. */
export type XbrlAvailability = 'inline' | 'exhibit' | 'none' | 'unknown';

export interface FilingRecord {
  readonly accession: string;
  /** As filed: `10-K`, `10-K/A`, `NT 10-K`. */
  readonly form: string;
  /** The form stripped of amendment and late-notification markers: `10-K`. */
  readonly baseForm: string;
  readonly role: AmendmentRole;
  readonly filingDate: string;
  readonly reportDate: string | null;
  readonly acceptanceDateTime: string | null;
  readonly primaryDocument: string | null;
  readonly xbrl: XbrlAvailability;
  readonly items: string | null;
  readonly sizeBytes: number | null;
}

/** Observable timing facts. Deliberately not a verdict. */
export interface FilingTimeliness {
  readonly periodOfReport: string | null;
  readonly filingDate: string | null;
  readonly acceptanceDateTime: string | null;
  readonly daysFromPeriodEndToFiling: number | null;
  readonly lateNotificationPresent: boolean;
  /**
   * Always `false` here. Filer category (large accelerated / accelerated /
   * non-accelerated) sets the deadline and does not appear in the submissions
   * index, so this layer never has the input needed to call a filing late.
   */
  readonly filerCategoryKnown: false;
  readonly classification: 'not-classified-by-transport';
}

export interface FilingSeries {
  readonly baseForm: string;
  readonly periodOfReport: string | null;
  /** `null` when only amendments are visible - see `historyTruncated`. */
  readonly original: FilingRecord | null;
  /** Oldest first. An amendment supersedes for the facts it restates, not wholesale. */
  readonly amendments: readonly FilingRecord[];
  readonly lateNotifications: readonly FilingRecord[];
  readonly timeliness: FilingTimeliness;
  readonly xbrl: XbrlAvailability;
  /** `true` when older filings exist in submissions overflow files that were not fetched. */
  readonly historyTruncated: boolean;
}

export interface FilingRecordSet {
  readonly records: readonly FilingRecord[];
  /**
   * Rows EDGAR's columnar arrays could not produce a usable record for. Never
   * dropped silently: a ragged index is a data-quality fact, not a non-event.
   */
  readonly malformedRows: number;
}

const AMENDMENT_SUFFIX = /\/A$/;
const LATE_NOTIFICATION_PREFIX = /^NT\s+/i;
const DAY_MS = 86_400_000;

function toRole(form: string): AmendmentRole {
  if (LATE_NOTIFICATION_PREFIX.test(form)) return 'notification-of-late-filing';

  return AMENDMENT_SUFFIX.test(form) ? 'amendment' : 'original';
}

export function baseFormOf(form: string): string {
  return form.replace(LATE_NOTIFICATION_PREFIX, '').replace(AMENDMENT_SUFFIX, '').trim();
}

function flag(value: number | string | undefined): boolean | null {
  if (value === undefined) return null;

  return value === 1 || value === '1';
}

function xbrlFrom(inline: boolean | null, exhibit: boolean | null): XbrlAvailability {
  if (inline === null && exhibit === null) return 'unknown';
  if (inline === true) return 'inline';
  if (exhibit === true) return 'exhibit';

  return 'none';
}

/** Zips EDGAR's parallel arrays into records, counting rows it could not zip. */
export function toFilingRecords(columns: FilingColumns): FilingRecordSet {
  const records: FilingRecord[] = [];
  let malformedRows = 0;

  for (let index = 0; index < columns.accessionNumber.length; index += 1) {
    const accession = columns.accessionNumber[index];
    const form = columns.form[index];
    const filingDate = columns.filingDate[index];

    if (
      accession === undefined ||
      form === undefined ||
      filingDate === undefined ||
      accession.length === 0 ||
      form.length === 0
    ) {
      malformedRows += 1;
      continue;
    }

    const reportDate = columns.reportDate[index];
    const acceptance = columns.acceptanceDateTime[index];
    const primary = columns.primaryDocument[index];
    const items = columns.items?.[index];
    const size = columns.size?.[index];

    records.push({
      accession,
      form,
      baseForm: baseFormOf(form),
      role: toRole(form),
      filingDate,
      reportDate: reportDate !== undefined && reportDate.length > 0 ? reportDate : null,
      acceptanceDateTime: acceptance !== undefined && acceptance.length > 0 ? acceptance : null,
      primaryDocument: primary !== undefined && primary.length > 0 ? primary : null,
      xbrl: xbrlFrom(flag(columns.isInlineXBRL?.[index]), flag(columns.isXBRL?.[index])),
      items: items !== undefined && items.length > 0 ? items : null,
      sizeBytes: typeof size === 'number' ? size : null,
    });
  }

  return { records, malformedRows };
}

function daysBetween(from: string | null, to: string | null): number | null {
  if (from === null || to === null) return null;

  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  return Math.round((end - start) / DAY_MS);
}

/**
 * Groups a company's filings of one form into per-period series, each carrying
 * its original, its amendments in filing order, and any late-filing
 * notification. An amendment is never returned without its original in view,
 * and an original is never returned without its amendments.
 */
export function buildFilingSeries(
  records: readonly FilingRecord[],
  baseForm: string,
  options: { readonly historyTruncated?: boolean } = {},
): readonly FilingSeries[] {
  const relevant = records.filter((record) => record.baseForm === baseForm);
  const byPeriod = new Map<string, FilingRecord[]>();

  for (const record of relevant) {
    const key = record.reportDate ?? `unknown:${record.accession}`;
    const bucket = byPeriod.get(key);

    if (bucket === undefined) {
      byPeriod.set(key, [record]);
    } else {
      bucket.push(record);
    }
  }

  const series: FilingSeries[] = [];

  for (const [key, bucket] of byPeriod) {
    const ordered = [...bucket].sort((left, right) =>
      left.filingDate.localeCompare(right.filingDate),
    );
    const original = ordered.find((record) => record.role === 'original') ?? null;
    const amendments = ordered.filter((record) => record.role === 'amendment');
    const lateNotifications = ordered.filter(
      (record) => record.role === 'notification-of-late-filing',
    );
    const periodOfReport = key.startsWith('unknown:') ? null : key;
    const anchor = original ?? amendments[0] ?? lateNotifications[0] ?? null;

    series.push({
      baseForm,
      periodOfReport,
      original,
      amendments,
      lateNotifications,
      historyTruncated: options.historyTruncated ?? false,
      xbrl: original?.xbrl ?? amendments[0]?.xbrl ?? 'unknown',
      timeliness: {
        periodOfReport,
        filingDate: anchor?.filingDate ?? null,
        acceptanceDateTime: anchor?.acceptanceDateTime ?? null,
        daysFromPeriodEndToFiling: daysBetween(periodOfReport, anchor?.filingDate ?? null),
        lateNotificationPresent: lateNotifications.length > 0,
        filerCategoryKnown: false,
        classification: 'not-classified-by-transport',
      },
    });
  }

  return series.sort((left, right) =>
    (right.periodOfReport ?? '').localeCompare(left.periodOfReport ?? ''),
  );
}

/**
 * Calendar-year slots with no annual filing between the first and last period
 * present. Pure arithmetic over report dates - it makes no claim about the
 * filer's fiscal calendar, which Ledger normalises (Invariant 2.5). A gap here
 * means "ask", not "the company reported nothing".
 */
export function detectAnnualPeriodGaps(series: readonly FilingSeries[]): readonly number[] {
  const years = series
    .map((entry) =>
      entry.periodOfReport === null ? null : Number(entry.periodOfReport.slice(0, 4)),
    )
    .filter((year): year is number => year !== null && Number.isFinite(year))
    .sort((left, right) => left - right);

  const first = years.at(0);
  const last = years.at(-1);

  if (first === undefined || last === undefined) return [];

  const present = new Set(years);
  const gaps: number[] = [];

  for (let year = first; year <= last; year += 1) {
    if (!present.has(year)) gaps.push(year);
  }

  return gaps;
}

export interface ArchiveInventory {
  readonly accession: string;
  readonly files: readonly string[];
  /** The raw XBRL instance - where dimensional (segment) facts live. */
  readonly instanceDocument: string | null;
  readonly filingSummary: string | null;
  readonly metaLinks: string | null;
  /** Rendered statement fragments, `R1.htm` upward. */
  readonly rFiles: readonly string[];
  /** Named absences, so an incomplete exhibit is a stated fact. */
  readonly missing: readonly string[];
  readonly xbrl: XbrlAvailability;
}

const LINKBASE_SUFFIX = /_(cal|def|lab|pre)\.xml$/i;

/**
 * What a filing's archive directory actually contains. The companyfacts and
 * companyconcept APIs return non-dimensional facts only, so anything
 * segment-bearing has to come from the instance document or the FilingSummary
 * R-files listed here. Absences are named rather than implied.
 */
export function archiveInventory(index: ArchiveIndex, accession: string): ArchiveInventory {
  const files = index.directory.item.map((item) => item.name);
  const filingSummary = files.find((name) => name.toLowerCase() === 'filingsummary.xml') ?? null;
  const metaLinks = files.find((name) => name.toLowerCase() === 'metalinks.json') ?? null;
  const rFiles = files.filter((name) => /^R\d+\.htm$/i.test(name));
  const instanceDocument =
    files.find((name) => /_htm\.xml$/i.test(name)) ??
    files.find(
      (name) =>
        /\.xml$/i.test(name) &&
        !LINKBASE_SUFFIX.test(name) &&
        !/^filingsummary\.xml$/i.test(name) &&
        !/-index\.xml$/i.test(name) &&
        !/^\d{18}\.xml$/i.test(name),
    ) ??
    null;

  const missing: string[] = [];

  if (instanceDocument === null) missing.push('xbrl-instance');
  if (filingSummary === null) missing.push('FilingSummary.xml');
  if (metaLinks === null) missing.push('MetaLinks.json');
  if (rFiles.length === 0) missing.push('R-files');

  return {
    accession,
    files,
    instanceDocument,
    filingSummary,
    metaLinks,
    rFiles,
    missing,
    xbrl:
      instanceDocument === null
        ? 'none'
        : /_htm\.xml$/i.test(instanceDocument)
          ? 'inline'
          : 'exhibit',
  };
}
