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

describe('colour discipline', () => {
  it('every tone holds the measured bound: saturation <= 10%', () => {
    for (const [name, tone] of Object.entries(TONES)) {
      expect(saturation(tone), name).toBeLessThanOrEqual(0.1);
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
