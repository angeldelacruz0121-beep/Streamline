/**
 * Canvas tokens — the Atelier half of the ATELIER-REPLACE contract in
 * `src/viz/render/` and `src/viz/particles/`. Forge adopts this module by
 * import swap in its own files; nothing here draws, and nothing here may vary
 * with a financial quantity.
 *
 * Shapes mirror Forge's placeholder declarations exactly, with one ruled
 * change: Angel resolved the R=G=B conflict on 2026-08-21 in favour of the
 * measured water ramp, so `Tone` carries rgb rather than a single achromatic
 * level. The widened renderer contract is: ONE SHARED FILL for every river,
 * saturation <= 10% (HSV, the metric the photographic references were measured
 * in), ZERO per-segment variation. `canvas-tokens.test.ts` asserts the
 * saturation bound and that `--accent` is unreachable from every export here.
 *
 * Structural rules that are Forge's, not restated as values here:
 * - `CONSTRICTION_SPAN_PX = 24` in `viz/encoding/types.ts` is RATIFIED at 24
 *   (it is exactly --space-5). The value stays in Cartographer's file; two
 *   sources of truth would be worse than one ratified constant.
 * - `rimCount` in a constriction cue is the 0002 C4 kind-distinction and is
 *   semantic, not appearance. It ships unchanged.
 * - Usage note for `textDim`: bed and raised plates only. Over `water` it
 *   composites below AA; figures over water use `text` (contrast.test.ts).
 */
import { hill, ink, mist, sky, surface, terrain, water } from './tokens';
import type { Rgb } from './tokens';

/** An sRGB colour with alpha, rendered by `css()`. Replaces `Achromatic`. */
export interface Tone {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

export function css(tone: Tone): string {
  return `rgba(${tone.r}, ${tone.g}, ${tone.b}, ${tone.alpha})`;
}

const tone = (c: Rgb, alpha: number): Tone => ({ r: c.r, g: c.g, b: c.b, alpha });

/**
 * Same keys as the placeholder `TONES`. The ramp mapping, so the tuning
 * session has its reasoning in front of it:
 *
 * - the water body is `--water-mid`, opaque — the P50 band is the median of
 *   real water, and opacity keeps overlaps at the confluence from double-
 *   darkening into a false depth channel;
 * - banks and the basin hatch are `--water-shallow`;
 * - particles, rims and the lake edge are `--water-specular` — the "small
 *   minority of near-white specular pixels" the measurements require;
 * - the basin floor is `--water-deep`, the P05 band: still depth under the lake;
 * - the bed is `--surface-sunken`; text is ink over the bed.
 */
export const TONES = {
  canvas: tone(surface.sunken, 1),
  /** The single fill shared by every river. Not per-segment, deliberately. */
  water: tone(water.mid, 1),
  /**
   * The water gradient's edge stop (0037): bank sheen, opaque so confluence
   * overlaps cannot double-darken into a false depth channel. Same shared
   * treatment for every flow; the gradient's stop list is a constant.
   */
  waterEdgeSheen: tone(water.shallow, 1),
  waterEdge: tone(water.shallow, 0.9),
  particle: tone(water.specular, 0.55),
  constrictionRim: tone(water.specular, 0.8),
  lakeFill: tone(water.mid, 1),
  lakeEdge: tone(water.specular, 0.75),
  basinFloor: tone(water.deep, 1),
  basinHatch: tone(water.shallow, 0.7),
  text: tone(ink.primary, 1),
  textDim: tone(ink.primary, ink.tertiary.alpha),
  rule: tone(ink.primary, surface.rule.alpha),
} as const satisfies Record<string, Tone>;

/**
 * Canvas type. Same keys as the placeholder `TYPE`. Figures are IBM Plex Mono
 * — a monospaced face is tabular by construction, which is what carries the
 * 0001 C2 no-jitter requirement onto a canvas, where `ctx.font` cannot express
 * `font-variant-numeric`. Sizes are the --text-label and --text-micro steps.
 */
export const TYPE = {
  figure: `500 13px 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Monaco, monospace`,
  label: `500 11px 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`,
  note: `400 11px 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`,
} as const;

/**
 * Layout spacing. Same keys as the placeholder `SPACING`; every value on the
 * 4px grid. Two nudges from the placeholders, both grid alignment: laneGapPx
 * 18 -> 16 (--space-4) and annotationOffsetPx 14 -> 12 (--space-3). None of
 * these may vary with a financial quantity (`no-encoding-leak.test.ts`).
 */
export const SPACING = {
  laneGapPx: 16,
  headRunPx: 96,
  betweenConstrictionsPx: 56,
  mouthRunPx: 48,
  confluenceRunPx: 140,
  trunkHeadRunPx: 56,
  trunkTailRunPx: 72,
  marginPx: 40,
  legendHeightPx: 96,
  annotationOffsetPx: 12,
  /**
   * The world's sky band above the content top (decision 0038). Scenery only:
   * the layout offsets all content below it, and the world generator clamps
   * hills and mist inside it, so no text can ever sit on the sky.
   */
  skyBandPx: 96,
} as const;

/** Same shape as the placeholder `ConstrictionCue`. */
export interface ConstrictionCue {
  readonly rimCount: 1 | 2;
  readonly rimGapPx: number;
  readonly rimWidthPx: number;
  readonly throatTicks: boolean;
}

/**
 * `rimCount` and `throatTicks` are the 0002 C4 kind cues and ship unchanged.
 * Appearance: rims at the hairline width (--border-hair); the trunk's rim gap
 * moves 3 -> 4 (--space-1) for grid discipline. Span uniformity is untouched.
 */
export const CONSTRICTION_CUES = {
  'segment-cost': { rimCount: 1, rimGapPx: 0, rimWidthPx: 1, throatTicks: false },
  'trunk-residual': { rimCount: 2, rimGapPx: 4, rimWidthPx: 1, throatTicks: true },
} as const satisfies Record<string, ConstrictionCue>;

/**
 * Flow-axis distance between the trunk terminus and the lake region. A
 * CONSTANT — it varies with nothing (`junction.test.ts`). Unchanged at 132
 * (on the 4px grid); the rule's *presence* is Angel's answered Q1 decision.
 */
export const JUNCTION_SEPARATION_PX = 132;

/**
 * The world's tones (decision 0038) — scenery, never data. Kept OUT of `TONES`
 * deliberately: `canvas-tokens.test.ts` polices TONES with the water-only hue
 * guard, and these carry their own family bounds in the WORLD_TONES describe.
 * Angel's governing clause binds every value here: if a tone ever fights
 * legibility or determinism, the dressing loses.
 */
export const WORLD_TONES = {
  skyZenith: tone(sky.zenith, 1),
  skyMid: tone(sky.mid, 1),
  skyGlow: tone(sky.glow, 1),
  terrainBase: tone(terrain.base, 1),
  terrainShade: tone(terrain.shade, 1),
  terrainLift: tone(terrain.lift, 1),
  hillFar: tone(hill.far, 1),
  hillNear: tone(hill.near, 1),
  /** Two mist weights; both faint, both sky-band-only. */
  mistSoft: tone(mist, 0.14),
  mistDense: tone(mist, 0.2),
  /** Water rim glow: the specular family at effects quality, stroke only. */
  waterGlowOuter: tone(water.specular, 0.35),
} as const satisfies Record<string, Tone>;

/**
 * World geometry constants (decision 0038). Constants, not encodings: hills
 * tile at a fixed pitch so only the visible tile count varies with content
 * width — the same argument `density.ts` makes for particles. The anti-bar
 * bounds live in `world.ts` and are asserted by `world.test.ts`.
 */
export const WORLD = {
  hillTilePx: 160,
  hillHeightMinPx: 12,
  hillHeightMaxPx: 44,
  /** Hills and mist stay this far above the sky band's floor. */
  hillClearancePx: 36,
  waterGlowWidthPx: 3,
  /**
   * How far the sky and terrain paint past the content's right edge, so a canvas
   * wider than the content never shows bare backing store. A constant; the ridge
   * generator's per-tile purity means the extra tiles are as deterministic as the
   * visible ones.
   */
  overscanPx: 2048,
} as const;

/**
 * Lake silhouette harmonics. Re-homed from Forge's `silhouette.ts` UNCHANGED
 * per Angel's ruling: DESIGN.md records sustained motion and organic form as
 * having no reference model, so their character is tuned with Angel on sight,
 * not authored here. Area normalisation stays Forge's.
 */
export const LAKE_HARMONICS: readonly {
  readonly k: number;
  readonly amp: number;
  readonly phase: number;
}[] = [
  { k: 2, amp: 0.062, phase: 0.7 },
  { k: 3, amp: 0.041, phase: 2.3 },
  { k: 5, amp: 0.019, phase: 4.1 },
  { k: 7, amp: 0.011, phase: 1.1 },
];

/** Particle density. Re-homed unchanged; same on-sight tuning session. */
export const PARTICLES_PER_1000_PX2 = 5.5;

/** Cross-flow wobble. Uniform for every particle; expresses nothing. Unchanged. */
export const WOBBLE_AMPLITUDE = 0.09;
export const WOBBLE_RATE = 0.55;
