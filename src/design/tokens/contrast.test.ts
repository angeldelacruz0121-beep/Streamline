// @vitest-environment node
/**
 * WCAG AA, computed rather than claimed. Alpha inks are composited over their
 * real surfaces before measuring, because an alpha has no contrast of its own.
 *
 * The one deliberate failure is documented: --ink-faint (0.20 white) cannot
 * pass AA anywhere and is therefore contractually NEVER text — hairlines and
 * disabled affordances only. A companion test asserts no stylesheet uses it
 * as a text colour, and this suite asserts it would fail, so the rule cannot
 * quietly become unnecessary-looking.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TONES } from './canvas-tokens';
import { accent, ink, stateRefused, surface, terrain, water } from './tokens';
import type { Rgb, Rgba } from './tokens';

function channelLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(c: Rgb): number {
  return 0.2126 * channelLinear(c.r) + 0.7152 * channelLinear(c.g) + 0.0722 * channelLinear(c.b);
}

function over(fg: Rgba | Rgb, bg: Rgb): Rgb {
  const alpha = 'alpha' in fg ? fg.alpha : 1;
  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  };
}

function contrast(text: Rgba | Rgb, bg: Rgb): number {
  const lText = luminance(over(text, bg));
  const lBg = luminance(bg);
  const [hi, lo] = lText > lBg ? [lText, lBg] : [lBg, lText];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_NORMAL = 4.5;

describe('ink over surfaces (DOM)', () => {
  const surfaces: readonly (readonly [string, Rgb])[] = [
    ['ground', surface.ground],
    ['raised', surface.raised],
    ['sunken', surface.sunken],
  ];

  it.each(surfaces)('ink-primary on %s', (_, bg) => {
    expect(contrast(ink.primary, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(surfaces)('ink-secondary on %s', (_, bg) => {
    expect(contrast(ink.secondary, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(surfaces)('ink-tertiary on %s', (_, bg) => {
    expect(contrast(ink.tertiary, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(surfaces)('state-refused ink on %s', (_, bg) => {
    expect(contrast(stateRefused.ink, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('accent as link text passes on ground and raised', () => {
    expect(contrast(accent.base, surface.ground)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrast(accent.base, surface.raised)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe('canvas text over canvas surfaces', () => {
  const bed: Rgb = { r: TONES.canvas.r, g: TONES.canvas.g, b: TONES.canvas.b };
  const waterFill: Rgb = { r: TONES.water.r, g: TONES.water.g, b: TONES.water.b };

  it('primary canvas text passes on the bed and on the water body', () => {
    expect(contrast(TONES.text, bed)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrast(TONES.text, waterFill)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('dim canvas text passes on the bed — its only permitted ground', () => {
    expect(contrast(TONES.textDim, bed)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('dim canvas text does NOT pass over the water body, which is why its use is bed-only', () => {
    expect(contrast(TONES.textDim, waterFill)).toBeLessThan(AA_NORMAL);
  });
});

describe('the documented non-text ink', () => {
  it('ink-faint fails AA on every surface — the reason it is never text', () => {
    for (const bg of [surface.ground, surface.raised, surface.sunken]) {
      expect(contrast(ink.faint, bg)).toBeLessThan(AA_NORMAL);
    }
  });

  it('no stylesheet uses ink-faint or water tokens as a text colour', () => {
    const files = [
      '../../styles/base.css',
      '../../styles/surfaces.css',
      '../../components/primitives/primitives.css',
    ];
    for (const rel of files) {
      const text = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
      expect(text).not.toMatch(/color:\s*var\(--ink-faint\)/);
      expect(text).not.toMatch(/color:\s*var\(--water-/);
    }
  });
});

describe('water ramp stays inside the measured envelope', () => {
  const luma = (c: Rgb): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  it('deep sits in P05 12-31', () => {
    expect(luma(water.deep)).toBeGreaterThanOrEqual(12);
    expect(luma(water.deep)).toBeLessThanOrEqual(31);
  });

  it('mid sits in P50 43-89', () => {
    expect(luma(water.mid)).toBeGreaterThanOrEqual(43);
    expect(luma(water.mid)).toBeLessThanOrEqual(89);
  });

  it('specular sits in P95 172-221', () => {
    expect(luma(water.specular)).toBeGreaterThanOrEqual(172);
    expect(luma(water.specular)).toBeLessThanOrEqual(221);
  });
});

describe("textDim's bed-only rule holds at the marked water-body call sites", () => {
  /**
   * On adoption, Forge moved the two textDim uses that sat on the water body
   * — the lake period label and the river disclosure note — to full ink, and
   * marked each with this comment. This pins marker and tone together: if
   * either site regresses to textDim, or a marker is deleted, this fires.
   * A NEW water-body site without a marker remains Forge's call-site
   * discipline; which draw calls target the water body is not decidable from
   * this side of the boundary.
   */
  const MARKER = 'Full ink, not textDim';

  it('every marked site draws with full ink', () => {
    const renderDir = fileURLToPath(new URL('../../viz/render/', import.meta.url));
    const files = readdirSync(renderDir).filter((f) => f.endsWith('.ts') && !f.includes('.test.'));
    let markers = 0;
    for (const file of files) {
      const text = readFileSync(join(renderDir, file), 'utf8');
      let at = text.indexOf(MARKER);
      while (at !== -1) {
        markers += 1;
        const reach = text.slice(at, at + 400);
        const tone = /tone:\s*TONES\.(\w+)/.exec(reach);
        expect(tone, `${file}: marker with no tone in reach`).not.toBeNull();
        const name = (tone as RegExpExecArray)[1] as string;
        expect(name, `${file}: marked water-body site regressed to ${name}`).toBe('text');
        at = text.indexOf(MARKER, at + 1);
      }
    }
    // Was 2. The river's disclosure row was the second marked site; it no longer exists —
    // that sentence moved to the DOM margin in the text triage, so there is no canvas call
    // left to mark. The rule is unchanged and the remaining site (the lake period label,
    // which sits on the water body) is still checked above. Re-audited 2026-08-26.
    expect(markers, 'a water-body marker was deleted — re-audit the rule').toBeGreaterThanOrEqual(
      1,
    );
  });
});

describe('every canvas label ink survives the 0038 terrain (the dusk-grade bargain)', () => {
  // The world ships only because these hold: terrain luminance was capped so the
  // existing labels keep AA with ZERO new occluders. If a future terrain tweak
  // breaks one of these, the dressing loses, not the label (Angel's clause).
  const grounds: readonly Rgb[] = [terrain.base, terrain.shade, terrain.lift];

  it('full text ink clears AA over all terrain tones', () => {
    for (const ground of grounds) {
      expect(contrast(TONES.text, ground)).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it('textDim clears AA over all terrain tones (labels sit on terrain, never sky)', () => {
    for (const ground of grounds) {
      expect(contrast(TONES.textDim, ground)).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });
});
