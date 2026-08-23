// @vitest-environment node
/**
 * Atelier's definition of done: zero hardcoded colour outside the token
 * layer. This is the lint, expressed as a colocated test until an ESLint rule
 * lands with Keel.
 *
 * The token layer — src/design/tokens/ and src/styles/ — is where literals
 * LIVE; everywhere else they are defects. Each allowlisted file carries a
 * reason and is re-verified to still match, so a stale entry fails loudly
 * once its literals are gone.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../..', import.meta.url));

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/;

/** file (relative to src/) -> why a colour literal is tolerated there, for now. */
const ALLOWLIST = new Map<string, string>([
  [
    'viz/render/testing/recording-context.ts',
    'Canvas API spec default (#000) in a recording test double; not a rendered colour.',
  ],
]);

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules') continue;
      // Skip the token layer: literals live there by design.
      const rel = full.slice(SRC.length);
      if (rel === 'design/tokens' || rel === 'styles') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|css)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
}

describe('no hardcoded colour outside the token layer', () => {
  const files: string[] = [];
  walk(SRC.replace(/\/$/, ''), files);

  it('scans a real tree', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('finds no colour literals outside the allowlist', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.slice(SRC.length);
      if (ALLOWLIST.has(rel)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (COLOUR.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('every allowlist entry still earns its place', () => {
    for (const [rel, reason] of ALLOWLIST) {
      const text = readFileSync(join(SRC, rel), 'utf8');
      expect(COLOUR.test(text), `${rel} no longer matches — remove it (${reason})`).toBe(true);
    }
  });
});

describe('motion discipline in the style layer', () => {
  const sheets = [
    join(SRC, 'styles/base.css'),
    join(SRC, 'styles/surfaces.css'),
    join(SRC, 'components/primitives/primitives.css'),
  ];

  it('every transition and animation draws duration and easing from tokens', () => {
    for (const sheet of sheets) {
      const text = readFileSync(sheet, 'utf8');
      for (const m of text.matchAll(/(?:transition|animation)\s*:\s*([^;]+);/g)) {
        const value = m[1] as string;
        expect(value, `${sheet}: ${value}`).toContain('var(--dur-');
        expect(value, `${sheet}: ${value}`).toContain('var(--ease)');
      }
      expect(text).not.toMatch(/cubic-bezier|ease-in|ease-out|linear\(/);
    }
  });

  it('the accent never appears in surface or primitive styling — interactive state only', () => {
    const restricted = [
      join(SRC, 'styles/surfaces.css'),
      join(SRC, 'components/primitives/primitives.css'),
    ];
    for (const sheet of restricted) {
      expect(readFileSync(sheet, 'utf8')).not.toContain('--accent');
    }
  });
});
