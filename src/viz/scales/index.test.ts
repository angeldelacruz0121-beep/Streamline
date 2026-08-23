// @vitest-environment node
/**
 * The manifest. Cartographer's mandate: every scale exports its domain, its range, and a
 * one-line statement of meaning. This makes that mechanical.
 */
import { describe, expect, it } from 'vitest';
import { SCALE_MANIFEST } from './index';

describe('SCALE_MANIFEST', () => {
  it('covers exactly the scales that ship today', () => {
    expect(SCALE_MANIFEST.map((entry) => entry.id)).toEqual(['width', 'area', 'depth']);
  });

  it('holds no flow-speed scale, because D9 is open', () => {
    expect(SCALE_MANIFEST.some((entry) => entry.id === 'speed')).toBe(false);
  });

  it('holds no colour scale, because D15 is open', () => {
    expect(SCALE_MANIFEST.some((entry) => /colou?r|hue/i.test(entry.id))).toBe(false);
    expect(JSON.stringify(SCALE_MANIFEST)).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it('makes every entry self-describing and linear', () => {
    for (const entry of SCALE_MANIFEST) {
      expect(entry.linear).toBe(true);
      expect(entry.meaning.length).toBeGreaterThan(20);
      expect(entry.domain.length).toBeGreaterThan(20);
      expect(entry.range.length).toBeGreaterThan(20);
      expect(entry.constant).toMatch(/\$/);
      expect(entry.misreading.wrongConclusion.length).toBeGreaterThan(20);
      expect(entry.misreading.defense.length).toBeGreaterThan(20);
    }
  });

  it('gives every scale a unique id', () => {
    expect(new Set(SCALE_MANIFEST.map((entry) => entry.id)).size).toBe(SCALE_MANIFEST.length);
  });
});
