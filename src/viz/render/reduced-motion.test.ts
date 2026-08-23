import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawScene, type DrawOptions } from './draw-scene';
import { layoutScene } from './layout';
import { COPY } from './placeholders';
import { REDUCED_MOTION_NOTES, prefersReducedMotion, watchReducedMotion } from './reduced-motion';
import { Renderer, buildParticles } from './renderer';
import { composeOrThrow, microsoftFy2026 } from './reference-load';
import { RecordingContext, stubCanvas } from './testing/recording-context';
import type { FrameClockHost } from './rate-lock';

const VIEWPORT = { widthPx: 1440, heightPx: 900 };
const model = composeOrThrow(microsoftFy2026());

function options(overrides: Partial<DrawOptions> = {}): DrawOptions {
  return {
    effectsQuality: 1,
    particleX: new Float32Array(0),
    particleY: new Float32Array(0),
    particleCount: 0,
    highlightId: null,
    noteTextOverride: null,
    ...overrides,
  };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'matchMedia');
});

function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => ({
      matches,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

/**
 * Invariant 4.2: "a fully static, fully accurate rendering with identical information
 * content. An equivalent, not a lesser version."
 *
 * The equivalence is checked the hard way — every coordinate and every string compared
 * between the two paths — rather than asserted in a comment.
 */
describe('reduced motion — an equivalent, not a lesser version', () => {
  it('draws the identical geometry', () => {
    const scene = layoutScene(model, VIEWPORT);
    const moving = new RecordingContext();
    const still = new RecordingContext();
    drawScene(moving.as(), scene, options());
    drawScene(still.as(), scene, options({ noteTextOverride: REDUCED_MOTION_NOTES }));
    expect([...still.coordinates()].sort()).toEqual([...moving.coordinates()].sort());
  });

  it('writes the identical figures, differing only in the one motion note', () => {
    const scene = layoutScene(model, VIEWPORT);
    const moving = new RecordingContext();
    const still = new RecordingContext();
    drawScene(moving.as(), scene, options());
    drawScene(still.as(), scene, options({ noteTextOverride: REDUCED_MOTION_NOTES }));

    const movingTexts = moving.texts();
    const stillTexts = still.texts();
    expect(stillTexts).toHaveLength(movingTexts.length);
    const differences = stillTexts.filter((text, i) => text !== movingTexts[i]);
    expect(differences).toEqual([COPY.reducedMotion]);
    // Everything a reader is entitled to — every figure, every label — is still there.
    expect(stillTexts).toContain('$133,749M');
    expect(stillTexts).toContain('$21,488M');
    expect(stillTexts).toContain('Intelligent Cloud');
  });

  it('does not claim to be flowing when nothing is', () => {
    expect(REDUCED_MOTION_NOTES['baseline-flow']).toBe(COPY.reducedMotion);
    expect(COPY.reducedMotion).not.toContain('flow speed');
    expect(COPY.reducedMotion).toContain('Same figures, same geometry');
  });

  it('leaves the Scene byte-identical, so it is not a degradation rung', () => {
    stubCanvas();
    const host: FrameClockHost = { now: () => 0, requestFrame: () => 1, cancelFrame: () => {} };
    const animated = new Renderer({
      canvas: document.createElement('canvas'),
      model,
      viewport: VIEWPORT,
      host,
      reducedMotion: false,
    });
    const still = new Renderer({
      canvas: document.createElement('canvas'),
      model,
      viewport: VIEWPORT,
      host,
      reducedMotion: true,
    });
    expect(still.scene_()).toEqual(animated.scene_());
    expect(still.metrics().qualityLevel).toBe(animated.metrics().qualityLevel);
    animated.dispose();
    still.dispose();
  });

  it('renders at full particle density, not a thinned version', () => {
    stubCanvas();
    const host: FrameClockHost = { now: () => 0, requestFrame: () => 1, cancelFrame: () => {} };
    const still = new Renderer({
      canvas: document.createElement('canvas'),
      model,
      viewport: VIEWPORT,
      host,
      reducedMotion: true,
    });
    still.start();
    const expected = buildParticles(still.scene_()).activeCount();
    expect(still.metrics().particleCount).toBe(expected);
    expect(still.metrics().timeToFirstRenderMs).not.toBeNull();
    still.dispose();
  });

  it('renders once and never starts a clock', () => {
    stubCanvas();
    const requestFrame = vi.fn(() => 1);
    const still = new Renderer({
      canvas: document.createElement('canvas'),
      model,
      viewport: VIEWPORT,
      host: { now: () => 0, requestFrame, cancelFrame: () => {} },
      reducedMotion: true,
    });
    still.start();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(still.metrics().presentedFrames).toBe(0);
    still.dispose();
  });

  it('starts the clock when the preference is turned off at runtime', () => {
    stubCanvas();
    const requestFrame = vi.fn(() => 1);
    const renderer = new Renderer({
      canvas: document.createElement('canvas'),
      model,
      viewport: VIEWPORT,
      host: { now: () => 0, requestFrame, cancelFrame: () => {} },
      reducedMotion: true,
    });
    renderer.start();
    expect(requestFrame).not.toHaveBeenCalled();
    renderer.setReducedMotion(false);
    expect(requestFrame).toHaveBeenCalled();
    renderer.dispose();
  });
});

describe('detecting the preference', () => {
  it('reads the media query when one exists', () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('treats a missing API as no stated preference, not as a preference for stillness', () => {
    Reflect.deleteProperty(globalThis, 'matchMedia');
    expect(prefersReducedMotion()).toBe(false);
    expect(watchReducedMotion(() => {}).matches).toBe(false);
  });

  it('subscribes so toggling the OS setting does not need a reload', () => {
    const listeners: ((event: MediaQueryListEvent) => void)[] = [];
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => ({
        matches: false,
        addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.push(listener);
        },
        removeEventListener: () => {
          listeners.length = 0;
        },
      }),
    });
    const seen: boolean[] = [];
    const watcher = watchReducedMotion((reduced) => seen.push(reduced));
    listeners[0]?.({ matches: true } as MediaQueryListEvent);
    expect(seen).toEqual([true]);
    watcher.dispose();
    expect(listeners).toHaveLength(0);
  });
});
