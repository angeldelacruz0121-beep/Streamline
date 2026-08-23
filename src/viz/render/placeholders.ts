/**
 * Canvas tokens, adopted. Until 2026-08-21 this file held placeholder values marked
 * ATELIER-REPLACE; the Art Director shipped `src/design/tokens/canvas-tokens.ts` shaped
 * to the render layer's declared interfaces, and the swap below is the adoption, routed
 * through Angel. This module stays the render layer's single import point so a value
 * cannot fork between layers and the provenance change is one line here rather than a
 * rewrite of every draw file.
 *
 * The split of authority is unchanged from the placeholder era: the renderer owns that
 * a cue exists, that it is not carried by length, and that no spacing value varies with
 * a financial quantity; Atelier owns what everything looks like. `no-encoding-leak.test.ts`
 * asserts the structural rules against the adopted values exactly as it did against the
 * placeholders — one shared river fill, saturation within the ruled bound, spacing as
 * constants.
 *
 * Deliberate value changes carried by this adoption, all grid alignment:
 * laneGapPx 18 -> 16, annotationOffsetPx 14 -> 12, trunk rimGapPx 3 -> 4.
 */
export {
  CONSTRICTION_CUES,
  JUNCTION_SEPARATION_PX,
  SPACING,
  TONES,
  TYPE,
  css,
  type ConstrictionCue,
  type Tone,
} from '../../design/tokens/canvas-tokens';

/**
 * ANGEL-COPY. Placeholder wording only; final copy is Angel's under protocol §3, the
 * same way `composeTrunk` takes its label as an input rather than defaulting one.
 */
export const COPY = {
  separationRule:
    'The lake is stated separately. River width is dollars per pixel; lake area is ' +
    'dollars per square pixel. The two do not convert, so this picture does not draw ' +
    'a channel between them.',
  baselineFlow: 'All rivers are drawn at one baseline flow speed. Speed varies with nothing here.',
  reducedMotion: 'Motion off. Same figures, same geometry.',
  moreControl: (n: number): string => `${n} more segments, combined`,
  disclosure: (n: number): string =>
    n === 0
      ? 'This filer discloses no segment expense categories.'
      : `This filer discloses ${n} expense ${n === 1 ? 'category' : 'categories'} for this segment.`,
} as const;
