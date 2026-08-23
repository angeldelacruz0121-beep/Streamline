/**
 * The adapter seam (Invariant 4.4), and the reason nothing in this file names EDGAR.
 *
 * A `CompanySource` answers one question — "what does this filer's segment
 * disclosure look like?" — and answers it with a `Validated<CompanyView>` or a
 * typed refusal. Nothing else. The store that consumes it, and every surface
 * downstream of the store, is therefore written against this interface rather
 * than against an HTTP route, a cache disposition, or an SEC error taxonomy.
 * Adding a second source is implementing this interface; it is not a change to
 * `src/state/`, `src/app/surfaces/` or `src/viz/`, and `second-source.test.ts`
 * is the standing proof of that.
 *
 * WHY `SourceProvenance` IS NOT `EdgarProvenance`. The obvious move is to
 * re-export Conduit's type and be done. It would also mean `src/types/` — the
 * contract every layer compiles against — importing from `src/data/sec/`, which
 * is exactly the coupling 4.4 exists to prevent: source two would arrive and
 * find the app's own vocabulary already spelled in source one's terms. So the
 * shape below is a source-neutral restatement, and the EDGAR adapter maps down
 * into it. The mapping is lossy by one field (`resource`, an EDGAR-specific
 * enum, is carried as an opaque string), and that loss is the price of the
 * seam.
 *
 * Nothing renders provenance in the vertical slice. It is carried anyway,
 * because Invariant 2.2 requires every rendered state to be able to name its
 * source, and a field that has to be threaded through later is a field that
 * gets dropped.
 */
import type { CompanyView } from '../data/model/company.ts';
import type { Validated, ValidationIssue } from './brand';

/** Which filer, in the vocabulary the app owns rather than the source's. */
export interface CompanyRequest {
  /** Zero-padded 10-digit CIK for the SEC path; an opaque source-scoped id in general. */
  readonly companyId: string;
}

/**
 * Where a value came from and how long it may be trusted, in source-neutral
 * terms. A structural subset of what any real source can report.
 */
export interface SourceProvenance {
  /** The `CompanySource.id` that produced it. */
  readonly sourceId: string;
  readonly url: string;
  /** The source's own name for the kind of resource read. Opaque to the app. */
  readonly resource: string;
  /** ISO instant the value was obtained, from network or cache. */
  readonly retrievedAt: string;
  readonly fromCache: boolean;
  /** ISO instant the cached copy goes stale; `null` means immutable. */
  readonly expiresAt: string | null;
  /** The source's identifier for the document read — an accession, for EDGAR. */
  readonly documentId: string | null;
  readonly status: number | null;
}

/**
 * Transport-level refusals only.
 *
 * Decision 0012 is the load-bearing distinction here: "this filer is out of
 * coverage" and "these revenues do not reconcile" are *not* failures. They
 * arrive as `CompanyView` arms on a successful result. A `SourceFailure` means
 * the source could not be reached or could not be understood — nothing was
 * learned about the filer at all.
 */
export type SourceFailureKind =
  'not-found' | 'rate-limited' | 'transport-error' | 'schema-mismatch' | 'aborted';

export interface SourceFailure {
  readonly kind: SourceFailureKind;
  readonly detail: string;
  readonly provenance: SourceProvenance | null;
  readonly retryAfterMs: number | null;
  readonly status: number | null;
}

/**
 * The company object was well-formed enough to arrive but did not pass the
 * pipeline boundary. Distinct from `source-failure`: the source answered, and
 * what it said was unusable. This is the state Invariant 4.3's runtime half
 * produces, and it is a rendered surface rather than a thrown error because a
 * schema drift between the app and its source is a data-quality finding.
 */
export interface InvalidPayload {
  readonly kind: 'invalid-payload';
  readonly detail: string;
  readonly issues: readonly ValidationIssue[];
  readonly provenance: SourceProvenance | null;
}

export type SourceResult =
  | {
      readonly kind: 'view';
      readonly provenance: SourceProvenance | null;
      readonly view: Validated<CompanyView>;
    }
  | {
      /**
       * The document exists but does not carry the artifacts a structured read
       * needs. Carries a view anyway — an inventory of what *was* found is a
       * renderable state, not an error.
       */
      readonly kind: 'incomplete-accession';
      readonly provenance: SourceProvenance | null;
      readonly missing: readonly string[];
      readonly view: Validated<CompanyView>;
    }
  | { readonly kind: 'source-failure'; readonly failure: SourceFailure }
  | InvalidPayload;

/**
 * One way of obtaining a company view. Implementations live in
 * `src/app/sources/`; the SEC path is one of them and holds no privileged
 * position in any type above.
 */
export interface CompanySource {
  /** Stable machine id, recorded on provenance. */
  readonly id: string;
  /** Human-readable name of the source. Surfaces may show it; nothing branches on it. */
  readonly label: string;
  readonly fetchCompanyView: (
    request: CompanyRequest,
    signal?: AbortSignal,
  ) => Promise<SourceResult>;
}
