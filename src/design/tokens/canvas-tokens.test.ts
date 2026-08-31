// @vitest-environment node
/**
 * The canvas token contract, from the token side. Forge's
 * `no-encoding-leak.test.ts` holds the renderer's half (one shared fill, no
 * per-segment variation, constants only); this suite holds the values' half:
 * the accent is unreachable, saturation stays inside the measured water
 * envelope, spacing stays on the grid, and the 0002 C4 cue semantics survive
 * re-homing.
 */
import { describe, expect, it } from 'vitest';
import {
  CONSTRICTION_CUES,
  JUNCTION_SEPARATION_PX,
  LAKE_HARMONICS,
  PARTICLES_PER_1000_PX2,
  SPACING,
  WORLD,
  WORLD_TONES,
  TONES,
  TYPE,
  WOBBLE_AMPLITUDE,
  WOBBLE_RATE,
  css,
} from './canvas-tokens';
import { accent } from './tokens';
import type { Tone } from './canvas-tokens';

/** HSV saturation — the metric the photographic references were measured in. */
function saturation(t: Tone): number {
  const max = Math.max(t.r, t.g, t.b);
  const min = Math.min(t.r, t.g, t.b);
  return max === 0 ? 0 : (max - min) / max;
}

/** HSV hue in degrees, for the one-shared-hue guard below. */
function hue(t: Tone): number {
  const max = Math.max(t.r, t.g, t.b);
  const min = Math.min(t.r, t.g, t.b);
  if (max === min) return Number.NaN; // achromatic: no hue to police
  const d = max - min;
  let h: number;
  if (max === t.r) h = ((t.g - t.b) / d) % 6;
  else if (max === t.g) h = (t.b - t.r) / d + 2;
  else h = (t.r - t.g) / d + 4;
  return (((h * 60) % 360) + 360) % 360;
}

describe('colour discipline', () => {
  // AMENDED 2026-08-29 (decision 0037, Angel). The old bound — every tone <= 10%
  // saturation — protected D15 by keeping hue itself off the canvas. Angel ruled the
  // water genuinely blue, so the guard changes shape rather than dying:
  //   1. a ceiling still exists (nothing neon can land by accident), and
  //   2. every CHROMATIC tone must sit in ONE shared hue family, so a second color
  //      can never sneak on canvas to differentiate anything. D15 stays open.
  it('every tone holds the amended bound: saturation <= 65%', () => {
    for (const [name, tone] of Object.entries(TONES)) {
      expect(saturation(tone), name).toBeLessThanOrEqual(0.65);
    }
  });

  it('every chromatic tone shares the single water-hue family (0037)', () => {
    const hues = Object.entries(TONES)
      .map(([name, tone]) => [name, hue(tone)] as const)
      .filter(([, h]) => !Number.isNaN(h));
    expect(hues.length).toBeGreaterThan(0);
    for (const [name, h] of hues) {
      expect(h, `${name} hue ${h.toFixed(1)} left the shared family`).toBeGreaterThanOrEqual(195);
      expect(h, `${name} hue ${h.toFixed(1)} left the shared family`).toBeLessThanOrEqual(215);
    }
  });

  it('the accent is unreachable — no tone is the accent, at any alpha', () => {
    for (const tone of Object.values(TONES)) {
      const isAccent =
        tone.r === accent.base.r && tone.g === accent.base.g && tone.b === accent.base.b;
      expect(isAccent).toBe(false);
    }
  });

  it('css() renders a tone as-is', () => {
    expect(css({ r: 64, g: 66, b: 71, alpha: 1 })).toBe('rgba(64, 66, 71, 1)');
  });
});

describe('spacing discipline', () => {
  it('every layout run sits on the 4px grid', () => {
    for (const [name, px] of Object.entries(SPACING)) {
      expect(px % 4, name).toBe(0);
    }
    expect(JUNCTION_SEPARATION_PX % 4).toBe(0);
  });
});

describe('0002 C4 cue semantics survive re-homing', () => {
  it('a segment cost is one rim, the trunk residual is two rims plus ticks', () => {
    expect(CONSTRICTION_CUES['segment-cost'].rimCount).toBe(1);
    expect(CONSTRICTION_CUES['segment-cost'].throatTicks).toBe(false);
    expect(CONSTRICTION_CUES['trunk-residual'].rimCount).toBe(2);
    expect(CONSTRICTION_CUES['trunk-residual'].throatTicks).toBe(true);
  });
});

describe('type', () => {
  it('figures are Plex Mono — tabular by construction, which ctx.font requires', () => {
    expect(TYPE.figure).toContain('IBM Plex Mono');
  });

  it('labels and notes are Plex Sans', () => {
    expect(TYPE.label).toContain('IBM Plex Sans');
    expect(TYPE.note).toContain('IBM Plex Sans');
  });
});

describe('sustained-motion values are re-homed, not re-authored (Angel ruling 2026-08-21)', () => {
  it('lake harmonics are unchanged from the placeholder set', () => {
    expect(LAKE_HARMONICS).toEqual([
      { k: 2, amp: 0.062, phase: 0.7 },
      { k: 3, amp: 0.041, phase: 2.3 },
      { k: 5, amp: 0.019, phase: 4.1 },
      { k: 7, amp: 0.011, phase: 1.1 },
    ]);
  });

  it('particle density and wobble are unchanged', () => {
    expect(PARTICLES_PER_1000_PX2).toBe(5.5);
    expect(WOBBLE_AMPLITUDE).toBe(0.09);
    expect(WOBBLE_RATE).toBe(0.55);
  });
});

describe('the world families hold their 0038 bounds (scenery, never data)', () => {
  const wrappedHueDistance = (h: number, from: number): number => {
    const d = Math.abs(((h - from + 540) % 360) - 180);
    return d;
  };
  const luma = (t: Tone): number => Math.max(t.r, t.g, t.b);

  it('terrain: dusk green, muted, dark enough for every existing label ink', () => {
    for (const t of [WORLD_TONES.terrainBase, WORLD_TONES.terrainShade, WORLD_TONES.terrainLift]) {
      expect(hue(t)).toBeGreaterThanOrEqual(90);
      expect(hue(t)).toBeLessThanOrEqual(150);
      expect(saturation(t)).toBeLessThanOrEqual(0.35);
      expect(luma(t)).toBeGreaterThanOrEqual(22);
      expect(luma(t)).toBeLessThanOrEqual(46);
    }
  });

  it('sky: the sunset family, wrapped within 33 degrees of hue 12, light, band-confined', () => {
    for (const t of [WORLD_TONES.skyZenith, WORLD_TONES.skyMid, WORLD_TONES.skyGlow]) {
      expect(wrappedHueDistance(hue(t), 12)).toBeLessThanOrEqual(33);
      expect(saturation(t)).toBeLessThanOrEqual(0.45);
      expect(luma(t)).toBeGreaterThanOrEqual(150);
    }
  });

  it('hills: horizon silhouettes, earthy, mid-dark', () => {
    for (const t of [WORLD_TONES.hillFar, WORLD_TONES.hillNear]) {
      expect(hue(t)).toBeGreaterThanOrEqual(15);
      expect(hue(t)).toBeLessThanOrEqual(150);
      expect(saturation(t)).toBeLessThanOrEqual(0.3);
      expect(luma(t)).toBeGreaterThanOrEqual(40);
      expect(luma(t)).toBeLessThanOrEqual(130);
    }
  });

  it('mist: near-achromatic and faint, or it starts reading as weather data', () => {
    for (const t of [WORLD_TONES.mistSoft, WORLD_TONES.mistDense]) {
      expect(saturation(t)).toBeLessThanOrEqual(0.08);
      expect(t.alpha).toBeLessThanOrEqual(0.2);
    }
  });

  it('the water rim glow stays in the ruled water family', () => {
    expect(hue(WORLD_TONES.waterGlowOuter)).toBeGreaterThanOrEqual(195);
    expect(hue(WORLD_TONES.waterGlowOuter)).toBeLessThanOrEqual(215);
    expect(WORLD_TONES.waterGlowOuter.alpha).toBeLessThanOrEqual(0.5);
  });

  it('world constants are constants on sane bounds, not encodings', () => {
    expect(SPACING.skyBandPx % 4).toBe(0);
    expect(WORLD.hillTilePx % 4).toBe(0);
    expect(WORLD.hillHeightMinPx).toBeLessThan(WORLD.hillHeightMaxPx);
    expect(WORLD.hillHeightMaxPx + WORLD.hillClearancePx).toBeLessThanOrEqual(SPACING.skyBandPx);
    for (const v of Object.values(WORLD)) expect(typeof v).toBe('number');
  });
});
