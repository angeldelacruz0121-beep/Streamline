/**
 * The six-arm switch, and the reason it is the architectural centre of the app.
 *
 * Decision 0012 (Ledger A1): every arm of `CompanyView` is a designed UI state.
 * A 200 carrying `out-of-coverage` is Exxon Mobil being a petroleum refiner,
 * which is a true and useful thing to say — it is not a crash, not an error
 * boundary, and not a generic failure page. The same holds for a reconciliation
 * break, an unresolved segment identity, an incomplete filing and a filing with
 * no segment axis at all.
 *
 * `assertNever` in the default branch is what makes that survivable. Add a
 * seventh arm to `CompanyView` and this file stops compiling on the line that
 * forgot it, so the seventh arm cannot quietly fall through to whichever branch
 * happened to be last. That is the difference between exhaustive handling and
 * remembering to handle things.
 */
import type { JSX } from 'react';
import type { CompanyView } from '../../../data/model/company.ts';
import type { Validated } from '../../../types/brand';
import { assertNever } from '../../../types/exhaustive';
import { Detail, DataNotes, EntityHeading, FilingLine } from '../parts';
import { RenderableSurface } from './RenderableSurface';

export interface CompanySurfaceProps {
  readonly view: Validated<CompanyView>;
  /** Artifacts the document did not carry, when the read was incomplete. */
  readonly missing: readonly string[] | null;
}

export function CompanySurface({ view, missing }: CompanySurfaceProps): JSX.Element {
  switch (view.kind) {
    case 'renderable':
      return <RenderableSurface view={view} missing={missing} />;

    case 'out-of-coverage':
      return (
        <section data-surface="out-of-coverage">
          <EntityHeading entity={view.entity} />
          <Detail>{view.detail}</Detail>
          <ul data-part="ranges">
            {view.ranges.map((range) => (
              <li key={`${String(range[0])}-${String(range[1])}`}>
                {`${String(range[0])}–${String(range[1])}`}
              </li>
            ))}
          </ul>
        </section>
      );

    case 'segment-identity-unresolved':
      return (
        <section data-surface="segment-identity-unresolved">
          <EntityHeading entity={view.entity} />
          <FilingLine filing={view.filing} />
          <Detail>{view.detail}</Detail>
          <ul data-part="enumerated-members">
            {view.enumeratedMembers.map((member) => (
              <li key={member}>{member}</li>
            ))}
          </ul>
          <p data-part="reported-count">
            {view.reportedSegmentCount === null ? '' : String(view.reportedSegmentCount)}
          </p>
          <DataNotes notes={view.notes} />
        </section>
      );

    case 'reconciliation-break':
      return (
        <section data-surface="reconciliation-break">
          <EntityHeading entity={view.entity} />
          <FilingLine filing={view.filing} />
          <Detail>{view.detail}</Detail>
          {/* Invariant 2.4: the discrepancy is rendered with its figures, never
              as a bare message. Formatting is Forge's `format.ts` once Atelier
              has set the type; the raw values are shown until then. */}
          <dl data-part="reconciliation">
            <dt>Segment revenue total</dt>
            <dd>{String(view.reconciliation.segmentRevenueTotal.value)}</dd>
            <dt>Consolidated revenue</dt>
            <dd>{String(view.reconciliation.consolidatedRevenue.value)}</dd>
            <dt>Difference</dt>
            <dd>{String(view.reconciliation.difference.value)}</dd>
            <dt>Tolerance</dt>
            <dd>{String(view.reconciliation.tolerance)}</dd>
          </dl>
          <DataNotes notes={view.notes} />
        </section>
      );

    case 'incomplete-filing':
      return (
        <section data-surface="incomplete-filing">
          <EntityHeading entity={view.entity} />
          <FilingLine filing={view.filing} />
          <Detail>{view.detail}</Detail>
          <ul data-part="missing">
            {view.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      );

    case 'no-segment-disclosure':
      return (
        <section data-surface="no-segment-disclosure">
          <EntityHeading entity={view.entity} />
          <FilingLine filing={view.filing} />
          <Detail>{view.detail}</Detail>
        </section>
      );

    default:
      return assertNever(view, 'CompanyView arm');
  }
}
