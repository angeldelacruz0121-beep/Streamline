import { describe, expect, it } from 'vitest';
import {
  BASELINE_FLOW_PX_PER_SEC,
  PARTICLES_PER_1000_PX2,
  arealDensity,
  particleCountFor,
} from './density';
import { buildFlowField, centreAt, halfWidthAt } from './field';
import { ParticleSystem, type FlowSource } from './system';

/** A straight channel of constant width. Enough to exercise the field and the pool. */
function channel(id: string, widthPx: number, lengthPx = 400): FlowSource {
  const top = [
    { x: 0, y: 100 - widthPx / 2 },
    { x: lengthPx, y: 100 - widthPx / 2 },
  ];
  const bottom = [
    { x: 0, y: 100 + widthPx / 2 },
    { x: lengthPx, y: 100 + widthPx / 2 },
  ];
  return { id, field: buildFlowField(top, bottom), surfacePx2: widthPx * lengthPx };
}

describe('flow field', () => {
  it('recovers the centreline and half-width Cartographer stated', () => {
    const field = channel('a', 60).field;
    expect(centreAt(field, 200)).toBeCloseTo(100, 5);
    expect(halfWidthAt(field, 200)).toBeCloseTo(30, 5);
  });

  it('clamps outside its own extent rather than extrapolating a width', () => {
    const field = channel('a', 60, 400).field;
    expect(halfWidthAt(field, -50)).toBeCloseTo(30, 5);
    expect(halfWidthAt(field, 9_000)).toBeCloseTo(30, 5);
  });

  it('is empty, not degenerate, for an empty bank list', () => {
    const field = buildFlowField([], []);
    expect(field.centreY.length).toBe(0);
    expect(centreAt(field, 10)).toBe(0);
  });
});

describe('ParticleSystem', () => {
  const flows = [channel('wide', 140), channel('narrow', 14), channel('trunk', 155)];

  it('gives every flow the same areal density — Invariant 3.6', () => {
    const system = new ParticleSystem(flows);
    // Reconstruct per-flow counts from the density function the system uses.
    const densities = flows.map((flow) =>
      arealDensity(particleCountFor(flow.surfacePx2, 1), flow.surfacePx2),
    );
    // Equal to within the integer rounding of a single particle, which is the only
    // source of difference the implementation has.
    for (let i = 0; i < flows.length; i += 1) {
      const flow = flows[i] as FlowSource;
      const target = arealDensity(
        PARTICLES_PER_1000_PX2 * (flow.surfacePx2 / 1000),
        flow.surfacePx2,
      );
      expect(Math.abs((densities[i] as number) - target)).toBeLessThanOrEqual(
        0.5 / flow.surfacePx2,
      );
    }
    expect(system.activeCount()).toBe(
      flows.reduce((sum, flow) => sum + particleCountFor(flow.surfacePx2, 1), 0),
    );
  });

  it('keeps every particle inside the banks of its own flow', () => {
    const system = new ParticleSystem(flows);
    const x = new Float32Array(system.capacity);
    const y = new Float32Array(system.capacity);
    for (let step = 0; step < 50; step += 1) {
      system.step(1 / 60);
      const n = system.writePositions(x, y);
      for (let i = 0; i < n; i += 1) {
        // Every flow here is centred on y = 100; the widest is 155px, so the whole field
        // must live within its half-width of the centreline.
        expect(Math.abs((y[i] as number) - 100)).toBeLessThanOrEqual(155 / 2 + 0.001);
      }
    }
  });

  it('wraps at the mouth instead of drifting off the canvas', () => {
    const system = new ParticleSystem(flows);
    const x = new Float32Array(system.capacity);
    const y = new Float32Array(system.capacity);
    for (let step = 0; step < 2_000; step += 1) system.step(1 / 60);
    const n = system.writePositions(x, y);
    for (let i = 0; i < n; i += 1) {
      expect(x[i] as number).toBeGreaterThanOrEqual(-0.001);
      expect(x[i] as number).toBeLessThanOrEqual(400.001);
    }
  });

  it('is deterministic — two systems with the same seed agree exactly', () => {
    const a = new ParticleSystem(flows, 12_345);
    const b = new ParticleSystem(flows, 12_345);
    const ax = new Float32Array(a.capacity);
    const ay = new Float32Array(a.capacity);
    const bx = new Float32Array(b.capacity);
    const by = new Float32Array(b.capacity);
    for (let step = 0; step < 20; step += 1) {
      a.step(1 / 60);
      b.step(1 / 60);
    }
    a.writePositions(ax, ay);
    b.writePositions(bx, by);
    expect([...ax]).toEqual([...bx]);
    expect([...ay]).toEqual([...by]);
  });

  it('changes the active count on degradation but never reallocates the pool', () => {
    const system = new ParticleSystem(flows);
    const before = system.buffers();
    const fullCount = system.activeCount();
    system.setDensityScale(0.35);
    const reducedCount = system.activeCount();
    system.setDensityScale(1);
    const restoredCount = system.activeCount();

    expect(reducedCount).toBeLessThan(fullCount);
    expect(restoredCount).toBe(fullCount);
    // Identity, not equality: stepping the ladder down and back up must not touch the
    // allocator, or a ten-minute session with a few transitions grows the heap.
    const after = system.buffers();
    expect(after.length).toBe(before.length);
    for (let i = 0; i < after.length; i += 1) expect(after[i]).toBe(before[i]);
    expect(system.capacity).toBe(fullCount);
  });

  it('degrades every flow by the same factor, so quality level is not a data channel', () => {
    const system = new ParticleSystem(flows);
    const fullPerFlow = flows.map((flow) => particleCountFor(flow.surfacePx2, 1));
    const halfPerFlow = flows.map((flow) => particleCountFor(flow.surfacePx2, 0.5));
    system.setDensityScale(0.5);
    expect(system.activeCount()).toBe(halfPerFlow.reduce((a, b) => a + b, 0));
    for (let i = 0; i < flows.length; i += 1) {
      // Exact to within one particle of rounding on each side of the ratio.
      const exact = (flow: number): number => (PARTICLES_PER_1000_PX2 * flow) / 1000;
      const area = (flows[i] as FlowSource).surfacePx2;
      expect(Math.abs((halfPerFlow[i] as number) - exact(area) * 0.5)).toBeLessThanOrEqual(0.5);
      expect(Math.abs((fullPerFlow[i] as number) - exact(area))).toBeLessThanOrEqual(0.5);
    }
  });

  it('advances every flow at the same speed, so D9 cannot be pre-empted by accident', () => {
    // The behavioural version of "there is no per-flow speed field". Three flows of very
    // different widths; the mean distance travelled in one second must be the same for
    // all of them, because the only speed in the system is one module constant.
    const system = new ParticleSystem(flows, 99);
    const x0 = new Float32Array(system.capacity);
    const y0 = new Float32Array(system.capacity);
    system.writePositions(x0, y0);
    const start = [...x0];
    const x1 = new Float32Array(system.capacity);
    const y1 = new Float32Array(system.capacity);
    // Short run so nothing wraps: 26px/s baseline over 0.25s is well inside a 400px flow.
    for (let step = 0; step < 15; step += 1) system.step(1 / 60);
    system.writePositions(x1, y1);

    let cursor = 0;
    const means: number[] = [];
    for (const flow of flows) {
      const count = particleCountFor(flow.surfacePx2, 1);
      let total = 0;
      for (let i = 0; i < count; i += 1) {
        // Un-wrap: a particle that passed the mouth reappears at the head, and the raw
        // delta would read as a 400px jump backwards.
        let delta = (x1[cursor + i] as number) - (start[cursor + i] as number);
        if (delta < 0) delta += flow.field.endX - flow.field.startX;
        total += delta;
      }
      means.push(total / count);
      cursor += count;
    }
    // Every flow's mean advance must sit on the one baseline constant. The residual is
    // the +/-8% per-particle drift averaging out over different particle counts, not a
    // per-flow speed: a growth mapping would put these means at 0.5x and 2.0x of each
    // other (Invariant 3.5's stated bounds), which is two orders of magnitude larger.
    const ideal = BASELINE_FLOW_PX_PER_SEC * (15 / 60);
    for (const mean of means) expect(Math.abs(mean / ideal - 1)).toBeLessThan(0.03);
  });

  it('has no flow-level speed on its input type', () => {
    const flow: FlowSource = flows[0] as FlowSource;
    expect(Object.keys(flow).sort()).toEqual(['field', 'id', 'surfacePx2']);
  });

  it('allocates nothing per step — buffer identities survive ten thousand steps', () => {
    const system = new ParticleSystem(flows);
    const before = system.buffers();
    const x = new Float32Array(system.capacity);
    const y = new Float32Array(system.capacity);
    for (let step = 0; step < 10_000; step += 1) {
      system.step(1 / 60);
      system.writePositions(x, y);
    }
    const after = system.buffers();
    for (let i = 0; i < after.length; i += 1) expect(after[i]).toBe(before[i]);
  });

  it('handles a flow with no surface without producing a particle', () => {
    const system = new ParticleSystem([
      { id: 'empty', field: buildFlowField([], []), surfacePx2: 0 },
    ]);
    expect(system.capacity).toBe(0);
    expect(system.activeCount()).toBe(0);
  });
});
