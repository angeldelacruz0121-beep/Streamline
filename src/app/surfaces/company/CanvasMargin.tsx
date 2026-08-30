/**
 * The prose that used to be painted on the canvas.
 *
 * Four things moved off the picture and into this plate: the per-river disclosure sentence
 * (Invariant 3.2 / 3.8), the px/$ and px²/$ scale constants, the caption explaining why the
 * lake is stated separately from the trunk (0017 option 1), and the whole scene-notes stack,
 * whose `legibility` findings are multi-sentence paragraphs. None of it was deleted. All of
 * it reads better here: selectable, screen-readable, wrapped by the browser, and no longer
 * competing with the figures for the same band of pixels.
 *
 * WHAT DOES NOT MOVE. Everything Angel's product tests bind to the canvas stays on it — the
 * net earnings readout (0001 C2, "at all times, not revealed on hover"), the fiscal period
 * (0001 C3), and the dollar figure at every constriction (0002 C2, `annotationRequired`).
 * This plate is additive. It is not a route to a number that left the picture.
 *
 * REDUCED MOTION. The one substituted sentence — "all rivers are drawn at one baseline flow
 * speed" becomes "motion off" — is applied here now that the notes are DOM rather than
 * canvas. That makes Invariant 4.2 stronger, not weaker: the drawn text is now *identical*
 * between the two paths, and the substitution happens where a screen reader can reach it.
 * Subscribing to a media query is not an interaction, so local state is correct here and
 * Invariant 4.1's "never gated behind the render loop" is untouched — that rule governs the
 * pointer path, which stays entirely inside the renderer.
 *
 * COPY. Every string rendered below already existed in the model. The four section headings
 * are deliberately EMPTY: `voice.md` is unseeded, copy is Angel's under protocol §4, and no
 * agent may author wording. They collapse via `:empty` until he writes them — the same
 * pattern `[data-part='reconciliation-status']` already uses.
 */
import { useEffect, useState, type JSX } from 'react';
import { REDUCED_MOTION_NOTES, marginContent, watchReducedMotion } from '../../../viz/render';
import type { CanvasModel } from '../../../viz/encoding';
import { Figure, InstrumentLabel, Plate } from '../../../components/primitives';

export interface CanvasMarginProps {
  readonly model: CanvasModel;
  /** Test seam only. The application reads the media query. */
  readonly reducedMotion?: boolean;
}

export function CanvasMargin({ model, reducedMotion }: CanvasMarginProps): JSX.Element {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (reducedMotion !== undefined) return;
    const watcher = watchReducedMotion(setReduced);
    setReduced(watcher.matches);
    return watcher.dispose;
  }, [reducedMotion]);

  const motionOff = reducedMotion ?? reduced;
  const content = marginContent(model);

  return (
    <aside data-part="canvas-margin">
      <Plate>
        <section data-part="margin-section" data-section="notes">
          <h3 data-part="margin-heading" />
          <ul data-part="margin-list">
            {content.notes.map((note, index) => (
              // A note code is NOT unique. Autodesk emits ten `legibility/constriction-below-floor`
              // findings — one per constriction below the legibility floor — and keying on the code
              // alone made React drop rows, which would have silently swallowed exactly the findings
              // Invariant 3.9 exists to surface. The position disambiguates; `modelNotes` builds the
              // list in a fixed order from the model, so it is stable across renders.
              <li key={`${note.code}#${index}`} data-code={note.code}>
                {motionOff ? (REDUCED_MOTION_NOTES[note.code] ?? note.text) : note.text}
              </li>
            ))}
          </ul>
        </section>

        <section data-part="margin-section" data-section="disclosure">
          <h3 data-part="margin-heading" />
          <ul data-part="margin-list">
            {content.disclosures.map((river) => (
              <li key={river.id} data-river={river.id}>
                {/*
                  The segment's own name, carried so the sentence keeps the context it had on
                  the canvas. Painted beside its river, "this filer discloses 2 expense
                  categories for this segment" was unambiguous; listed three times in a column
                  it was three identical lines. The name is an existing string — the same one
                  the river head prints — so this labels the row without authoring any copy.
                */}
                <InstrumentLabel>{river.label}</InstrumentLabel>
                <span>{river.note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section data-part="margin-section" data-section="scale">
          <h3 data-part="margin-heading" />
          <ul data-part="margin-list">
            {content.scales.map((scale) => (
              <li key={scale.id} data-scale={scale.id}>
                <Figure>{scale.constant}</Figure>
              </li>
            ))}
          </ul>
        </section>

        <section data-part="margin-section" data-section="separation">
          <h3 data-part="margin-heading" />
          <p>{content.separation}</p>
        </section>
      </Plate>
    </aside>
  );
}
