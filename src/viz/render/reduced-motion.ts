/**
 * `prefers-reduced-motion`. Invariant 4.2: "a fully static, fully accurate rendering with
 * identical information content. An equivalent, not a lesser version."
 *
 * So the reduced-motion path is not a degradation rung and does not touch the ladder. It
 * renders the SAME scene — same layout, same geometry, same particle count at full
 * density, same annotations, same legend, same notes — exactly once, and then stops the
 * clock. The only difference is that the particle field is frozen at its seeded initial
 * state and one note's wording changes, because a still picture must not claim to be
 * flowing.
 *
 * `reduced-motion.test.ts` proves the equivalence the hard way: it records every draw call
 * from both paths and asserts the geometry calls are identical and the text set differs by
 * exactly the one substituted note.
 */
import { COPY } from './placeholders';

/**
 * Note-text substitutions applied at draw time only. Not a layout input — `Scene` is
 * byte-identical between the two paths, which is what keeps 4.2's "identical information
 * content" checkable rather than asserted.
 */
export const REDUCED_MOTION_NOTES: Readonly<Record<string, string>> = {
  'baseline-flow': COPY.reducedMotion,
};

/**
 * Safe in every environment: `matchMedia` is absent under Node and present-but-inert in
 * some embeddings. A missing API means "no stated preference", which is not the same as
 * "prefers motion", so the default is to animate — the same default a browser applies.
 */
export function prefersReducedMotion(): boolean {
  if (typeof globalThis.matchMedia !== 'function') return false;
  try {
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export interface ReducedMotionWatcher {
  readonly matches: boolean;
  readonly dispose: () => void;
}

/** Subscribes to changes so toggling the OS setting does not require a reload. */
export function watchReducedMotion(onChange: (reduced: boolean) => void): ReducedMotionWatcher {
  if (typeof globalThis.matchMedia !== 'function') {
    return { matches: false, dispose: () => {} };
  }
  const query = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  const listener = (event: MediaQueryListEvent): void => {
    onChange(event.matches);
  };
  query.addEventListener('change', listener);
  return {
    matches: query.matches,
    dispose: () => {
      query.removeEventListener('change', listener);
    },
  };
}
