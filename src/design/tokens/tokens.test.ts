// @vitest-environment node
/**
 * Fidelity: DESIGN.md "TOKENS (BINDING)" -> tokens.css -> tokens.ts, with the
 * binding values restated here as data. Numeric comparison, not string
 * comparison, so formatting normalization cannot mask a value drift.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  hill,
  ink,
  mist,
  motion,
  shape,
  sky,
  space,
  surface,
  terrain,
  typeScale,
  water,
} from './tokens';

const cssText = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

/** Every `--name: value;` declaration in tokens.css, comments stripped. */
function declarations(): Map<string, string> {
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Map<string, string>();
  for (const match of stripped.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(match[1] as string, (match[2] as string).replace(/\s+/g, ' ').trim());
  }
  return out;
}

const decls = declarations();

function rgbOf(value: string): readonly number[] {
  const m = /rgba?\(([^)]+)\)/.exec(value);
  expect(m, `not a colour: ${value}`).not.toBeNull();
  return (m as RegExpExecArray)[1]!.split(',').map((part) => Number.parseFloat(part));
}

/** [token, r, g, b, alpha?] — transcribed from DESIGN.md, the binding record. */
const BINDING_COLOURS: readonly (readonly [string, number, number, number, number?])[] = [
  ['--surface-ground', 18, 19, 29],
  ['--surface-raised', 30, 32, 41],
  ['--surface-sunken', 20, 20, 20],
  ['--surface-rule', 255, 255, 255, 0.08],
  ['--ink-primary', 255, 255, 255],
  ['--ink-secondary', 255, 255, 255, 0.72],
  ['--ink-tertiary', 255, 255, 255, 0.5],
  ['--ink-faint', 255, 255, 255, 0.2],
  // Water re-ruled 2026-08-29 (0037): luminance bands held, chroma added by Angel's
  // amendment. Superseded values live in DESIGN.md's OVERRIDES row and in 0037.
  ['--water-deep', 16, 30, 44],
  ['--water-mid', 38, 68, 90],
  ['--water-shallow', 70, 112, 134],
  ['--water-specular', 184, 206, 224],
  ['--accent', 46, 167, 255],
  ['--accent-quiet', 46, 167, 255, 0.16],
  ['--state-refused', 255, 255, 255, 0.5],
  ['--state-refused-rule', 255, 255, 255, 0.16],
  ['--border-color', 255, 255, 255, 0.12],
];

/** [token, number, unit] for the scalar tokens. */
const BINDING_SCALARS: readonly (readonly [string, number, string])[] = [
  ['--text-display', 40, 'px'],
  ['--text-title', 28, 'px'],
  ['--text-heading', 20, 'px'],
  ['--text-body', 16, 'px'],
  ['--text-label', 13, 'px'],
  ['--text-micro', 11, 'px'],
  ['--lh-display', 1, ''],
  ['--lh-title', 1.05, ''],
  ['--lh-heading', 1.2, ''],
  ['--lh-body', 1.5, ''],
  ['--lh-label', 1.3, ''],
  ['--lh-micro', 1.35, ''],
  ['--track-display', -0.022, 'em'],
  ['--track-title', -0.016, 'em'],
  ['--track-heading', -0.01, 'em'],
  ['--track-body', 0, ''],
  ['--track-label', 0.01, 'em'],
  ['--track-micro', 0.02, 'em'],
  ['--track-instrument', 0.18, 'em'],
  ['--space-1', 4, 'px'],
  ['--space-2', 8, 'px'],
  ['--space-3', 12, 'px'],
  ['--space-4', 16, 'px'],
  ['--space-5', 24, 'px'],
  ['--space-section', 64, 'px'],
  ['--space-section-lg', 104, 'px'],
  ['--radius', 2, 'px'],
  ['--radius-plate', 6, 'px'],
  ['--border-hair', 1, 'px'],
  ['--dur-fast', 150, 'ms'],
  ['--dur-base', 300, 'ms'],
  ['--dur-slow', 500, 'ms'],
];

describe('tokens.css carries DESIGN.md verbatim', () => {
  for (const [name, r, g, b, alpha] of BINDING_COLOURS) {
    it(name, () => {
      const value = decls.get(name);
      expect(value, `${name} missing`).toBeDefined();
      const parts = rgbOf(value as string);
      expect(parts.slice(0, 3)).toEqual([r, g, b]);
      if (alpha !== undefined) expect(parts[3]).toBeCloseTo(alpha, 5);
    });
  }

  for (const [name, num, unit] of BINDING_SCALARS) {
    it(name, () => {
      const value = decls.get(name);
      expect(value, `${name} missing`).toBeDefined();
      expect(Number.parseFloat(value as string)).toBeCloseTo(num, 6);
      if (unit !== '' && num !== 0) expect(value).toContain(unit);
    });
  }

  it('easing is the single house curve', () => {
    expect(decls.get('--ease')).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
  });

  it('the 24 -> 64 spacing gap is intact — no token between component and section vocabulary', () => {
    for (const [name, value] of decls) {
      if (!/^--space-/.test(name)) continue;
      const px = Number.parseFloat(value);
      expect(px <= 24 || px >= 64, `${name}: ${value} fills the deliberate gap`).toBe(true);
    }
  });
});

describe('tokens.ts mirrors tokens.css', () => {
  it('colour components agree', () => {
    expect([surface.ground.r, surface.ground.g, surface.ground.b]).toEqual([18, 19, 29]);
    expect([surface.raised.r, surface.raised.g, surface.raised.b]).toEqual([30, 32, 41]);
    expect([surface.sunken.r, surface.sunken.g, surface.sunken.b]).toEqual([20, 20, 20]);
    expect(ink.secondary.alpha).toBeCloseTo(0.72, 5);
    expect(ink.tertiary.alpha).toBeCloseTo(0.5, 5);
    expect([water.deep.r, water.deep.g, water.deep.b]).toEqual([16, 30, 44]);
    expect([water.mid.r, water.mid.g, water.mid.b]).toEqual([38, 68, 90]);
    expect([water.shallow.r, water.shallow.g, water.shallow.b]).toEqual([70, 112, 134]);
    expect([water.specular.r, water.specular.g, water.specular.b]).toEqual([184, 206, 224]);
    expect([terrain.base.r, terrain.base.g, terrain.base.b]).toEqual([30, 42, 32]);
    expect([sky.glow.r, sky.glow.g, sky.glow.b]).toEqual([248, 214, 170]);
    expect([hill.near.r, hill.near.g, hill.near.b]).toEqual([64, 74, 52]);
    expect([mist.r, mist.g, mist.b]).toEqual([214, 220, 224]);
  });

  it('scale and motion agree', () => {
    expect(typeScale.display.sizePx).toBe(40);
    expect(typeScale.display.trackEm).toBeCloseTo(-0.022, 6);
    expect(typeScale.body.trackEm).toBe(0);
    expect(typeScale.micro.trackEm).toBeCloseTo(0.02, 6);
    expect(space).toMatchObject({
      s1: 4,
      s2: 8,
      s3: 12,
      s4: 16,
      s5: 24,
      section: 64,
      sectionLg: 104,
    });
    expect(shape.radiusPx).toBe(2);
    expect(motion).toMatchObject({ fastMs: 150, baseMs: 300, slowMs: 500 });
  });

  it('tracking tightens as size grows (apple-macbook-pro direction, not nordic-knots)', () => {
    const steps = [
      typeScale.display,
      typeScale.title,
      typeScale.heading,
      typeScale.body,
      typeScale.label,
      typeScale.micro,
    ];
    for (let i = 1; i < steps.length; i++) {
      const larger = steps[i - 1]!;
      const smaller = steps[i]!;
      expect(larger.sizePx).toBeGreaterThan(smaller.sizePx);
      expect(larger.trackEm).toBeLessThanOrEqual(smaller.trackEm);
    }
  });
});
