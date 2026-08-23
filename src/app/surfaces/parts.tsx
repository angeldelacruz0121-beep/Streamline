/**
 * Shared structural fragments. Structure only.
 *
 * There is no `DESIGN.md` and Atelier has not run, so nothing here sets colour,
 * type, spacing or layout, and no string in this directory is product copy that
 * did not come from the data. Where a bare UI word is unavoidable it is marked
 * ATELIER-REPLACE and is the most neutral term available — not a voice.
 *
 * Every surface carries `data-surface`, which is how tests address a state
 * without depending on wording that is going to change.
 */
import type { JSX } from 'react';
import type { DataNote, Entity, FilingRef } from '../../data/model/company.ts';

export function EntityHeading({ entity }: { readonly entity: Entity }): JSX.Element {
  return (
    <header data-part="entity">
      <h1>{entity.name}</h1>
      <dl>
        <dt>CIK</dt>
        <dd>{entity.cik}</dd>
        {entity.sic === null ? null : (
          <>
            <dt>SIC</dt>
            <dd>
              {entity.sic}
              {entity.sicDescription === null ? null : ` — ${entity.sicDescription}`}
            </dd>
          </>
        )}
      </dl>
    </header>
  );
}

export function FilingLine({ filing }: { readonly filing: FilingRef | null }): JSX.Element | null {
  if (filing === null) return null;

  return (
    <dl data-part="filing">
      <dt>Form</dt>
      <dd>{filing.form}</dd>
      <dt>Accession</dt>
      <dd>{filing.accession}</dd>
      <dt>Filed</dt>
      <dd>{filing.filedAt}</dd>
      <dt>Period of report</dt>
      <dd>{filing.periodOfReport}</dd>
    </dl>
  );
}

/**
 * Ledger's notes, rendered verbatim. A note is something true about this data
 * that a reader must be told (Invariant 2.4); it is never a log line and is
 * never filtered by severity here.
 */
export function DataNotes({ notes }: { readonly notes: readonly DataNote[] }): JSX.Element | null {
  if (notes.length === 0) return null;

  return (
    <ul data-part="notes">
      {notes.map((note) => (
        <li key={note.code} data-severity={note.severity} data-code={note.code}>
          {note.message}
        </li>
      ))}
    </ul>
  );
}

/** A source's own explanation of itself, rendered as given. Never paraphrased. */
export function Detail({ children }: { readonly children: string }): JSX.Element {
  return <p data-part="detail">{children}</p>;
}
