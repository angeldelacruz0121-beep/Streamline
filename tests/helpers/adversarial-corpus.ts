/**
 * Loader for QA Engineer's adversarial corpus (protocol §3: `fixtures/` and
 * `tests/` are QA Engineer's; `tests/infra/` is Software Architect's and is not
 * touched here).
 *
 * Every file under `fixtures/envelopes/` is the verbatim response of
 * `GET /api/edgar/company/:cik/segments` — the route that actually ships —
 * captured once by `fixtures/capture/capture.ts` and never edited. Decision 0010
 * is the reason: a fixture built from a guess validates the guess. These bytes
 * came off the wire through the proxy, so a test written against them is a test
 * against what a user will get.
 *
 * What this corpus can and cannot prove, stated plainly so no one over-reads it:
 * it is the *output* of the pipeline, so it proves what the product does, not
 * that the product is right. Proving a figure correct needs an independent read
 * of the filing, which is `fixtures/verified/` (increment A3, approved but not
 * yet built).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Repo root under both vitest environments — same hazard Software Architect documents in `tests/infra/company-fixtures.ts`. */
export function repoRoot(): string {
  try {
    return fileURLToPath(new URL('../../', import.meta.url));
  } catch {
    return `${process.cwd()}/`;
  }
}

const ENVELOPE_DIR = `${repoRoot()}fixtures/envelopes/`;

export interface ManifestRow {
  readonly slug: string;
  readonly ticker: string;
  readonly cik: string;
  /** Which standing-set case this filer was chosen to exercise. */
  readonly attacks: string;
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly envelopeKind: string | null;
  readonly viewKind: string | null;
}

export function readManifest(): readonly ManifestRow[] {
  return JSON.parse(readFileSync(`${ENVELOPE_DIR}MANIFEST.json`, 'utf8')) as ManifestRow[];
}

/** Raw bytes, exactly as the proxy sent them. */
export function readEnvelopeText(file: string): string {
  return readFileSync(`${ENVELOPE_DIR}${file}`, 'utf8');
}

/**
 * The parsed envelope, still `unknown`.
 *
 * Deliberately not typed as an envelope: handing back a validated-looking type
 * for an unvalidated object is the exact hole Invariant 4.3 closes, and the
 * whole point of this corpus is that some of these envelopes are shapes the
 * project did not plan for.
 */
export function readEnvelope(file: string): unknown {
  return JSON.parse(readEnvelopeText(file)) as unknown;
}

/** `view.kind` if the envelope carries a view, else null. Never throws. */
export function viewKindOf(envelope: unknown): string | null {
  if (typeof envelope !== 'object' || envelope === null) return null;
  const view = (envelope as { view?: unknown }).view;
  if (typeof view !== 'object' || view === null) return null;
  const kind = (view as { kind?: unknown }).kind;
  return typeof kind === 'string' ? kind : null;
}

/** `envelope.kind` — `view`, `incomplete-accession`, or a transport failure kind. */
export function envelopeKindOf(envelope: unknown): string | null {
  if (typeof envelope !== 'object' || envelope === null) return null;
  const kind = (envelope as { kind?: unknown }).kind;
  return typeof kind === 'string' ? kind : null;
}

/** The human-facing `detail` string on a refusal, wherever it sits. */
export function detailOf(envelope: unknown): string | null {
  if (typeof envelope !== 'object' || envelope === null) return null;
  const record = envelope as { detail?: unknown; view?: { detail?: unknown } };
  if (typeof record.view?.detail === 'string') return record.view.detail;
  if (typeof record.detail === 'string') return record.detail;
  return null;
}

/** Coverage band from Invariant §1 / D7. */
export function isInCoverageBand(sic: string): boolean {
  const code = Number(sic);
  return (code >= 3570 && code <= 3579) || (code >= 7370 && code <= 7379);
}
