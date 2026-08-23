/**
 * Which filing of a period is the one to read.
 *
 * A filer that finds a mistake in an annual report does not edit it - EDGAR
 * accessions are immutable - it files a correction, a `10-K/A`, against the same
 * period. Until this module existed the correction was ignored and the original
 * was served, so a reader could be shown a number the filer had already
 * withdrawn. Angel's ruling, 2026-08-23: the correction is the authoritative
 * copy and is what Streamline reads.
 *
 * The rule, plainly:
 *
 *   For the period being shown, take the newest filing that actually carries a
 *   financial-statement exhibit. Corrections are considered newest first; if two
 *   corrections exist, the later one wins, because it was filed knowing the
 *   earlier. When no correction carries financial statements the original is
 *   read, and every correction that was passed over is named in the result.
 *
 * The qualifier is not a hedge, it is the shape of the real data. Filers
 * routinely amend an annual report to add the executive-compensation section or
 * re-sign an exhibit, and those corrections contain no financial statements at
 * all. HP's FY2019 correction (`0001206774-20-000632`) is exactly this: one
 * rendered report, the cover page, and a `dei`-only taxonomy. Reading it as
 * authoritative would blank a year that is presently correct. HP's FY2022
 * correction (`0000047217-23-000075`) is the other kind - 145 reports, seven of
 * them financial statements - and it is the one that must supersede.
 *
 * The submissions flags cannot tell those two apart: cover-page tagging has been
 * mandatory since 2019, so both are marked `isInlineXBRL = 1`. Only the filing's
 * own report index distinguishes them, which is why this module opens
 * `FilingSummary.xml` rather than trusting a flag. That costs two extra requests
 * per correction, both against immutable accessioned bytes that are cached
 * forever, and none at all for a period with no correction - which is every
 * filer in the corpus today.
 *
 * What this module will not do is guess. If a correction exists and EDGAR will
 * not tell us what is in it, the answer is a typed failure, not the old number
 * served quietly. Showing a withdrawn figure because a request timed out is the
 * precise outcome the ruling forbids.
 */
import type { EdgarClient } from './client.ts';
import type { EdgarFailure } from './errors.ts';
import type { FilingRecord, FilingSeries } from './filings.ts';
import { statementReports } from './filing-summary.ts';

/** Whether the figure a reader sees came from the original filing or a correction. */
export type FilingRole = 'original' | 'amendment';

/** Why a correction that exists was not the one read. */
export type UnreadReason =
  /** The correction carries no XBRL instance at all - nothing structured to read. */
  | 'no-xbrl-exhibit'
  /** The correction carries XBRL, but no financial statement among its reports. */
  | 'no-financial-statements';

/**
 * A correction that exists and was not read.
 *
 * Carries enough for a later detail panel to show the reader what was filed
 * without a second trip to EDGAR - the accession, the form, when it was filed,
 * which period it amends, its primary document and its full document list, and
 * the titles of every report inside it. Angel asked for that panel; it is not
 * built here and no copy for it is written here, but the data it needs is
 * present so the feature does not require re-opening this decision.
 */
export interface UnreadAmendment {
  readonly accession: string;
  readonly form: string;
  readonly filingDate: string;
  readonly periodOfReport: string | null;
  readonly primaryDocument: string | null;
  readonly reason: UnreadReason;
  /** Every file in the correction's archive directory, as EDGAR lists them. */
  readonly documents: readonly string[];
  /** The correction's own rendered report titles. Empty when it renders none. */
  readonly reportTitles: readonly string[];
}

/** A late-filing notification (`NT 10-K`) filed against the same period. */
export interface LateNotification {
  readonly accession: string;
  readonly form: string;
  readonly filingDate: string;
  readonly primaryDocument: string | null;
}

/** The filing a figure came from, and everything around it a reader is owed. */
export interface AuthoritativeFiling {
  readonly accession: string;
  /** As filed: `10-K` or `10-K/A`. */
  readonly form: string;
  readonly role: FilingRole;
  readonly filingDate: string;
  readonly periodOfReport: string | null;
  /** The original this correction replaces. `null` when the original was read. */
  readonly amends: string | null;
  /** How many corrections exist for this period, read or not. */
  readonly amendmentCount: number;
  /** Newest first. Each names why it was not the one read. */
  readonly unreadAmendments: readonly UnreadAmendment[];
  readonly lateNotifications: readonly LateNotification[];
  /**
   * Every accession EDGAR lists for this period - original, corrections and late
   * notices alike. The derived-view cache keys on it, so a correction filed
   * after a view was stored cannot hide behind that stored view even when it
   * does not change which filing is read.
   */
  readonly periodFilings: readonly string[];
  /**
   * `true` when the correction carries an XBRL instance but publishes no report
   * index, so "does it restate the financials" could not be established and the
   * correction was read anyway. Rare and worth stating rather than hiding.
   */
  readonly statementsUndetermined: boolean;
  /** Older filings live in submissions overflow files that were not fetched. */
  readonly historyTruncated: boolean;
}

export type AuthoritativeResult =
  | { readonly kind: 'selected'; readonly filing: AuthoritativeFiling }
  /** No filing of this form can be named at all - no series, or notices only. */
  | { readonly kind: 'none'; readonly detail: string }
  /** A correction exists and EDGAR would not say what is in it. Never a fallback. */
  | { readonly kind: 'unresolved'; readonly failure: EdgarFailure; readonly detail: string };

/** Newest first, by filing date, corrections and original together. */
export function candidatesNewestFirst(series: FilingSeries): readonly FilingRecord[] {
  const candidates = [...series.amendments, ...(series.original === null ? [] : [series.original])];

  return candidates.sort((left, right) => right.filingDate.localeCompare(left.filingDate));
}

/**
 * The newest period that has something readable in it.
 *
 * A period whose only filing is a late-filing notice is skipped: an `NT 10-K`
 * announces that a report will be late, it is not the report. Super Micro has
 * exactly such a bucket, and treating it as the latest period would hide the
 * annual report the reader wants.
 */
export function newestReadablePeriod(series: readonly FilingSeries[]): FilingSeries | null {
  return series.find((entry) => candidatesNewestFirst(entry).length > 0) ?? null;
}

function toLateNotification(record: FilingRecord): LateNotification {
  return {
    accession: record.accession,
    form: record.form,
    filingDate: record.filingDate,
    primaryDocument: record.primaryDocument,
  };
}

/**
 * Resolves one filer's authoritative annual filing.
 *
 * Costs one submissions read - already cached, and the ingest was going to make
 * it anyway - plus, only when a correction exists, that correction's archive
 * index and its `FilingSummary.xml`. Both of those are accessioned bytes and are
 * cached immutably, so the second request for the same filer costs nothing.
 */
export async function resolveAuthoritativeFiling(
  client: EdgarClient,
  cik: string,
  form: string,
): Promise<AuthoritativeResult> {
  const series = await client.getFilingSeries(cik, form);

  if (series.kind !== 'ok') {
    // The failure's own words, unchanged. Nothing about corrections is involved
    // when the filing history itself could not be read, and rewriting EDGAR's
    // message here would change what every existing caller sees.
    return { kind: 'unresolved', failure: series, detail: series.detail };
  }

  const period = newestReadablePeriod(series.value);

  if (period === null) {
    return { kind: 'none', detail: `CIK ${cik} has no ${form} in the submissions index.` };
  }

  const candidates = candidatesNewestFirst(period);
  const lateNotifications = period.lateNotifications.map(toLateNotification);
  const periodFilings = [
    ...candidates.map((record) => record.accession),
    ...period.lateNotifications.map((record) => record.accession),
  ].sort();
  const unread: UnreadAmendment[] = [];

  for (const candidate of candidates) {
    if (candidate.role !== 'amendment') {
      return {
        kind: 'selected',
        filing: {
          accession: candidate.accession,
          form: candidate.form,
          role: 'original',
          filingDate: candidate.filingDate,
          periodOfReport: period.periodOfReport,
          amends: null,
          amendmentCount: period.amendments.length,
          unreadAmendments: unread,
          lateNotifications,
          periodFilings,
          statementsUndetermined: false,
          historyTruncated: period.historyTruncated,
        },
      };
    }

    const inspected = await inspectAmendment(client, cik, candidate);

    if (inspected.kind === 'unresolved') return inspected;

    if (inspected.kind === 'unread') {
      unread.push(inspected.amendment);
      continue;
    }

    return {
      kind: 'selected',
      filing: {
        accession: candidate.accession,
        form: candidate.form,
        role: 'amendment',
        filingDate: candidate.filingDate,
        periodOfReport: period.periodOfReport,
        amends: period.original?.accession ?? null,
        amendmentCount: period.amendments.length,
        unreadAmendments: unread,
        lateNotifications,
        periodFilings,
        statementsUndetermined: inspected.statementsUndetermined,
        historyTruncated: period.historyTruncated,
      },
    };
  }

  // Every candidate was a correction and none carried financial statements, so
  // there is no original to fall back to. Truncated history is the usual cause.
  return {
    kind: 'none',
    detail:
      `CIK ${cik} has ${String(unread.length)} ${form} correction(s) for period ` +
      `${period.periodOfReport ?? 'unknown'} and no original filing that carries financial ` +
      'statements. Nothing can be read for this period.',
  };
}

type Inspection =
  | { readonly kind: 'readable'; readonly statementsUndetermined: boolean }
  | { readonly kind: 'unread'; readonly amendment: UnreadAmendment }
  | { readonly kind: 'unresolved'; readonly failure: EdgarFailure; readonly detail: string };

/**
 * Does this correction restate the financials?
 *
 * Answered from the filing's own rendered report index, not from a byte
 * threshold and not from the submissions flags. A correction whose reports
 * include no financial statement corrects something else - Part III, an exhibit,
 * a signature - and does not supersede the numbers.
 */
async function inspectAmendment(
  client: EdgarClient,
  cik: string,
  record: FilingRecord,
): Promise<Inspection> {
  const index = await client.getFilingIndex(cik, record.accession, { filedAt: record.filingDate });

  if (index.kind !== 'ok' && index.kind !== 'incomplete-xbrl') {
    return {
      kind: 'unresolved',
      failure: index,
      detail:
        `A ${record.form} correction (${record.accession}) exists for this period and EDGAR would ` +
        'not say what is in it. The original is deliberately not served in its place.',
    };
  }

  const inventory = index.value;

  if (inventory.instanceDocument === null) {
    return {
      kind: 'unread',
      amendment: unreadFrom(record, 'no-xbrl-exhibit', inventory.files, []),
    };
  }

  if (inventory.filingSummary === null) {
    // XBRL is present but the filing publishes no report index, so the question
    // cannot be answered either way. Read it - it is the newer filing and it
    // carries structured data - and say the check was not conclusive.
    return { kind: 'readable', statementsUndetermined: true };
  }

  const summary = await client.getArchiveDocument(cik, record.accession, inventory.filingSummary);

  if (summary.kind !== 'ok') {
    return {
      kind: 'unresolved',
      failure: summary,
      detail:
        `A ${record.form} correction (${record.accession}) exists for this period and its report ` +
        'index could not be read. The original is deliberately not served in its place.',
    };
  }

  const reports = statementReports(summary.value.text);

  if (reports.statements.length > 0) return { kind: 'readable', statementsUndetermined: false };

  return {
    kind: 'unread',
    amendment: unreadFrom(record, 'no-financial-statements', inventory.files, reports.titles),
  };
}

function unreadFrom(
  record: FilingRecord,
  reason: UnreadReason,
  documents: readonly string[],
  reportTitles: readonly string[],
): UnreadAmendment {
  return {
    accession: record.accession,
    form: record.form,
    filingDate: record.filingDate,
    periodOfReport: record.reportDate,
    primaryDocument: record.primaryDocument,
    reason,
    documents,
    reportTitles,
  };
}
