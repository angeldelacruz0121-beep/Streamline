// @vitest-environment node
/**
 * The asset manifest's font row, enforced: self-hosted, latin subset, woff2,
 * inside budget — Sans <= 60 KB total (one variable file, wght 400-600),
 * Mono <= 40 KB total. And the shipped CSS never references Google.
 */
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const fontsCss = readFileSync(`${ROOT}src/styles/fonts.css`, 'utf8');

describe('font budgets (DESIGN.md asset manifest)', () => {
  it('IBM Plex Sans total <= 60 KB', () => {
    const size = statSync(`${ROOT}public/fonts/plex-sans-var-latin.woff2`).size;
    expect(size).toBeLessThanOrEqual(60 * 1024);
    expect(size).toBeGreaterThan(10 * 1024); // a real font, not a stub
  });

  it('IBM Plex Mono total <= 40 KB', () => {
    const total =
      statSync(`${ROOT}public/fonts/plex-mono-400-latin.woff2`).size +
      statSync(`${ROOT}public/fonts/plex-mono-500-latin.woff2`).size;
    expect(total).toBeLessThanOrEqual(40 * 1024);
  });
});

describe('font faces', () => {
  it('declares the variable Sans across the full 400-600 range', () => {
    expect(fontsCss).toMatch(/font-weight:\s*400 600/);
  });

  it('every face self-hosts from /fonts/, subsets latin, and states font-display', () => {
    const faces = fontsCss.match(/@font-face\s*{[^}]+}/g) ?? [];
    expect(faces).toHaveLength(3);
    for (const face of faces) {
      expect(face).toContain("url('/fonts/");
      expect(face).toContain("format('woff2')");
      expect(face).toContain('font-display: swap');
      expect(face).toContain('unicode-range');
    }
  });

  it('never references Google', () => {
    expect(fontsCss).not.toMatch(/googleapis|gstatic/);
  });
});

describe('figures cannot jitter (test record 0001 C2)', () => {
  it('the root sets tabular numerals and never undoes them', () => {
    const base = readFileSync(`${ROOT}src/styles/base.css`, 'utf8');
    expect(base).toMatch(/font-variant-numeric:\s*tabular-nums/);
    const all = [
      'src/styles/base.css',
      'src/styles/surfaces.css',
      'src/components/primitives/primitives.css',
    ]
      .map((p) => readFileSync(`${ROOT}${p}`, 'utf8'))
      .join('\n');
    expect(all).not.toMatch(/font-variant-numeric:\s*(normal|proportional)/);
  });
});
