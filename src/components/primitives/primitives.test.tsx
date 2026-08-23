/**
 * The primitive contract: structure, accessibility, and the promise that a
 * primitive never rewrites the string it is given. Visual guarantees that
 * jsdom cannot compute (tabular numerals, uppercase-by-CSS) are asserted
 * against the stylesheet itself.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Figure, InstrumentLabel, Plate, Rule } from './index';

// jsdom rewrites import.meta.url; vitest runs from the repo root.
const sheet = readFileSync(join(process.cwd(), 'src/components/primitives/primitives.css'), 'utf8');

/** The declarations of one `[data-primitive='name']` block. */
function block(name: string): string {
  const m = new RegExp(`\\[data-primitive='${name}'\\]\\s*{([^}]+)}`).exec(sheet);
  expect(m, `no block for ${name}`).not.toBeNull();
  return (m as RegExpExecArray)[1] as string;
}

describe('Figure', () => {
  it('renders the preformatted string exactly, and never reformats it', () => {
    render(<Figure>$21,488M</Figure>);
    const el = screen.getByText('$21,488M');
    expect(el.getAttribute('data-primitive')).toBe('figure');
    expect(el.hasAttribute('data-dim')).toBe(false);
  });

  it('dim is an ink step, expressed as data state', () => {
    render(<Figure dim>$0M</Figure>);
    expect(screen.getByText('$0M').getAttribute('data-dim')).toBe('true');
  });

  it('is mono and tabular in the stylesheet (0001 C2)', () => {
    const css = block('figure');
    expect(css).toContain('var(--font-mono)');
    expect(css).toContain('font-variant-numeric: tabular-nums');
  });
});

describe('InstrumentLabel', () => {
  it('keeps the DOM string as given — uppercasing is CSS, not a rewrite', () => {
    render(<InstrumentLabel>Filed</InstrumentLabel>);
    expect(screen.getByText('Filed').textContent).toBe('Filed');
  });

  it('is mono, uppercase and wide-tracked in the stylesheet', () => {
    const css = block('instrument-label');
    expect(css).toContain('text-transform: uppercase');
    expect(css).toContain('var(--track-instrument)');
    expect(css).toContain('var(--font-mono)');
  });
});

describe('Plate', () => {
  it('renders its children on a raised surface', () => {
    render(
      <Plate>
        <p>content</p>
      </Plate>,
    );
    expect(screen.getByText('content').closest("[data-primitive='plate']")).not.toBeNull();
    const css = block('plate');
    expect(css).toContain('var(--surface-raised)');
    expect(css).toContain('var(--ring-edge)');
    expect(css).toContain('var(--radius-plate)');
  });
});

describe('Rule', () => {
  it('is a real separator, vertical by default — the Q1 statement', () => {
    render(<Rule />);
    const el = screen.getByRole('separator');
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('can lie horizontal', () => {
    render(<Rule orientation="horizontal" />);
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('draws with the rule token at hairline width', () => {
    const css = block('rule');
    expect(css).toContain('var(--surface-rule)');
  });
});
