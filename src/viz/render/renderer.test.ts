import { describe, expect, it, vi } from 'vitest';
import { MAX_BACKING_STORE_PX, Renderer } from './renderer';
import { composeOrThrow, microsoftFy2026, referenceLoad } from './reference-load';
import { stubCanvas, type RecordingContext } from './testing/recording-context';
import type { FrameClockHost } from './rate-lock';

const VIEWPORT = { widthPx: 1440, heightPx: 900 };

/** A vsync source under the test's control, with an injectable per-frame cost. */
function driver(displayHz = 60): FrameClockHost & {
  pump: (ticks: number) => void;
  costMs: number;
} {
  const intervalMs = 1000 / displayHz;
  let clockMs = 0;
  let pending: ((t: number) => void) | null = null;
  const host = {
    costMs: 0,
    now: () => {
      // Reading the clock inside a frame is what bills the frame's cost.
      const value = clockMs;
      clockMs += host.costMs;
      host.costMs = 0;
      return value;
    },
    requestFrame: (callback: (t: number) => void) => {
      pending = callback;
      return 1;
    },
    cancelFrame: () => {
      pending = null;
    },
    pump: (ticks: number) => {
      for (let i = 0; i < ticks; i += 1) {
        const callback = pending;
        if (callback === null) return;
        pending = null;
        clockMs += intervalMs;
        callback(clockMs);
      }
    },
  };
  return host;
}

function make(options: { model?: ReturnType<typeof composeOrThrow>; dpr?: number } = {}): {
  renderer: Renderer;
  canvas: HTMLCanvasElement;
  ctx: RecordingContext;
  host: ReturnType<typeof driver>;
  overlay: HTMLDivElement;
} {
  const ctx = stubCanvas();
  const canvas = document.createElement('canvas');
  const overlay = document.createElement('div');
  const host = driver();
  const renderer = new Renderer({
    canvas,
    overlay,
    model: options.model ?? composeOrThrow(microsoftFy2026()),
    viewport: VIEWPORT,
    host,
    ...(options.dpr === undefined ? {} : { devicePixelRatio: options.dpr }),
    reducedMotion: false,
  });
  return { renderer, canvas, ctx, host, overlay };
}

describe('Renderer — first render', () => {
  it('draws the whole picture on the first frame', () => {
    const { renderer, ctx, host } = make();
    renderer.start();
    host.pump(1);
    const texts = ctx.texts().join(' ');
    // Rivers, their revenue, their constrictions, the trunk, its residual, the lake.
    expect(texts).toContain('Productivity and Business Processes');
    expect(texts).toContain('$139.996B');
    // The mandatory constriction figure is drawn (0002 C2); the filer's category name for it
    // is not — that reads on hover now. The trunk's label stays, because 0002 C4 requires it.
    expect(texts).toContain('$25.017B');
    expect(texts).not.toContain('Cost of revenue');
    expect(texts).toContain('All segments combined');
    expect(texts).toContain('Taxes and non-operating items');
    expect(texts).toContain('$21.488B');
    expect(texts).toContain('$133.749B');
    expect(texts).toContain('FY2026');
    renderer.dispose();
  });

  it('reports time to first render', () => {
    const { renderer, host } = make();
    renderer.start();
    host.pump(1);
    expect(renderer.metrics().timeToFirstRenderMs).not.toBeNull();
    renderer.dispose();
  });

  it('draws the scale indicators, so the encoding is verifiable — 3.3', () => {
    const { renderer, ctx, host } = make();
    renderer.start();
    host.pump(1);
    const texts = ctx.texts().join(' ');
    // 3.3 asks the scale to state itself, and the statement is what does that in the
    // picture. The px/$ constant behind it is reference material for the analyst and reads
    // in the margin plate — `canvas-margin.test.tsx` asserts it arrives there.
    expect(texts).toContain('A river this wide carries');
    expect(texts).toContain('of net earnings');
    expect(texts).not.toContain('1 px = $1,000,000,000');
    renderer.dispose();
  });
});

describe('Renderer — device pixel ratio', () => {
  it('applies DPR as a transform and nothing else', () => {
    const { renderer, canvas, ctx } = make({ dpr: 2 });
    const transforms = ctx.ops('setTransform');
    expect(transforms[0]?.args).toEqual([2, 0, 0, 2, 0, 0]);
    expect(canvas.width).toBe(Math.ceil(renderer.scene_().contentWidthPx) * 2);
    expect(canvas.style.width).toBe(`${Math.ceil(renderer.scene_().contentWidthPx)}px`);
    renderer.dispose();
  });

  it('clamps DPR rather than failing to allocate, and says that it did', () => {
    // A canvas that cannot allocate is a blank screen. "No crashes on any machine of the
    // reference class or newer" is the standard, so the ceiling binds and is reported.
    const { renderer, canvas } = make({ model: composeOrThrow(referenceLoad(12)), dpr: 4 });
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(MAX_BACKING_STORE_PX);
    expect(renderer.metrics().devicePixelRatio).toBeLessThanOrEqual(2);
    renderer.dispose();
  });
});

describe('Renderer — the ladder in the loop', () => {
  it('stays at 60 and full quality while frames are cheap', () => {
    const { renderer, host } = make();
    renderer.start();
    for (let i = 0; i < 300; i += 1) {
      host.costMs = 2;
      host.pump(1);
    }
    expect(renderer.metrics().qualityLevel).toBe('full-60');
    expect(renderer.metrics().lockedHz).toBe(60);
    expect(renderer.metrics().observedLockedRates).toEqual([60]);
    renderer.dispose();
  });

  it('steps the rate to 30 before it touches particle density', () => {
    const { renderer, host } = make();
    renderer.start();
    const before = renderer.metrics().particleCount;
    for (let i = 0; i < 20; i += 1) {
      host.costMs = 28; // over 1.5x of 16.7ms, inside 1.5x of 33.3ms
      host.pump(1);
    }
    const metrics = renderer.metrics();
    expect(metrics.lockedHz).toBe(30);
    expect(metrics.qualityLevel).toBe('full-30');
    expect(metrics.particleCount).toBe(before);
    expect([...metrics.observedLockedRates].sort((a, b) => a - b)).toEqual([30, 60]);
    renderer.dispose();
  });

  it('only reduces density once the 30fps floor genuinely cannot hold', () => {
    const { renderer, host } = make();
    renderer.start();
    const before = renderer.metrics().particleCount;
    for (let i = 0; i < 60; i += 1) {
      host.costMs = 300;
      host.pump(1);
    }
    expect(renderer.metrics().qualityLevel).toBe('dpr-30');
    expect(renderer.metrics().particleCount).toBeLessThan(before);
    expect(renderer.metrics().lockedHz).toBe(30);
    renderer.dispose();
  });

  it('never presents at a rate that is not 60 or 30', () => {
    const { renderer, host, ctx } = make();
    renderer.start();
    for (let i = 0; i < 400; i += 1) {
      host.costMs = i % 90 < 45 ? 2 : 300;
      host.pump(1);
      // This test reads metrics, never draw calls; recording 400 frames of the
      // dressed scene (0038's world plus the glow re-traces) is heap it never uses.
      ctx.calls.length = 0;
    }
    for (const hz of renderer.metrics().observedLockedRates) expect([60, 30]).toContain(hz);
    expect(renderer.metrics().effectiveHz).toBe(
      renderer.metrics().displayHz / renderer.metrics().stride,
    );
    renderer.dispose();
  });
});

describe('Renderer — interaction is not gated on the frame', () => {
  it('commits hover feedback synchronously, with no frame in between', () => {
    const { renderer, overlay, host } = make();
    renderer.start();
    // Deliberately do NOT pump a frame. Feedback must already be on screen.
    const lane = renderer.scene_().rivers[0];
    const target = renderer.handlePointer((lane?.headX ?? 0) + 20, lane?.headCentreY ?? 0, 0);
    expect(target?.id).toBe(lane?.id);
    expect(overlay.dataset['visible']).toBe('true');
    expect(overlay.textContent).toContain('Productivity and Business Processes');
    // MILLIONS here, not the scaled form the canvas draws. Both are exact; the hover box
    // quotes the unit the filing quotes, so an analyst can find this figure on the page.
    expect(overlay.textContent).toContain('$139,996M');
    expect(host).toBeDefined();
    renderer.dispose();
  });

  it('records latency against the event timestamp, not a frame boundary', () => {
    const { renderer } = make();
    renderer.start();
    const lane = renderer.scene_().rivers[0];
    renderer.handlePointer((lane?.headX ?? 0) + 20, lane?.headCentreY ?? 0, performance.now());
    const latency = renderer.metrics().lastInteractionLatencyMs;
    expect(latency).not.toBeNull();
    expect(latency ?? 999).toBeLessThan(100);
    renderer.dispose();
  });

  it('clears the overlay when the pointer leaves everything', () => {
    const { renderer, overlay } = make();
    renderer.start();
    const lane = renderer.scene_().rivers[0];
    renderer.handlePointer((lane?.headX ?? 0) + 20, lane?.headCentreY ?? 0, 0);
    renderer.handlePointer(-1, -1, 0);
    expect(overlay.dataset['visible']).toBe('false');
    expect(overlay.textContent).toBe('');
    renderer.dispose();
  });

  it('notifies the host application on hover change, once per change', () => {
    stubCanvas();
    const onHover = vi.fn();
    const host = driver();
    const renderer = new Renderer({
      canvas: document.createElement('canvas'),
      model: composeOrThrow(microsoftFy2026()),
      viewport: VIEWPORT,
      host,
      onHover,
      reducedMotion: false,
    });
    const lane = renderer.scene_().rivers[0];
    renderer.handlePointer((lane?.headX ?? 0) + 20, lane?.headCentreY ?? 0, 0);
    renderer.handlePointer((lane?.headX ?? 0) + 21, lane?.headCentreY ?? 0, 0);
    expect(onHover).toHaveBeenCalledTimes(1);
    renderer.dispose();
  });
});

describe('Renderer — steady state allocates nothing', () => {
  it('holds the frame ring and particle pool at a fixed size over a long run', () => {
    const { renderer, host, ctx } = make({ model: composeOrThrow(referenceLoad(12)) });
    renderer.start();
    const capacity = renderer.metrics().particleCapacity;
    for (let i = 0; i < 3_000; i += 1) {
      host.costMs = 2;
      host.pump(1);
      ctx.calls.length = 0; // metrics-only test; see the rate test above
    }
    expect(renderer.metrics().particleCapacity).toBe(capacity);
    // The ring is bounded: 3,000 frames in, it still reports at most its own length.
    expect(renderer.frameSamples().intervalsMs.length).toBeLessThanOrEqual(1_800);
    renderer.dispose();
  });

  it('stops presenting after dispose, so a hidden tab costs nothing', () => {
    const { renderer, host } = make();
    renderer.start();
    host.pump(5);
    const presented = renderer.metrics().presentedFrames;
    renderer.dispose();
    host.pump(20);
    expect(renderer.metrics().presentedFrames).toBe(presented);
  });
});
