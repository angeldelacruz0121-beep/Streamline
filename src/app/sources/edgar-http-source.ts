/**
 * The SEC path, as one implementation of `CompanySource`.
 *
 * This is the only file in the application that knows the segments route
 * exists, that its envelope has a `kind` discriminator, or that EDGAR has an
 * error taxonomy. Everything above it consumes `SourceResult`.
 *
 * THE BOUNDARY IS HERE, AND IT IS DELIBERATELY THE SECOND ONE. `server/proxy.ts`
 * already ran `companyBoundary.parse` before serialising, so re-checking on
 * receipt looks redundant. It is not. Invariant 4.3 says the renderer *cannot*
 * receive an unvalidated financial object, and "the server we happen to be
 * talking to validates" is a convention, not a guarantee — it does not survive a
 * stale bundle, a proxy in front of the proxy, a mock in a test, or source two.
 * The wire is where JSON enters this process, so the wire is where the check
 * belongs. `Validated<CompanyView>` is minted on line `boundary.check` and
 * nowhere else in this layer.
 *
 * No fallback, no repair, no partial acceptance: input that fails the schema
 * becomes an `invalid-payload` result carrying the issues, and the app renders
 * a data-quality surface. Coercing it would be inventing data (Invariant 4.5).
 */
import { companyBoundary } from '../../data/validate/company-schema.ts';
import type { EdgarFailure, EdgarProvenance } from '../../data/sec/errors.ts';
import type { Validated } from '../../types/brand';
import type { CompanyView } from '../../data/model/company.ts';
import type {
  CompanyRequest,
  CompanySource,
  SourceFailure,
  SourceFailureKind,
  SourceProvenance,
  SourceResult,
} from '../../types/source';

export const EDGAR_SOURCE_ID = 'sec-edgar';

/** EDGAR's own zero-padded form. `789019` and `0000789019` are one filer, one URL. */
export function padCik(cik: string): string {
  const digits = cik.trim().replace(/^0+/, '');

  return digits.padStart(10, '0');
}

export function segmentsPath(companyId: string): string {
  return `/api/edgar/company/${padCik(companyId)}/segments`;
}

/**
 * `EdgarProvenance` down to the source-neutral shape. Lossy by one field:
 * `resource` is an EDGAR enum and travels as an opaque string, because the app
 * must not branch on a source's internal vocabulary.
 */
export function toSourceProvenance(provenance: EdgarProvenance): SourceProvenance {
  return {
    sourceId: EDGAR_SOURCE_ID,
    url: provenance.url,
    resource: provenance.resource,
    retrievedAt: provenance.fetchedAt,
    fromCache: provenance.fromCache,
    expiresAt: provenance.expiresAt,
    documentId: provenance.accession,
    status: provenance.status,
  };
}

const FAILURE_KINDS: Readonly<Record<string, SourceFailureKind>> = {
  'not-found': 'not-found',
  'rate-limited': 'rate-limited',
  'transport-error': 'transport-error',
  'schema-mismatch': 'schema-mismatch',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * A non-2xx body, interpreted as an `EdgarFailure` where it is one.
 *
 * An error response that does not parse as the documented failure shape is
 * itself a `transport-error`: something answered on that URL and it was not the
 * proxy. Guessing at a friendlier reason would be inventing one.
 */
export function toSourceFailure(status: number, body: unknown): SourceFailure {
  if (isRecord(body) && typeof body['kind'] === 'string') {
    const mapped = FAILURE_KINDS[body['kind']];

    if (mapped !== undefined) {
      const failure = body as unknown as EdgarFailure;

      return {
        kind: mapped,
        detail: failure.detail,
        provenance: toSourceProvenance(failure.provenance),
        retryAfterMs:
          mapped === 'rate-limited' ? ((body['retryAfterMs'] as number | null) ?? null) : null,
        status,
      };
    }
  }

  return {
    kind: 'transport-error',
    detail: `The source answered ${String(status)} with a body this app does not recognise.`,
    provenance: null,
    retryAfterMs: null,
    status,
  };
}

export interface EdgarHttpSourceOptions {
  /** Overridable so tests can point at a local server without patching globals. */
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

/**
 * The single gate that mints `Validated<CompanyView>` in this layer.
 *
 * Exported because both the live source and any transport-swapped source
 * (`second-source.test.ts`) must pass through the same check — a source that
 * skipped it could hand the renderer an unvalidated object, and then the type
 * would be a lie.
 */
export function validateView(
  raw: unknown,
  provenance: SourceProvenance | null,
):
  | { readonly ok: true; readonly view: Validated<CompanyView> }
  | { readonly ok: false; readonly result: SourceResult } {
  const checked = companyBoundary.check(raw);

  if (checked.ok) {
    return { ok: true, view: checked.value as Validated<CompanyView> };
  }

  return {
    ok: false,
    result: {
      kind: 'invalid-payload',
      detail: 'The company object did not pass the pipeline boundary and was not rendered.',
      issues: checked.issues,
      provenance,
    },
  };
}

/**
 * Envelope -> `SourceResult`, without the network. Shared by the live source and
 * by every test that needs the decode without a socket.
 */
export function decodeSegmentsEnvelope(status: number, body: unknown): SourceResult {
  if (status < 200 || status >= 300) {
    return { kind: 'source-failure', failure: toSourceFailure(status, body) };
  }

  if (!isRecord(body)) {
    return {
      kind: 'source-failure',
      failure: {
        kind: 'schema-mismatch',
        detail: 'The source returned a 200 whose body was not an object.',
        provenance: null,
        retryAfterMs: null,
        status,
      },
    };
  }

  const rawProvenance = body['provenance'];
  const provenance =
    isRecord(rawProvenance) && typeof rawProvenance['url'] === 'string'
      ? toSourceProvenance(rawProvenance as unknown as EdgarProvenance)
      : null;

  if (body['kind'] === 'incomplete-accession') {
    const validated = validateView(body['view'], provenance);

    if (!validated.ok) return validated.result;

    return {
      kind: 'incomplete-accession',
      provenance,
      missing: Array.isArray(body['missing']) ? (body['missing'] as readonly string[]) : [],
      view: validated.view,
    };
  }

  if (body['kind'] === 'view') {
    const validated = validateView(body['view'], provenance);

    if (!validated.ok) return validated.result;

    return { kind: 'view', provenance, view: validated.view };
  }

  return {
    kind: 'source-failure',
    failure: {
      kind: 'schema-mismatch',
      detail: `The source returned a 200 with an envelope kind this app does not handle: ${String(body['kind'])}.`,
      provenance,
      retryAfterMs: null,
      status,
    },
  };
}

export function createEdgarHttpSource(options: EdgarHttpSourceOptions = {}): CompanySource {
  const baseUrl = options.baseUrl ?? '';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return {
    id: EDGAR_SOURCE_ID,
    label: 'SEC EDGAR',
    fetchCompanyView: async (
      request: CompanyRequest,
      signal?: AbortSignal,
    ): Promise<SourceResult> => {
      const url = `${baseUrl}${segmentsPath(request.companyId)}`;

      let response: Response;

      try {
        response = await fetchImpl(url, {
          headers: { accept: 'application/json' },
          ...(signal === undefined ? {} : { signal }),
        });
      } catch (cause) {
        const aborted = signal?.aborted === true;

        return {
          kind: 'source-failure',
          failure: {
            kind: aborted ? 'aborted' : 'transport-error',
            detail: aborted
              ? 'The request was superseded before it completed.'
              : `The request to the source did not complete: ${describe(cause)}`,
            provenance: null,
            retryAfterMs: null,
            status: null,
          },
        };
      }

      let body: unknown;

      try {
        body = await response.json();
      } catch {
        body = null;
      }

      return decodeSegmentsEnvelope(response.status, body);
    },
  };
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
