/**
 * The four app-level surfaces plus the encoding refusal. Structure only.
 *
 * These are the states that are *not* about a filer: nothing chosen, a request
 * in flight, the source unreachable, the payload rejected at the boundary, and
 * the encoding declining to draw. Everything about a filer — including every
 * refusal to draw one — is a `CompanyView` arm and lives in `./company`.
 */
import type { JSX } from 'react';
import type { ValidationIssue } from '../../types/brand';
import type { SourceFailure } from '../../types/source';
import type { CanvasOutcome } from '../../state/canvas-adapter';
import { Detail } from './parts';

/**
 * Nothing chosen.
 *
 * DELIBERATELY EMPTY. The first-run experience is open question Q3 and is
 * unwritten — Advocate refused to specify it while D10 and D12 are open
 * (docs/decisions/0019). What belongs here is a company-selection affordance, a
 * statement of what the product covers and does not, and the scale legend a
 * first-time viewer meets before any filer loads. None of it is invented here.
 * This is a mount point with a stable address, not a design.
 */
export function IdleSurface(): JSX.Element {
  return <section data-surface="idle" aria-label="Streamline" />;
}

export function LoadingSurface({ companyId }: { readonly companyId: string }): JSX.Element {
  return (
    <section data-surface="loading" data-company={companyId} aria-busy="true">
      {/* ATELIER-REPLACE: bare state word, not a voice. */}
      <p role="status">Loading</p>
    </section>
  );
}

/**
 * The source could not be reached or could not be understood.
 *
 * This is the only genuine error surface in the app. It is reached for
 * transport failures and nothing else: a 200 carrying `out-of-coverage` never
 * arrives here, because being out of coverage is a fact about a filer rather
 * than a failure of the software (decision 0012).
 */
export function SourceFailureSurface({
  companyId,
  failure,
}: {
  readonly companyId: string;
  readonly failure: SourceFailure;
}): JSX.Element {
  return (
    <section data-surface="source-failure" data-company={companyId} data-failure={failure.kind}>
      <Detail>{failure.detail}</Detail>
      {failure.provenance === null ? null : <p data-part="provenance">{failure.provenance.url}</p>}
    </section>
  );
}

/**
 * The data-quality surface. Invariant 4.3's runtime half, made visible.
 *
 * Reaching this means the source answered and its company object did not pass
 * `companyBoundary`. The issues are listed with their paths because a schema
 * drift is diagnosable and hiding it behind "something went wrong" throws away
 * the only useful thing the failure produced.
 */
export function InvalidPayloadSurface({
  companyId,
  detail,
  issues,
}: {
  readonly companyId: string;
  readonly detail: string;
  readonly issues: readonly ValidationIssue[];
}): JSX.Element {
  return (
    <section data-surface="invalid-payload" data-company={companyId}>
      <Detail>{detail}</Detail>
      <ul data-part="issues">
        {issues.map((issue) => (
          <li key={`${issue.path.join('.')}:${issue.message}`}>
            <code>{issue.path.length === 0 ? '<root>' : issue.path.join('.')}</code>
            {`: ${issue.message}`}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The encoding declined, or threw.
 *
 * `blocked` is the designed path: `composeCanvas` refuses rather than
 * approximates, and each reason names its subject, its amount and the open
 * decision it should be escalated against. `threw` is the undesigned path and
 * exists because a non-total function's caller has to have somewhere to put the
 * result — it is a defect made visible rather than a white screen.
 */
export function EncodingBlockedSurface({
  outcome,
}: {
  readonly outcome: Extract<CanvasOutcome, { kind: 'blocked' | 'refused' | 'threw' }>;
}): JSX.Element {
  return (
    <section data-surface="encoding-blocked" data-outcome={outcome.kind}>
      {outcome.kind === 'blocked' ? (
        <ul data-part="reasons">
          {outcome.reasons.map((reason) => (
            <li key={`${reason.code}:${reason.subject}`} data-code={reason.code}>
              {reason.message}
              {reason.escalation === null ? null : (
                <span data-part="escalation">{reason.escalation}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Detail>{outcome.detail}</Detail>
      )}
    </section>
  );
}
