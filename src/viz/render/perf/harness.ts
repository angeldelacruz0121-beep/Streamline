/**
 * The performance harness.
 *
 * Built before anything was optimised, which is the order Forge's brief demands: you
 * cannot defend a floor you are not measuring, and an optimisation without a measurement
 * in front of it is a guess with extra steps.
 *
 * WHAT IT MEASURES, and why each one is separate:
 *
 *   Frame PACING — the interval between presented frames. This is the number Invariant
 *   4.1's percentile rules are written against, because pacing is what a viewer feels.
 *
 *   Frame COST — how long the draw callback itself took. Reported alongside pacing and
 *   never in place of it: a 4ms draw that misses vsync every third frame still looks
 *   broken, and only the pacing distribution shows that.
 *
 *   INTERACTION LATENCY — measured from a real, trusted pointer event's own timestamp to
 *   the moment hover feedback is committed to the DOM, inside the same event dispatch.
 *   Measured independently of the render rate because 4.1 says the two fail separately.
 *
 *   PARTICLE COUNT, BACKING STORE and HEAP — the resource side. Backing store in device
 *   pixels is the honest browser-visible proxy for GPU memory; there is no API that hands
 *   out the real figure, and inventing one would be worse than naming the proxy.
 *
 *   TIME TO FIRST RENDER — from `start()` to the first completed draw.
 *
 * Percentiles come from `budget.ts`. This module collects; it does not judge.
 */
import { Renderer } from '../renderer';
import type { Viewport } from '../scene';
import { uncappedModel } from './uncapped-model';
import { composeOrThrow, referenceLoad } from '../reference-load';
import type { InteractionMeasurement, RenderMeasurement, ResourceMeasurement } from './budget';

export interface HarnessOptions {
  /** Invariant 4.1 states the reference load as 12 segments. */
  readonly segments?: number;
  /** Bypass the 5–8 display cap and lay out every segment as its own lane. */
  readonly uncapped?: boolean;
  readonly viewport?: Viewport;
  /** Presented frames to collect before reporting. */
  readonly frames?: number;
  /** Upper bound in seconds, so a stalled run fails rather than hangs. */
  readonly timeoutSeconds?: number;
  /** Pin a rung of the degradation ladder, e.g. 1 to prove the 30fps floor. */
  readonly pinQualityRank?: number;
  readonly reducedMotion?: boolean;
  readonly devicePixelRatio?: number;
  /** Heap sampling period. Set with a long run to satisfy the 10-minute idle standard. */
  readonly heapSampleMs?: number;
  /**
   * Presented frames treated as startup and excluded from the steady-state distribution.
   *
   * Startup is real and is not being hidden: it is reported in full as
   * `timeToFirstRenderMs`, which Invariant 4.1 asks for as its own metric. What must not
   * happen is a first-paint cost — font resolution, the first backing-store allocation,
   * and the one stride change when display calibration completes — appearing in the
   * pacing percentiles as though it were a hitch during use. The window is fixed, small,
   * stated here, and reported in `meta.warmupFrames`.
   */
  readonly warmupFrames?: number;
}

export const DEFAULT_WARMUP_FRAMES = 30;

export interface HarnessResult {
  readonly render: RenderMeasurement;
  readonly interaction: InteractionMeasurement;
  readonly resources: ResourceMeasurement;
  readonly meta: {
    readonly segments: number;
    readonly lanes: number;
    readonly uncapped: boolean;
    readonly viewport: Viewport;
    readonly contentPx: { readonly width: number; readonly height: number };
    readonly qualityLevel: string;
    readonly reducedMotion: boolean;
    readonly userAgent: string;
    readonly durationMs: number;
    readonly warmupFrames: number;
  };
}

interface HeapCapableMemory {
  usedJSHeapSize: number;
}

function readHeapBytes(): number | null {
  const memory = (performance as unknown as { memory?: HeapCapableMemory }).memory;
  return memory === undefined ? null : memory.usedJSHeapSize;
}

/**
 * Mounts a renderer into `host` and returns handles the caller drives. The DOM wiring is
 * native rather than React on purpose: the harness must measure the renderer, not a
 * framework's event delegation.
 */
export class PerfHarness {
  readonly renderer: Renderer;
  readonly canvas: HTMLCanvasElement;
  readonly overlay: HTMLDivElement;
  readonly container: HTMLDivElement;
  private readonly latencies: number[] = [];
  private frameGated = false;
  private readonly heapSamples: number[] = [];
  private heapTimer: ReturnType<typeof setInterval> | null = null;
  private readonly startedAt: number;
  readonly lanes: number;
  readonly segments: number;
  readonly uncapped: boolean;
  readonly warmupFrames: number;

  constructor(host: HTMLElement, options: HarnessOptions = {}) {
    const segments = options.segments ?? 12;
    const uncapped = options.uncapped ?? false;
    const viewport = options.viewport ?? { widthPx: 1440, heightPx: 900 };

    // Two loads, both measured, because they cost differently and only one of them ships.
    // Capped is the real product path: 12 segments become 8 lanes plus one aggregate.
    // Uncapped is the honest worst case for lane count and is built by `uncapped-model.ts`
    // out of Cartographer's own exported functions — nothing in `src/viz/encoding` is
    // edited or bypassed, only the display cap is stepped around, and only here.
    const input = referenceLoad(segments);
    const model = uncapped ? uncappedModel(input) : composeOrThrow(input);
    this.segments = segments;
    this.uncapped = uncapped;
    this.warmupFrames = options.warmupFrames ?? DEFAULT_WARMUP_FRAMES;

    this.container = document.createElement('div');
    this.container.style.position = 'relative';
    this.container.style.width = `${viewport.widthPx}px`;
    this.container.style.height = `${viewport.heightPx}px`;
    this.container.style.overflow = 'auto';

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';

    this.overlay = document.createElement('div');
    this.overlay.dataset.visible = 'false';
    this.overlay.style.position = 'absolute';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.pointerEvents = 'none';

    this.container.append(this.canvas, this.overlay);
    host.append(this.container);

    this.renderer = new Renderer({
      canvas: this.canvas,
      model,
      viewport,
      overlay: this.overlay,
      ...(options.reducedMotion === undefined ? {} : { reducedMotion: options.reducedMotion }),
      ...(options.devicePixelRatio === undefined
        ? {}
        : { devicePixelRatio: options.devicePixelRatio }),
    });
    this.lanes = this.renderer.scene_().rivers.length;

    if (options.pinQualityRank !== undefined) this.renderer.pinQuality(options.pinQualityRank);

    // The latency probe. Runs inside the event dispatch, calls the renderer, then reads
    // the overlay back before returning. If the text is not there yet, feedback was
    // gated behind something — which is the 4.1 hard fail this flag exists to catch.
    // Same discipline the React component uses: the cached canvas origin is refreshed on
    // entry and on scroll, never inside the move handler.
    this.container.addEventListener('pointerenter', () => {
      this.renderer.refreshCanvasRect();
    });
    this.container.addEventListener(
      'scroll',
      () => {
        this.renderer.refreshCanvasRect();
      },
      { passive: true },
    );
    this.container.addEventListener(
      'pointermove',
      (event: PointerEvent) => {
        const target = this.renderer.handlePointer(event.clientX, event.clientY, event.timeStamp);
        const committed = this.overlay.dataset.visible === 'true';
        if (target !== null && !committed) this.frameGated = true;
        this.latencies.push(performance.now() - event.timeStamp);
      },
      { passive: true },
    );

    this.startedAt = performance.now();
    const period = options.heapSampleMs ?? 500;
    const initialHeap = readHeapBytes();
    if (initialHeap !== null) {
      this.heapSamples.push(initialHeap);
      this.heapTimer = setInterval(() => {
        const bytes = readHeapBytes();
        if (bytes !== null) this.heapSamples.push(bytes);
      }, period);
    }
  }

  start(): void {
    this.renderer.start();
  }

  dispose(): void {
    if (this.heapTimer !== null) clearInterval(this.heapTimer);
    this.heapTimer = null;
    this.renderer.dispose();
    this.container.remove();
  }

  /** Resolves once `frames` frames have been presented, or the timeout expires. */
  async collect(frames: number, timeoutSeconds: number): Promise<void> {
    const deadline = performance.now() + timeoutSeconds * 1000;
    const baseline = this.renderer.metrics().presentedFrames;
    return new Promise<void>((resolve) => {
      const poll = (): void => {
        const metrics = this.renderer.metrics();
        if (metrics.presentedFrames - baseline >= frames || performance.now() > deadline) {
          resolve();
          return;
        }
        setTimeout(poll, 32);
      };
      poll();
    });
  }

  result(): HarnessResult {
    const metrics = this.renderer.metrics();
    const samples = this.renderer.frameSamples();
    const scene = this.renderer.scene_();
    // See `warmupFrames`. Startup is measured, reported and excluded — not hidden.
    const skip = Math.min(this.warmupFrames, Math.max(0, samples.intervalsMs.length - 1));
    const intervalsMs = samples.intervalsMs.slice(skip);
    const costsMs = samples.costsMs.slice(skip);
    return {
      render: {
        lockedHz: metrics.lockedHz,
        effectiveHz: metrics.effectiveHz,
        displayHz: metrics.displayHz,
        stride: metrics.stride,
        observedLockedRates: metrics.observedLockedRates,
        frameIntervalsMs: intervalsMs,
        frameCostsMs: costsMs,
      },
      interaction: {
        latenciesMs: [...this.latencies],
        gatedOnFrame: this.frameGated,
      },
      resources: {
        particleCount: metrics.particleCount,
        backingStorePx: metrics.backingStorePx,
        timeToFirstRenderMs: metrics.timeToFirstRenderMs ?? 0,
        heapBytes: [...this.heapSamples],
      },
      meta: {
        segments: this.segments,
        lanes: this.lanes,
        uncapped: this.uncapped,
        viewport: scene.viewport,
        contentPx: { width: scene.contentWidthPx, height: scene.contentHeightPx },
        qualityLevel: metrics.qualityLevel,
        reducedMotion: metrics.reducedMotion,
        userAgent: typeof navigator === 'object' ? navigator.userAgent : 'unknown',
        durationMs: performance.now() - this.startedAt,
        warmupFrames: this.warmupFrames,
      },
    };
  }
}

/** One-shot: mount, run, report, tear down. This is what the Playwright spec calls. */
export async function runHarness(options: HarnessOptions = {}): Promise<HarnessResult> {
  const host = document.body;
  const harness = new PerfHarness(host, options);
  try {
    harness.start();
    await harness.collect(
      (options.frames ?? 600) + (options.warmupFrames ?? DEFAULT_WARMUP_FRAMES),
      options.timeoutSeconds ?? 30,
    );
    return harness.result();
  } finally {
    harness.dispose();
  }
}
