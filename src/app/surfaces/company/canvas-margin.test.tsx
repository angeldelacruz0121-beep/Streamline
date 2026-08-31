/**
 * The margin plate — the other half of the text triage.
 *
 * Three render-layer tests now assert that a string is NOT painted on the canvas and point
 * here for where it went: `draw-scene.test.ts` (the notes stack and the separation caption),
 * `no-encoding-leak.test.ts` (the baseline-flow label Invariant 3.5 requires), and
 * `renderer.test.ts` (the px/$ constant). If this file stops asserting they arrive, those
 * absences become losses and nothing catches it. That pairing is the point of this suite.
 *
 * It also holds the second half of Invariant 4.2's proof. The reduced-motion substitution
 * used to happen at draw time and was asserted against the canvas; it happens here now.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { companyBoundary } from '../../../data/validate/company-schema.ts';
import { composeFromCompany } from '../../../state/canvas-adapter';
import { readFixtureView } from '../../../../tests/infra/company-fixtures';
import { COPY, marginContent } from '../../../viz/render';
import { CanvasMargin } from './CanvasMargin';

const parsed = companyBoundary.parse(readFixtureView('msft'));
if (parsed.kind !== 'renderable') throw new Error('captured Microsoft view is not renderable');
const outcome = composeFromCompany(parsed);
if (outcome.kind !== 'model') throw new Error('captured Microsoft view does not compose');
const model = outcome.model;

describe('the canvas margin — where the prose went', () => {
  it('renders the notes stack the canvas stopped drawing', () => {
    render(<CanvasMargin model={model} />);
    expect(screen.getByText('FY2026')).toBeDefined();
    // Invariant 3.5. `no-encoding-leak.test.ts` asserts this is absent from the canvas.
    expect(screen.getByText(COPY.baselineFlow)).toBeDefined();
  });

  it('renders one disclosure sentence per river — Invariant 3.2 / 3.8', () => {
    render(<CanvasMargin model={model} />);
    const notes = screen.getAllByText(/expense categor/);
    expect(notes).toHaveLength(model.rivers.length);
  });

  it('renders the scale constants — the reference half of Invariant 3.3', () => {
    render(<CanvasMargin model={model} />);
    // `renderer.test.ts` asserts this string is no longer painted on the canvas.
    expect(screen.getByText('1 px = $1,000,000,000')).toBeDefined();
  });

  it('renders the separation caption — 0017 option 1, in words', () => {
    render(<CanvasMargin model={model} />);
    // `draw-scene.test.ts` and `junction.test.ts` assert the canvas no longer says this.
    expect(screen.getByText(COPY.separationRule)).toBeDefined();
  });

  it('substitutes the motion note under reduced motion, and changes nothing else', () => {
    // Invariant 4.2's "identical information content", now proved on this side. The canvas
    // is byte-identical between the two paths (`reduced-motion.test.ts`); the one sentence
    // that must not claim to be flowing is swapped here, where it is selectable and can be
    // read aloud.
    const moving = render(<CanvasMargin model={model} reducedMotion={false} />);
    const movingText = moving.container.textContent ?? '';
    moving.unmount();

    const still = render(<CanvasMargin model={model} reducedMotion />);
    const stillText = still.container.textContent ?? '';

    expect(movingText).toContain(COPY.baselineFlow);
    expect(movingText).not.toContain(COPY.reducedMotion);
    expect(stillText).toContain(COPY.reducedMotion);
    expect(stillText).not.toContain(COPY.baselineFlow);
    // Nothing else moved: swapping the one note is the only difference between the two.
    expect(stillText.replace(COPY.reducedMotion, COPY.baselineFlow)).toBe(movingText);
  });

  it('leaves every heading empty — copy is Angel’s and voice.md is unseeded', () => {
    // Protocol §4: no agent authors wording. The slots exist, collapse via `:empty`, and
    // are filled without touching this component. A heading with text here would be an
    // agent inventing voice.
    const { container } = render(<CanvasMargin model={model} />);
    const headings = container.querySelectorAll('[data-part="margin-heading"]');
    expect(headings.length).toBe(4);
    for (const heading of headings) expect(heading.textContent).toBe('');
  });

  it('renders exactly as many notes as the model produced', () => {
    // The guard on a bug the live app found and the fixtures cannot: a note CODE is not
    // unique. Autodesk trips the legibility floor on all ten of its constrictions and emits
    // ten notes coded `legibility/constriction-below-floor`; keying the list on the code made
    // React drop nine of them, silently discarding the findings Invariant 3.9 exists to
    // surface. The key is now code-plus-position.
    //
    // Microsoft produces no repeated code, so this asserts the general property rather than
    // that specific case. The specific case CANNOT be fixture-tested today: every envelope in
    // QA's adversarial corpus is stale against the current pipeline — all nineteen, not the
    // fifteen STATUS.md records — and Autodesk's now composes to `blocked`. When the corpus is
    // recaptured (STATUS.md, open hand-off 1), replace this with the Autodesk case.
    const expected = marginContent(model).notes;
    const { container } = render(<CanvasMargin model={model} />);
    expect(container.querySelectorAll('[data-section="notes"] li').length).toBe(expected.length);
  });

  it('carries no provenance into the DOM — Invariant 4.3', () => {
    // `CanvasModel` had provenance stripped by `canvas-adapter.ts` before it reached here.
    // This is the assertion that the margin did not re-introduce any of it.
    const { container } = render(<CanvasMargin model={model} />);
    const text = container.textContent ?? '';
    for (const forbidden of ['0000789019', 'accession', 'us-gaap', '10-K']) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });
});
