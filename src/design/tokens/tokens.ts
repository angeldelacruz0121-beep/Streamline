/**
 * Typed mirror of `tokens.css`, for TypeScript consumers and for the token
 * tests. `tokens.test.ts` asserts the two files agree, so neither can drift
 * without an alarm. Values are DESIGN.md's "TOKENS (BINDING)", verbatim.
 *
 * DOM styling consumes the CSS custom properties, never this module; this
 * module exists for the canvas token layer (`canvas-tokens.ts`), the contrast
 * math, and any future consumer that needs a number rather than a string.
 */

/** An opaque sRGB colour. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** An sRGB colour with an alpha channel. */
export interface Rgba extends Rgb {
  readonly alpha: number;
}

const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });
const rgba = (r: number, g: number, b: number, alpha: number): Rgba => ({ r, g, b, alpha });

export const surface = {
  ground: rgb(18, 19, 29),
  raised: rgb(30, 32, 41),
  sunken: rgb(20, 20, 20),
  rule: rgba(255, 255, 255, 0.08),
} as const;

/** One ink, four weights. Alpha over a surface, never a new gray. */
export const ink = {
  primary: rgb(255, 255, 255),
  secondary: rgba(255, 255, 255, 0.72),
  tertiary: rgba(255, 255, 255, 0.5),
  /** Hairlines and disabled affordances only. Never text: it cannot pass AA. */
  faint: rgba(255, 255, 255, 0.2),
} as const;

/**
 * The measured water ramp. Provisional in value, protected in method: tuning
 * stays inside the photographic envelope (L P05 12-31 / P50 43-89 / P95
 * 172-221, saturation 2-10%) and happens with Angel on sight.
 */
export const water = {
  deep: rgb(28, 29, 31),
  mid: rgb(64, 66, 71),
  shallow: rgb(101, 104, 112),
  specular: rgb(196, 201, 212),
} as const;

/**
 * UI STATE ONLY — focus rings, links, interactive state. Forbidden on the
 * canvas: colour is not an encoding channel until D15 is answered, and
 * `canvas-tokens.test.ts` asserts the canvas layer cannot reach this value.
 */
export const accent = {
  base: rgb(46, 167, 255),
  quiet: rgba(46, 167, 255, 0.16),
} as const;

/** Deliberately achromatic. A refusal is a designed state, not an error. */
export const stateRefused = {
  ink: rgba(255, 255, 255, 0.5),
  rule: rgba(255, 255, 255, 0.16),
} as const;

export interface TypeStep {
  readonly sizePx: number;
  readonly lineHeight: number;
  /** Letter-spacing in em. Tightens as size grows, per DESIGN.md. */
  readonly trackEm: number;
}

export const typeScale = {
  display: { sizePx: 40, lineHeight: 1, trackEm: -0.022 },
  title: { sizePx: 28, lineHeight: 1.05, trackEm: -0.016 },
  heading: { sizePx: 20, lineHeight: 1.2, trackEm: -0.01 },
  body: { sizePx: 16, lineHeight: 1.5, trackEm: 0 },
  label: { sizePx: 13, lineHeight: 1.3, trackEm: 0.01 },
  micro: { sizePx: 11, lineHeight: 1.35, trackEm: 0.02 },
} as const satisfies Record<string, TypeStep>;

/** Instrument labels — mono, uppercase, wide. */
export const trackInstrumentEm = 0.18;

export const fontStack = {
  sans: `'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`,
  mono: `'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Monaco, monospace`,
} as const;

/**
 * 4px base. Two vocabularies, deliberately discontinuous: components stop at
 * 24, sections start at 64. The gap is intentional; do not fill it.
 */
export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  section: 64,
  sectionLg: 104,
} as const;

export const shape = {
  radiusPx: 2,
  radiusPlatePx: 6,
  borderHairPx: 1,
  borderColor: rgba(255, 255, 255, 0.12),
} as const;

export const depth = {
  ringEdge: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
  shadowLift: '0 16px 48px rgba(0, 0, 0, 0.55)',
} as const;

/** UI chrome only. Canvas motion is Forge's rate-locked system. */
export const motion = {
  fastMs: 150,
  baseMs: 300,
  slowMs: 500,
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;
