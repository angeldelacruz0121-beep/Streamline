/**
 * URL construction for every EDGAR endpoint this project touches. Pure: no I/O,
 * no clock, no network. Which endpoint serves which purpose - and what each one
 * cannot do - is documented in `ENDPOINTS.md` beside this file.
 *
 * Two hosts, on purpose:
 *   data.sec.gov - the JSON convenience APIs (submissions, companyfacts,
 *                  companyconcept). Non-dimensional facts only.
 *   www.sec.gov  - the filing archive and the index feeds. Everything
 *                  dimensional (segment-bearing) lives here, in the raw XBRL
 *                  instance and the FilingSummary R-files.
 */
import type { EdgarResourceKind } from './errors.ts';

export const DATA_HOST = 'https://data.sec.gov';
export const WWW_HOST = 'https://www.sec.gov';

/** Full-text search backend. Documented in `ENDPOINTS.md`; not called in v1. */
export const FULL_TEXT_SEARCH_HOST = 'https://efts.sec.gov';

const CIK_DIGITS = 10;
const ACCESSION_PATTERN = /^(\d{10})-?(\d{2})-?(\d{6})$/;

export class EdgarIdentifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EdgarIdentifierError';
  }
}

/**
 * EDGAR is inconsistent about CIK formatting: the JSON APIs want a zero-padded
 * 10-digit CIK, the archive paths want it unpadded. Both forms are derived here
 * from one input so a caller never has to know which is which.
 */
export function padCik(cik: string | number): string {
  const digits = String(cik).trim().replace(/^CIK/i, '');

  if (!/^\d{1,10}$/.test(digits)) {
    throw new EdgarIdentifierError(
      `Not a CIK: ${JSON.stringify(String(cik))}. Expected 1-10 digits, optionally prefixed "CIK".`,
    );
  }

  return digits.padStart(CIK_DIGITS, '0');
}

/** The unpadded form used in `/Archives/edgar/data/<cik>/`. */
export function archiveCik(cik: string | number): string {
  return String(Number(padCik(cik)));
}

/** Canonical dashed accession, e.g. `0001193125-26-323660`. */
export function dashedAccession(accession: string): string {
  const match = ACCESSION_PATTERN.exec(accession.trim());

  if (match === null) {
    throw new EdgarIdentifierError(
      `Not an accession number: ${JSON.stringify(accession)}. Expected 18 digits, e.g. 0001193125-26-323660.`,
    );
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** The undashed form used as the archive directory name. */
export function compactAccession(accession: string): string {
  return dashedAccession(accession).replace(/-/g, '');
}

/** CIK -> ticker map. The only supported way to go from a symbol to a CIK. */
export function tickerMapUrl(): string {
  return `${WWW_HOST}/files/company_tickers.json`;
}

/** Every filing a company has made, most recent ~1000 inline plus overflow files. */
export function submissionsUrl(cik: string | number): string {
  return `${DATA_HOST}/submissions/CIK${padCik(cik)}.json`;
}

/** An older slice of the submissions history, named by `filings.files[].name`. */
export function submissionsOverflowUrl(fileName: string): string {
  if (!/^CIK\d{10}-submissions-\d{3}\.json$/.test(fileName)) {
    throw new EdgarIdentifierError(
      `Not a submissions overflow file name: ${JSON.stringify(fileName)}.`,
    );
  }

  return `${DATA_HOST}/submissions/${fileName}`;
}

/** All XBRL facts for a company. Non-dimensional only - see `ENDPOINTS.md`. */
export function companyFactsUrl(cik: string | number): string {
  return `${DATA_HOST}/api/xbrl/companyfacts/CIK${padCik(cik)}.json`;
}

/** One concept across every period. Non-dimensional only - see `ENDPOINTS.md`. */
export function companyConceptUrl(cik: string | number, taxonomy: string, tag: string): string {
  if (!/^[a-z][a-z0-9-]*$/.test(taxonomy)) {
    throw new EdgarIdentifierError(`Not a taxonomy prefix: ${JSON.stringify(taxonomy)}.`);
  }

  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(tag)) {
    throw new EdgarIdentifierError(`Not an XBRL tag: ${JSON.stringify(tag)}.`);
  }

  return `${DATA_HOST}/api/xbrl/companyconcept/CIK${padCik(cik)}/${taxonomy}/${tag}.json`;
}

/** Machine-readable directory listing for one accession. */
export function filingIndexUrl(cik: string | number, accession: string): string {
  return `${WWW_HOST}/Archives/edgar/data/${archiveCik(cik)}/${compactAccession(accession)}/index.json`;
}

/** One document inside one accession. The path segment-bearing data comes from. */
export function archiveDocumentUrl(
  cik: string | number,
  accession: string,
  fileName: string,
): string {
  if (fileName.length === 0 || fileName.includes('..') || fileName.includes('/')) {
    throw new EdgarIdentifierError(
      `Not an archive file name: ${JSON.stringify(fileName)}. Traversal and subpaths are refused.`,
    );
  }

  return `${WWW_HOST}/Archives/edgar/data/${archiveCik(cik)}/${compactAccession(accession)}/${fileName}`;
}

export type DailyIndexKind = 'form' | 'company' | 'master';

/** Everything filed on one day, across all filers. `date` is `YYYY-MM-DD`. */
export function dailyIndexUrl(date: string, kind: DailyIndexKind = 'form'): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (match === null) {
    throw new EdgarIdentifierError(`Not a date: ${JSON.stringify(date)}. Expected YYYY-MM-DD.`);
  }

  const [, year, month, day] = match as unknown as [string, string, string, string];
  const quarter = Math.floor((Number(month) - 1) / 3) + 1;

  return `${WWW_HOST}/Archives/edgar/daily-index/${year}/QTR${quarter}/${kind}.${year}${month}${day}.idx`;
}

/**
 * Classify an arbitrary EDGAR URL back into a resource kind. The cache TTL
 * policy keys off this, so a URL built anywhere is aged by the same rule.
 */
export function classifyUrl(url: string): EdgarResourceKind | null {
  const { host, pathname } = new URL(url);

  if (host === 'data.sec.gov') {
    if (/^\/submissions\/CIK\d{10}\.json$/.test(pathname)) return 'submissions';
    if (/^\/submissions\/CIK\d{10}-submissions-\d{3}\.json$/.test(pathname)) {
      return 'submissions-overflow';
    }
    if (pathname.startsWith('/api/xbrl/companyfacts/')) return 'company-facts';
    if (pathname.startsWith('/api/xbrl/companyconcept/')) return 'company-concept';
    return null;
  }

  if (host !== 'www.sec.gov') return null;

  if (pathname === '/files/company_tickers.json') return 'ticker-map';
  if (pathname.startsWith('/Archives/edgar/daily-index/')) return 'daily-index';

  if (pathname.startsWith('/Archives/edgar/data/')) {
    return pathname.endsWith('/index.json') ? 'filing-index' : 'archive-document';
  }

  return null;
}

/** The accession embedded in an archive URL, or `null` for non-archive URLs. */
export function accessionFromUrl(url: string): string | null {
  const match = /\/Archives\/edgar\/data\/\d+\/(\d{18})(?:\/|$)/.exec(new URL(url).pathname);

  return match === null ? null : dashedAccession(match[1] as string);
}
