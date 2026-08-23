import { describe, expect, it } from 'vitest';
import {
  BASELINE_FLOW_PX_PER_SEC,
  PARTICLES_PER_1000_PX2,
  PARTICLE_POOL_CEILING,
  arealDensity,
  particleCountFor,
} from './density';

describe('particle density — Invariant 3.6', () => {
  it('is one areal constant, so density is not a channel', () => {
    // Two flows of equal surface area get equal counts regardless of anything else about
    // them. This is the property that keeps particle density off the encoding surface.
    expect(particleCountFor(10_000)).toBe(particleCountFor(10_000));
    const target = PARTICLES_PER_1000_PX2 / 1000;
    for (const area of [1_000, 5_000, 20_000, 100_000]) {
      // The only permitted deviation is that a particle is an integer. Half a particle
      // spread over the flow's area is the entire error budget; anything larger would
      // mean density varies with something, which Invariant 3.6 forbids.
      const deviation = Math.abs(arealDensity(particleCountFor(area), area) - target);
      expect(deviation).toBeLessThanOrEqual(0.5 / area + Number.EPSILON);
    }
  });

  it('scales exactly with area, which is already the 3.1 width encoding', () => {
    // A river twice the area gets twice the particles. That is a consequence of width
    // encoding dollars, not a second statement about the segment.
    expect(particleCountFor(20_000)).toBe(particleCountFor(10_000) * 2);
  });

  it('degradation multiplies one global number, preserving every ratio', () => {
    const areas = [4_000, 12_000, 40_000];
    const full = areas.map((area) => particleCountFor(area, 1));
    const reduced = areas.map((area) => particleCountFor(area, 0.5));
    for (let i = 0; i < areas.length; i += 1) {
      expect((reduced[i] as number) / (full[i] as number)).toBeCloseTo(0.5, 2);
    }
  });

  it('returns zero for a flow with no surface rather than a stray particle', () => {
    expect(particleCountFor(0)).toBe(0);
    expect(particleCountFor(-5)).toBe(0);
    expect(particleCountFor(Number.NaN)).toBe(0);
  });

  it('has a pool ceiling, so a pathological filer cannot allocate without bound', () => {
    expect(PARTICLE_POOL_CEILING).toBeGreaterThan(0);
    expect(Number.isFinite(PARTICLE_POOL_CEILING)).toBe(true);
  });
});

describe('baseline flow speed — D9 is excluded, and structurally so', () => {
  it('is a single module constant, not a function of anything', () => {
    expect(typeof BASELINE_FLOW_PX_PER_SEC).toBe('number');
    expect(BASELINE_FLOW_PX_PER_SEC).toBeGreaterThan(0);
  });

  it('exposes no growth-to-speed mapping anywhere in the module', async () => {
    const module = await import('./density');
    const names = Object.keys(module).join(' ').toLowerCase();
    expect(names).not.toContain('growth');
    expect(names).not.toContain('yoy');
  });
});
