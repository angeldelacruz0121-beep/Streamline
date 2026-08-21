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

/** EDGAR's columnar filing table: parallel arrays, one index per filing. */
const filingColumnsSchema = z
  .object({
    accessionNumber: z.array(z.string()),
    filingDate: z.array(z.string()),
    reportDate: z.array(z.string()),
    acceptanceDateTime: z.array(z.string()),
    form: z.array(z.string()),
    primaryDocument: z.array(z.string()),
    primaryDocDescription: z.array(z.string()).optional(),
    isXBRL: z.array(z.union([z.number(), z.string()])).optional(),
    isInlineXBRL: z.array(z.union([z.number(), z.string()])).optional(),
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

const submissionsSchema = z
  .object({
    cik: z.union([z.string(), z.number()]),
    entityName: z.string(),
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

const archiveIndexSchema = z
  .object({
    directory: z
      .object({
        name: z.string(),
        parentDir: z.string().optional(),
        item: z.array(
          z
            .object({
              name: z.string(),
              type: z.string().optional(),
              size: z.union([z.number(), z.string()]).optional(),
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
