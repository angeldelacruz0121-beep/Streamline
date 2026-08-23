/**
 * The EDGAR client. The adapter surface Ledger builds against (Invariant 4.4):
 * every method returns a typed `EdgarResult`, never throws for a data
 * condition, and never returns an unexplained empty value.
 *
 * What this client does not do, on purpose: parse a financial payload. The
 * companyfacts, companyconcept and archive-document methods hand back the
 * response text with its content type and stop there. Conduit owns transport;
 * what a number means is Ledger's, and there is exactly one place that decides.
 *
 * Construction fails closed. With `SEC_CONTACT_EMAIL` unset there is no client,
 * so there is no request (Invariant 4.6).
 */
import { MemoryCacheStore, type CacheEntry, type CacheStore } from '../cache/store.ts';
import type { Validated } from '../../types/brand.ts';
import { parseDailyIndexDetailed, type DailyIndexRecord } from './daily-index.ts';
import {
  archiveDocumentUrl,
  companyConceptUrl,
  companyFactsUrl,
  dailyIndexUrl,
  filingIndexUrl,
  submissionsOverflowUrl,
  submissionsUrl,
  tickerMapUrl,
  type DailyIndexKind,
} from './endpoints.ts';
import type {
  EdgarFailure,
  EdgarOk,
  EdgarProvenance,
  EdgarResult,
  EdgarSchemaMismatch,
} from './errors.ts';
import {
  archiveInventory,
  buildFilingSeries,
  toFilingRecords,
  type ArchiveInventory,
  type FilingRecordSet,
  type FilingSeries,
} from './filings.ts';
import { configureMaxRequestsPerSecond } from './rate-limit.ts';
import {
  archiveIndexBoundary,
  submissionsBoundary,
  submissionsOverflowBoundary,
  tickerMapBoundary,
  type SubmissionsIndex,
} from './schemas.ts';
import {
  fetchEdgar,
  nativeFetchTransport,
  type EdgarTransport,
  type RawOutcome,
} from './transport.ts';
import { composeUserAgent, readContactEmailFromEnv } from './user-agent.ts';

/**
 * A payload this layer deliberately did not interpret. Ledger parses it behind
 * its own boundary; handing over text makes that division checkable rather than
 * merely stated.
 */
export interface UnparsedPayload {
  readonly text: string;
  readonly contentType: string | null;
}

export interface CompanySubmissions {
  readonly cik: string;
  /**
   * The filer's registered name. Read from the submissions document's `name`
   * field - submissions has no `entityName`; that spelling is companyfacts'.
   * The name is kept here so one adapter field means the same thing whichever
   * endpoint it was read from.
   */
  readonly entityName: string;
  readonly sic: string | null;
  readonly sicDescription: string | null;
  /**
   * EDGAR's `category`, e.g. "Large accelerated filer" - verbatim, unclassified.
   * It is here because the filing deadline that decides whether a filing is late
   * depends on it, and it turned out to be present on the submissions document
   * after all. Whether a filing is late remains Ledger's call (Invariant 2.5).
   */
  readonly filerCategory: string | null;
  readonly tickers: readonly string[];
  readonly exchanges: readonly string[];
  readonly fiscalYearEnd: string | null;
  readonly filings: FilingRecordSet;
  /** Overflow file names holding older history, per EDGAR's `filings.files`. */
  readonly overflowFiles: readonly string[];
  /** `true` when older filings exist that this response does not contain. */
  readonly historyTruncated: boolean;
  readonly raw: Validated<SubmissionsIndex>;
}

export interface CikMatch {
  readonly cik: string;
  readonly ticker: string;
  readonly title: string;
}

export interface EdgarClientOptions {
  /** Defaults to `SEC_CONTACT_EMAIL`. Throws if neither is usable. */
  readonly contactEmail?: string | undefined;
  readonly transport?: EdgarTransport | undefined;
  readonly cache?: CacheStore | undefined;
  readonly random?: (() => number) | undefined;
  /** Lower the global ceiling. Raising it above 10 throws (Invariant 4.6). */
  readonly maxRequestsPerSecond?: number | undefined;
}

export interface FilingSeriesOptions {
  /**
   * Fetch submissions overflow files so the series covers a filer's whole
   * history. Costs one request per overflow file; off by default, and the
   * result says `historyTruncated` when it is off and history exists.
   */
  readonly includeHistory?: boolean;
}

const JSON_ACCEPT = 'application/json';
const TEXT_ACCEPT = 'text/plain, text/html, application/xml, text/xml, */*';

export class EdgarClient {
  readonly userAgent: string;
  readonly #transport: EdgarTransport;
  readonly #cache: CacheStore;
  readonly #random: (() => number) | undefined;

  constructor(options: EdgarClientOptions = {}) {
    this.userAgent = composeUserAgent(options.contactEmail ?? readContactEmailFromEnv());
    this.#transport = options.transport ?? nativeFetchTransport;
    this.#cache = options.cache ?? new MemoryCacheStore();
    this.#random = options.random;

    if (options.maxRequestsPerSecond !== undefined) {
      configureMaxRequestsPerSecond(options.maxRequestsPerSecond);
    }
  }

  /** Symbol to CIK. The only supported lookup path in v1 - see `ENDPOINTS.md`. */
  async resolveCik(ticker: string): Promise<EdgarOk<CikMatch> | EdgarFailure> {
    const url = tickerMapUrl();
    const outcome = await this.#retrieve(url, JSON_ACCEPT);

    if (outcome.kind !== 'body') return fromFailure(outcome);

    const parsed = parseJson(outcome.entry, outcome.provenance);

    if (parsed.kind !== 'ok') return parsed;

    const checked = tickerMapBoundary.check(parsed.value);

    if (!checked.ok) return schemaMismatch(outcome.provenance, checked.issues);

    const wanted = ticker.trim().toUpperCase();

    for (const row of Object.values(checked.value)) {
      if (row.ticker.toUpperCase() === wanted) {
        return {
          kind: 'ok',
          provenance: outcome.provenance,
          value: {
            cik: String(row.cik_str).padStart(10, '0'),
            ticker: row.ticker,
            title: row.title,
          },
        };
      }
    }

    return {
      kind: 'not-found',
      provenance: outcome.provenance,
      detail: `No CIK in the SEC ticker map for ${JSON.stringify(ticker)}.`,
    };
  }

  /** Every filing EDGAR lists for a company, plus what it does not list. */
  async getSubmissions(cik: string | number): Promise<EdgarOk<CompanySubmissions> | EdgarFailure> {
    const url = submissionsUrl(cik);
    const outcome = await this.#retrieve(url, JSON_ACCEPT);

    if (outcome.kind !== 'body') return fromFailure(outcome);

    const parsed = parseJson(outcome.entry, outcome.provenance);

    if (parsed.kind !== 'ok') return parsed;

    const checked = submissionsBoundary.check(parsed.value);

    if (!checked.ok) return schemaMismatch(outcome.provenance, checked.issues);

    const index = checked.value;
    const overflowFiles = (index.filings.files ?? []).map((file) => file.name);

    return {
      kind: 'ok',
      provenance: outcome.provenance,
      value: {
        cik: String(index.cik).padStart(10, '0'),
        entityName: index.name,
        sic: index.sic ?? null,
        sicDescription: index.sicDescription ?? null,
        filerCategory: index.category ?? null,
        tickers: index.tickers ?? [],
        exchanges: index.exchanges ?? [],
        fiscalYearEnd: index.fiscalYearEnd ?? null,
        filings: toFilingRecords(index.filings.recent),
        overflowFiles,
        historyTruncated: overflowFiles.length > 0,
        raw: index,
      },
    };
  }

  /**
   * One form's filings grouped by period, each with its amendment chain and any
   * NT late-filing notification attached. Amendments are never returned
   * detached from the original they amend.
   */
  async getFilingSeries(
    cik: string | number,
    form: string,
    options: FilingSeriesOptions = {},
  ): Promise<EdgarOk<readonly FilingSeries[]> | EdgarFailure> {
    const submissions = await this.getSubmissions(cik);

    if (submissions.kind !== 'ok') return submissions;

    const records = [...submissions.value.filings.records];
    let truncated = submissions.value.historyTruncated;

    if (options.includeHistory === true && submissions.value.overflowFiles.length > 0) {
      for (const fileName of submissions.value.overflowFiles) {
        const url = submissionsOverflowUrl(fileName);
        const outcome = await this.#retrieve(url, JSON_ACCEPT);

        if (outcome.kind !== 'body') return fromFailure(outcome);

        const parsed = parseJson(outcome.entry, outcome.provenance);

        if (parsed.kind !== 'ok') return parsed;

        const checked = submissionsOverflowBoundary.check(parsed.value);

        if (!checked.ok) return schemaMismatch(outcome.provenance, checked.issues);

        records.push(...toFilingRecords(checked.value).records);
      }

      truncated = false;
    }

    return {
      kind: 'ok',
      provenance: submissions.provenance,
      value: buildFilingSeries(records, form, { historyTruncated: truncated }),
    };
  }

  /**
   * All company facts, unparsed. Non-dimensional only: per-segment values are
   * absent from this endpoint entirely, so segment work must go through
   * `getFilingIndex` and `getArchiveDocument` (see `ENDPOINTS.md`).
   */
  async getCompanyFacts(cik: string | number): Promise<EdgarOk<UnparsedPayload> | EdgarFailure> {
    return this.#payload(companyFactsUrl(cik), JSON_ACCEPT);
  }

  /** One concept over time, unparsed. Non-dimensional, same caveat as facts. */
  async getCompanyConcept(
    cik: string | number,
    taxonomy: string,
    tag: string,
  ): Promise<EdgarOk<UnparsedPayload> | EdgarFailure> {
    return this.#payload(companyConceptUrl(cik, taxonomy, tag), JSON_ACCEPT);
  }

  /**
   * What one accession actually contains. Returns `incomplete-xbrl` - with the
   * inventory still attached - when the instance document, the FilingSummary or
   * the rendered R-files are absent, because those are exactly the artifacts
   * dimensional data is read from.
   */
  async getFilingIndex(
    cik: string | number,
    accession: string,
    options: { readonly filedAt?: string | undefined } = {},
  ): Promise<EdgarResult<ArchiveInventory>> {
    const url = filingIndexUrl(cik, accession);
    const filedAtEpochMs =
      options.filedAt === undefined ? null : Date.parse(`${options.filedAt}T00:00:00Z`) || null;
    const outcome = await this.#retrieve(url, JSON_ACCEPT, filedAtEpochMs);

    if (outcome.kind !== 'body') return fromFailure(outcome);

    const parsed = parseJson(outcome.entry, outcome.provenance);

    if (parsed.kind !== 'ok') return parsed;

    const checked = archiveIndexBoundary.check(parsed.value);

    if (!checked.ok) return schemaMismatch(outcome.provenance, checked.issues);

    const inventory = archiveInventory(checked.value, accession);
    const blocking = inventory.missing.filter((item) => item !== 'MetaLinks.json');

    if (blocking.length > 0) {
      return {
        kind: 'incomplete-xbrl',
        provenance: outcome.provenance,
        value: inventory,
        missing: inventory.missing,
        available: inventory.files,
        detail:
          `Accession ${accession} is missing ${blocking.join(', ')}. ` +
          'Dimensional (segment) facts cannot be read from this filing.',
      };
    }

    return { kind: 'ok', provenance: outcome.provenance, value: inventory };
  }

  /** One document out of one accession, unparsed. Immutable, cached forever. */
  async getArchiveDocument(
    cik: string | number,
    accession: string,
    fileName: string,
  ): Promise<EdgarOk<UnparsedPayload> | EdgarFailure> {
    return this.#payload(archiveDocumentUrl(cik, accession, fileName), TEXT_ACCEPT);
  }

  /**
   * Everything filed on one day. The discovery feed the refresh schedule runs on.
   *
   * Defaults to `master`, which is the pipe-delimited rendering and the only one
   * whose fields are unambiguously separated. `form` and `company` carry the same
   * rows fixed-width and are supported, but nothing in this project needs their
   * ordering, so the delimited feed is the default.
   *
   * A file with body rows that all fail to parse returns `schema-mismatch`, not an
   * empty success. An empty day is a real state; a format change is not, and the
   * two must not look alike downstream (Invariant 2.2).
   */
  async getDailyIndex(
    date: string,
    kind: DailyIndexKind = 'master',
  ): Promise<EdgarOk<readonly DailyIndexRecord[]> | EdgarFailure> {
    const url = dailyIndexUrl(date, kind);
    const outcome = await this.#retrieve(url, TEXT_ACCEPT);

    if (outcome.kind !== 'body') return fromFailure(outcome);

    const parsed = parseDailyIndexDetailed(outcome.entry.body, kind);

    if (parsed.records.length === 0 && parsed.malformedRows > 0) {
      return schemaMismatch(outcome.provenance, [
        {
          path: [kind],
          message:
            `Daily index had ${parsed.malformedRows} body rows and none parsed. ` +
            'The file format for this index kind has changed.',
        },
      ]);
    }

    return { kind: 'ok', provenance: outcome.provenance, value: parsed.records };
  }

  async #payload(url: string, accept: string): Promise<EdgarOk<UnparsedPayload> | EdgarFailure> {
    const outcome = await this.#retrieve(url, accept);

    if (outcome.kind !== 'body') return fromFailure(outcome);

    return {
      kind: 'ok',
      provenance: outcome.provenance,
      value: { text: outcome.entry.body, contentType: outcome.entry.contentType },
    };
  }

  #retrieve(
    url: string,
    accept: string,
    filedAtEpochMs: number | null = null,
  ): Promise<RawOutcome> {
    return fetchEdgar({
      url,
      accept,
      userAgent: this.userAgent,
      transport: this.#transport,
      cache: this.#cache,
      random: this.#random,
      filedAtEpochMs,
    });
  }
}

/** Constructs a client. Throws if no usable contact email is available. */
export function createEdgarClient(options: EdgarClientOptions = {}): EdgarClient {
  return new EdgarClient(options);
}

function fromFailure(outcome: Exclude<RawOutcome, { kind: 'body' }>): EdgarFailure {
  return outcome;
}

function schemaMismatch(
  provenance: EdgarProvenance,
  issues: readonly { readonly path: readonly (string | number)[]; readonly message: string }[],
): EdgarSchemaMismatch {
  return {
    kind: 'schema-mismatch',
    provenance,
    issues,
    detail: `EDGAR payload did not match the documented envelope: ${issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .slice(0, 5)
      .join('; ')}`,
  };
}

function parseJson(
  entry: CacheEntry,
  provenance: EdgarProvenance,
): { readonly kind: 'ok'; readonly value: unknown } | EdgarSchemaMismatch {
  try {
    return { kind: 'ok', value: JSON.parse(entry.body) as unknown };
  } catch (cause) {
    return {
      kind: 'schema-mismatch',
      provenance,
      issues: [
        {
          path: [],
          message: `Response was not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
        },
      ],
      detail: 'EDGAR returned a body that is not JSON. Often an error page served with status 200.',
    };
  }
}
