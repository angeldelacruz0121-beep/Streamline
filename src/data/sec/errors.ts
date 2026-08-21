/**
 * Typed transport outcomes handed to Ledger.
 *
 * Every EDGAR reality this layer can observe - an absent filing, an accession
 * whose XBRL exhibit is incomplete, a throttled request, a payload whose
 * envelope does not match the documented shape - leaves this module as a named
 * variant carrying provenance. Nothing degrades to an empty array or a null,
 * because a silent gap downstream is indistinguishable from "the filer reported
 * nothing", and those are different facts (Invariant 2.2).
 *
 * Conduit owns the envelope, never the number. `ok` payloads for the financial
 * endpoints are returned unparsed for Ledger's own boundary.
 */
import type { ValidationIssue } from '../../types/brand.ts';

/** Which EDGAR resource produced a result. Mirrors the map in `ENDPOINTS.md`. */
export type EdgarResourceKind =
  | 'ticker-map'
  | 'submissions'
  | 'submissions-overflow'
  | 'company-facts'
  | 'company-concept'
  | 'filing-index'
  | 'archive-document'
  | 'daily-index';

/**
 * Where a value came from and how long it may be trusted. Attached to every
 * result, success or failure, so a data-quality state can name its own source.
 */
export interface EdgarProvenance {
  readonly url: string;
  readonly resource: EdgarResourceKind;
  /** ISO instant the value was obtained, whether from the network or the cache. */
  readonly fetchedAt: string;
  readonly fromCache: boolean;
  /** ISO instant the cached copy goes stale; `null` means immutable-once-accessioned. */
  readonly expiresAt: string | null;
  /** Accession this belongs to, when the resource is filing-scoped. */
  readonly accession: string | null;
  /** Final HTTP status observed, or `null` if the request never reached the wire. */
  readonly status: number | null;
}

/** The requested resource does not exist at EDGAR. A real state, not an error. */
export interface EdgarNotFound {
  readonly kind: 'not-found';
  readonly provenance: EdgarProvenance;
  readonly detail: string;
}

/**
 * The accession exists but does not carry the XBRL artifacts a structured read
 * needs. Common for pre-2009 filings, paper submissions and amendments filed
 * without a re-tagged exhibit.
 */
export interface EdgarIncompleteXbrl<T> {
  readonly kind: 'incomplete-xbrl';
  readonly provenance: EdgarProvenance;
  /** What was retrieved anyway - an inventory is still useful to Ledger. */
  readonly value: T;
  readonly missing: readonly string[];
  readonly available: readonly string[];
  readonly detail: string;
}

/** EDGAR throttled us and the retry budget was exhausted. */
export interface EdgarRateLimited {
  readonly kind: 'rate-limited';
  readonly provenance: EdgarProvenance;
  readonly attempts: number;
  readonly retryAfterMs: number | null;
  readonly detail: string;
}

/** The request failed at the transport level, or EDGAR returned an unusable status. */
export interface EdgarTransportError {
  readonly kind: 'transport-error';
  readonly provenance: EdgarProvenance;
  readonly attempts: number;
  readonly detail: string;
}

/** The payload parsed as JSON but did not match the documented envelope. */
export interface EdgarSchemaMismatch {
  readonly kind: 'schema-mismatch';
  readonly provenance: EdgarProvenance;
  readonly issues: readonly ValidationIssue[];
  readonly detail: string;
}

/** A successful retrieval. */
export interface EdgarOk<T> {
  readonly kind: 'ok';
  readonly provenance: EdgarProvenance;
  readonly value: T;
}

/**
 * The variants that carry no value. Every method that cannot produce a partial
 * result returns `EdgarOk<T> | EdgarFailure`, which is a subtype of
 * `EdgarResult<T>` - narrower where the narrowness is real.
 */
export type EdgarFailure =
  EdgarNotFound | EdgarRateLimited | EdgarTransportError | EdgarSchemaMismatch;

export type EdgarResult<T> =
  | EdgarOk<T>
  | EdgarNotFound
  | EdgarIncompleteXbrl<T>
  | EdgarRateLimited
  | EdgarTransportError
  | EdgarSchemaMismatch;

/** Narrowing helper - `true` only for a clean retrieval. */
export function isOk<T>(result: EdgarResult<T>): result is EdgarOk<T> {
  return result.kind === 'ok';
}

/**
 * `true` when a value is present even though the result is not clean, which is
 * the case for `incomplete-xbrl`. Callers that can work with a partial
 * inventory use this; callers that cannot use `isOk`.
 */
export function hasValue<T>(result: EdgarResult<T>): result is EdgarOk<T> | EdgarIncompleteXbrl<T> {
  return result.kind === 'ok' || result.kind === 'incomplete-xbrl';
}

/** One-line human-readable summary, for logs and data-quality surfaces. */
export function describeResult<T>(result: EdgarResult<T>): string {
  if (result.kind === 'ok') {
    return `ok ${result.provenance.resource} ${result.provenance.url}`;
  }

  return `${result.kind} ${result.provenance.resource} ${result.provenance.url}: ${result.detail}`;
}
