/**
 * The one arm that draws, and the last link in the vertical slice.
 *
 * fetch -> `CompanyView` -> `composeFromCompany` -> `CanvasModel` ->
 * `StreamlineCanvas`. This component owns exactly the middle step and nothing
 * else: it does not fetch, it does not validate, it does not encode, and it does
 * not draw. It composes once per view and hands the model over.
 *
 * `StreamlineCanvas` takes a `CanvasModel` and nothing else. That is Invariant
 * 4.3 held at the component boundary — there is no prop through which a
 * financial object, validated or otherwise, could reach a pixel.
 *
 * The composition is memoised on the view because `composeCanvas` is a pure
 * function of it, and recomposing on every render would put scale arithmetic on
 * the interaction path. Hover, selection and pan are the renderer's state and
 * are deliberately not lifted here (see `company-store.ts`).
 */
import { useMemo, type JSX } from 'react';
import { StreamlineCanvas } from '../../../viz/render';
import type { RenderableCompany } from '../../../data/model/company.ts';
import type { Validated } from '../../../types/brand';
import { composeFromCompany } from '../../../state/canvas-adapter';
import { EncodingBlockedSurface } from '../app-surfaces';
import { DataNotes, EntityHeading, FilingLine } from '../parts';

export interface RenderableSurfaceProps {
  readonly view: Validated<RenderableCompany>;
  readonly missing: readonly string[] | null;
}

export function RenderableSurface({ view, missing }: RenderableSurfaceProps): JSX.Element {
  const outcome = useMemo(() => composeFromCompany(view), [view]);

  return (
    <section data-surface="renderable" data-period={view.period.label}>
      <EntityHeading entity={view.entity} />
      <FilingLine filing={view.filing} />
      {missing === null || missing.length === 0 ? null : (
        <ul data-part="missing">
          {missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {/* Invariant 2.4 renders whether or not it passes, so the check travels
          with the picture rather than only appearing when it fails. */}
      <p
        data-part="reconciliation-status"
        data-within-tolerance={String(view.reconciliation.withinTolerance)}
      />
      <DataNotes notes={view.notes} />
      {outcome.kind === 'model' ? (
        <StreamlineCanvas model={outcome.model} />
      ) : (
        <EncodingBlockedSurface outcome={outcome} />
      )}
    </section>
  );
}
