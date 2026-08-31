import { describe, expect, it } from 'vitest';
import { QUALITY_LADDER } from './degradation';
import { drawScene, type DrawOptions } from './draw-scene';
import { layoutScene } from './layout';
import { Renderer } from './renderer';
import { composeOrThrow, microsoftFy2026, referenceLoad } from './reference-load';
import { RecordingContext, stubCanvas } from './testing/recording-context';
import type { FrameClockHost } from './rate-lock';

const VIEWPORT = { widthPx: 1440, heightPx: 900 };

/** A clock that never fires. Geometry is a property of layout, not of time. */
const idleHost: FrameClockHost = {
  now: () => 0,
  requestFrame: () => 1,
  cancelFrame: () => {},
};

function optionsAt(level: (typeof QUALITY_LADDER)[number]): DrawOptions {
  return {
    effectsQuality: level.effectsQuality,
    // Particles are excluded from the geometry comparison on purpose: their count IS the
    // lever the ladder pulls, and Invariant 4.1 permits exactly that. What may not move
    // is the geometry underneath them.
    particleX: new Float32Array(0),
    particleY: new Float32Array(0),
    particleCount: 0,
    highlightId: null,
  };
}

/**
 * Invariant 4.1: "Geometry accuracy is never degraded, at any framerate, for any reason.
 * It is not a lever and it is not on this ladder."
 *
 * The structural argument is that `layoutScene` does not take a quality level as a
 * parameter, so there is no path by which one could reach a coordinate. These tests are
 * the empirical half of the same claim, run at every rung.
 */
describe('geometry invariance across the degradation ladder', () => {
  const model = composeOrThrow(microsoftFy2026());

  it('draws the identical coordinate set at every quality level', () => {
    const scene = layoutScene(model, VIEWPORT);
    const signatures = QUALITY_LADDER.map((level) => {
      const ctx = new RecordingContext();
      drawScene(ctx.as(), scene, optionsAt(level));
      return ctx.coordinates();
    });
    const first = signatures[0] as Set<string>;
    for (const signature of signatures) {
      expect([...signature].sort()).toEqual([...first].sort());
    }
  });

  it('writes the identical figures at every quality level', () => {
    const scene = layoutScene(model, VIEWPORT);
    const texts = QUALITY_LADDER.map((level) => {
      const ctx = new RecordingContext();
      drawScene(ctx.as(), scene, optionsAt(level));
      return ctx.texts();
    });
    const first = texts[0];
    for (const set of texts) expect(set).toEqual(first);
    expect(first?.join(' ')).toContain('$133.749B');
    expect(first?.join(' ')).toContain('$21.488B');
  });

  it('produces a byte-identical Scene at every pinned rung, through the renderer', () => {
    const scenes = QUALITY_LADDER.map((level) => {
      stubCanvas();
      const renderer = new Renderer({
        canvas: document.createElement('canvas'),
        model,
        viewport: VIEWPORT,
        host: idleHost,
        devicePixelRatio: 2,
      });
      renderer.pinQuality(level.rank);
      const scene = renderer.scene_();
      renderer.dispose();
      return scene;
    });
    const first = scenes[0];
    for (const scene of scenes) expect(scene).toEqual(first);
  });

  it('changes only the backing store when DPR is the lever', () => {
    // The bottom rung of the ladder. It must move the canvas resolution and nothing else.
    stubCanvas();
    const canvas = document.createElement('canvas');
    const renderer = new Renderer({
      canvas,
      model,
      viewport: VIEWPORT,
      host: idleHost,
      devicePixelRatio: 2,
    });
    const sceneAtFullDpr = renderer.scene_();
    const widthAtFullDpr = canvas.width;
    expect(renderer.metrics().devicePixelRatio).toBe(2);

    renderer.pinQuality(4);
    expect(renderer.metrics().devicePixelRatio).toBe(1);
    expect(canvas.width).toBe(Math.ceil(widthAtFullDpr / 2));
    // The scene — every coordinate in CSS pixels — is untouched.
    expect(renderer.scene_()).toEqual(sceneAtFullDpr);
    renderer.dispose();
  });

  it('holds at the 12-segment reference load too', () => {
    const reference = composeOrThrow(referenceLoad(12));
    const scene = layoutScene(reference, VIEWPORT);
    const base = new RecordingContext();
    drawScene(base.as(), scene, optionsAt(QUALITY_LADDER[0] as (typeof QUALITY_LADDER)[number]));
    const floorLevel = QUALITY_LADDER[QUALITY_LADDER.length - 1] as (typeof QUALITY_LADDER)[number];
    const degraded = new RecordingContext();
    drawScene(degraded.as(), scene, optionsAt(floorLevel));
    expect([...degraded.coordinates()].sort()).toEqual([...base.coordinates()].sort());
    expect(degraded.texts()).toEqual(base.texts());
  });

  it('keeps every quantitative width identical while particle count collapses', () => {
    stubCanvas();
    const renderer = new Renderer({
      canvas: document.createElement('canvas'),
      model: composeOrThrow(referenceLoad(12)),
      viewport: VIEWPORT,
      host: idleHost,
    });
    const widthsAtFull = renderer.scene_().rivers.map((lane) => lane.headWidthPx);
    const particlesAtFull = renderer.metrics().particleCount;
    renderer.pinQuality(4);
    const widthsAtFloor = renderer.scene_().rivers.map((lane) => lane.headWidthPx);
    const particlesAtFloor = renderer.metrics().particleCount;

    expect(widthsAtFloor).toEqual(widthsAtFull);
    expect(particlesAtFloor).toBeLessThan(particlesAtFull);
    // And the pool never grew, so degradation costs no memory.
    expect(renderer.metrics().particleCapacity).toBe(particlesAtFull);
    renderer.dispose();
  });
});
