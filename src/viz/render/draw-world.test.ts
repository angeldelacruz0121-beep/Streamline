/**
 * The world painter's contract (decision 0038): draws under everything, and its
 * effects rung obeys the re-trace law so geometry invariance holds by construction.
 */
import { describe, expect, it } from 'vitest';
import { RecordingContext } from './testing/recording-context';
import { drawWorld } from './draw-world';
import { drawScene } from './draw-scene';
import { buildWorld } from './world';
import { layoutScene } from './layout';
import { composeOrThrow, microsoftFy2026 } from './reference-load';
import { NO_PARTICLES } from './draw-scene';

const VIEWPORT = { widthPx: 1440, heightPx: 900 } as const;
const scene = layoutScene(composeOrThrow(microsoftFy2026()), VIEWPORT);
const world = buildWorld(scene, '0000789019');

function draw(effectsQuality: number): RecordingContext {
  const ctx = new RecordingContext();
  drawWorld(ctx.as(), world, { effectsQuality });
  return ctx;
}

describe('the re-trace law at the world layer', () => {
  it('every quality rung emits the identical coordinate set', () => {
    const full = draw(1).coordinates();
    const degraded = draw(0).coordinates();
    expect(degraded).toEqual(full);
  });

  it('mist is drawn at every rung — it is picture, not effect', () => {
    for (const effectsQuality of [0, 1]) {
      const rects = draw(effectsQuality).ops('fillRect');
      // terrain + sky + one rect per mist band
      expect(rects.length).toBe(2 + world.mist.length);
    }
  });

  it('the effects rung adds strokes only, never fills', () => {
    const fullFills = draw(1).ops('fill').length;
    const degradedFills = draw(0).ops('fill').length;
    expect(fullFills).toBe(degradedFills);
    expect(draw(1).ops('stroke').length).toBeGreaterThan(draw(0).ops('stroke').length);
  });
});

describe('the world sits under everything data-bearing', () => {
  it('drawScene paints the world before any river, trunk, or lake geometry', () => {
    const ctx = new RecordingContext();
    drawScene(ctx.as(), scene, {
      effectsQuality: 1,
      highlightId: null,
      worldSeed: '0000789019',
      ...NO_PARTICLES,
    });
    const calls = ctx.calls;
    const firstFillRect = calls.findIndex((c) => c.op === 'fillRect');
    const firstPathFill = calls.findIndex((c) => c.op === 'fill');
    expect(firstFillRect).toBeGreaterThanOrEqual(0);
    expect(firstPathFill).toBeGreaterThanOrEqual(0);
    // The very first paint is the terrain rect, before any filled path geometry.
    expect(firstFillRect).toBeLessThan(firstPathFill);
  });

  it('the seed defaults deterministically when no company is mounted', () => {
    const a = new RecordingContext();
    const b = new RecordingContext();
    drawScene(a.as(), scene, { effectsQuality: 1, highlightId: null, ...NO_PARTICLES });
    drawScene(b.as(), scene, { effectsQuality: 1, highlightId: null, ...NO_PARTICLES });
    expect(a.coordinates()).toEqual(b.coordinates());
  });
});
