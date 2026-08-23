/**
 * Envelope schemas. Structure only - Conduit validates that a payload is shaped
 * like the EDGAR resource it claims to be, and stops there. No schema in this
 * file describes a financial fact, because what a number means is Ledger's
 * (Invariant 2.x), and duplicating that judgement here would create two places
 * for it to drift.
 *
 * Every object is `loose()`: EDGAR adds fields without notice, and rejecting a
 * payload for carrying more than we asked would be a self-inflicted outage.
 * Missing required fields still fail, and fail as a typed `schema-mismatch`.
 *
 * Validation runs through `defineBoundary`, so what leaves here is `Validated<T>` -
 * the same brand the renderer boundary uses (Invariant 4.3).
 */
import { z } from 'zod';
import { defineBoundary } from '../../types/boundary.ts';

/**
 * EDGAR's columnar filing table: parallel arrays, one index per filing.
 *
 * Column list observed live on `CIK0000789019.json` (2026-08-20): accessionNumber,
 * filingDate, reportDate, acceptanceDateTime, act, form, fileNumber, filmNumber,
 * items, core_type, size, isXBRL, isInlineXBRL, isXBRLNumeric, primaryDocument,
 * primaryDocDescription. The ones this layer reads are required; the rest are
 * declared optional so the schema records the real shape instead of implying
 * EDGAR sends only what we happened to ask for.
 */
const filingColumnsSchema = z
  .object({
    accessionNumber: z.array(z.string()),
    filingDate: z.array(z.string()),
    reportDate: z.array(z.string()),
    acceptanceDateTime: z.array(z.string()),
    form: z.array(z.string()),
    primaryDocument: z.array(z.string()),
    primaryDocDescription: z.array(z.string()).optional(),
    act: z.array(z.string()).optional(),
    fileNumber: z.array(z.string()).optional(),
    filmNumber: z.array(z.string()).optional(),
    core_type: z.array(z.string()).optional(),
    isXBRL: z.array(z.union([z.number(), z.string()])).optional(),
    isInlineXBRL: z.array(z.union([z.number(), z.string()])).optional(),
    // Nullable, and mostly null: 946 of 1001 rows on the live Microsoft index.
    isXBRLNumeric: z.array(z.union([z.number(), z.string()]).nullable()).optional(),
    items: z.array(z.string()).optional(),
    size: z.array(z.number()).optional(),
  })
  .loose();

const overflowFileSchema = z
  .object({
    name: z.string(),
    filingCount: z.number().optional(),
    filingFrom: z.string().optional(),
    filingTo: z.string().optional(),
  })
  .loose();

/**
 * The submissions index.
 *
 * The entity name here is `name`, **not** `entityName`. `entityName` is a real
 * EDGAR field but it belongs to companyfacts and companyconcept on
 * `data.sec.gov/api/xbrl/...`; the submissions document on
 * `data.sec.gov/submissions/...` does not carry it. Requiring `entityName` here
 * made every live submissions fetch fail as `schema-mismatch`, and the hand-authored
 * fixture hid it by repeating the same guess. The fixtures are now captured from
 * real responses for exactly that reason.
 *
 * Top-level keys observed live on `CIK0000789019.json` (2026-08-20): cik, entityType,
 * sic, sicDescription, ownerOrg, insiderTransactionForOwnerExists,
 * insiderTransactionForIssuerExists, name, tickers, exchanges, ein, lei, description,
 * website, investorWebsite, category, fiscalYearEnd, stateOfIncorporation,
 * stateOfIncorporationDescription, addresses, phone, flags, formerNames, filings.
 *
 * `cik` arrives here as a zero-padded string ("0000789019"); companyfacts and
 * companyconcept send the same identifier as a bare number. Hence the union.
 */
const submissionsSchema = z
  .object({
    cik: z.union([z.string(), z.number()]),
    name: z.string(),
    entityType: z.string().optional(),
    /**
     * Filer category, e.g. "Large accelerated filer". Present on the live
     * submissions document, and surfaced verbatim by the client - it is the input
     * a late-filing deadline depends on. Conduit passes it through; classifying a
     * filing as late is Ledger's (Invariant 2.5).
     */
    category: z.string().nullable().optional(),
    sic: z.string().optional(),
    sicDescription: z.string().optional(),
    tickers: z.array(z.string()).optional(),
    exchanges: z.array(z.string()).optional(),
    fiscalYearEnd: z.string().nullable().optional(),
    filings: z
      .object({
        recent: filingColumnsSchema,
        files: z.array(overflowFileSchema).optional(),
      })
      .loose(),
  })
  .loose();

/**
 * The archive directory listing for one accession.
 *
 * Keys are hyphenated: `parent-dir` and `last-modified`, not `parentDir` and
 * `lastModified`. The camelCase spelling was previously declared here, and being
 * optional it never failed - it simply never matched anything. Verified live on
 * `/Archives/edgar/data/789019/000119312526323660/index.json` (2026-08-20), which
 * also serves this JSON under `content-type: text/html`.
 */
const archiveIndexSchema = z
  .object({
    directory: z
      .object({
        name: z.string(),
        'parent-dir': z.string().optional(),
        item: z.array(
          z
            .object({
              name: z.string(),
              // Icon name, e.g. "text.gif" - not a form type. Nothing reads it.
              type: z.string().optional(),
              // A decimal string, and "" for the directory's own entries.
              size: z.union([z.number(), z.string()]).optional(),
              'last-modified': z.string().optional(),
            })
            .loose(),
        ),
      })
      .loose(),
  })
  .loose();

const tickerMapSchema = z.record(
  z.string(),
  z
    .object({
      cik_str: z.union([z.number(), z.string()]),
      ticker: z.string(),
      title: z.string(),
    })
    .loose(),
);

export type FilingColumns = z.infer<typeof filingColumnsSchema>;
export type SubmissionsIndex = z.infer<typeof submissionsSchema>;
export type ArchiveIndex = z.infer<typeof archiveIndexSchema>;
export type TickerMap = z.infer<typeof tickerMapSchema>;

export const submissionsBoundary = defineBoundary(submissionsSchema);
export const submissionsOverflowBoundary = defineBoundary(filingColumnsSchema);
export const archiveIndexBoundary = defineBoundary(archiveIndexSchema);
export const tickerMapBoundary = defineBoundary(tickerMapSchema);
