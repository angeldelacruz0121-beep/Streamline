/**
 * The renderer: clock, ladder, particles, draw pass and hit index, wired together.
 *
 * Three things in here are load-bearing against Invariant 4.1 and are worth finding fast.
 *
 * INPUT IS NEVER GATED ON THE FRAME. `handlePointer` runs the hit test and commits hover
 * feedback to a DOM overlay synchronously, inside the event dispatch. The canvas
 * highlight follows on the next presented frame, but by then the user has already been
 * answered. 4.1 calls any interaction gated behind the render loop a hard fail, and this
 * is the structural answer to it: the two paths share a data structure and share no
 * scheduling.
 *
 * DEVICE PIXEL RATIO CHANGES THE BACKING STORE, NEVER THE GEOMETRY. All coordinates are
 * CSS pixels. DPR is applied once, as a `setTransform` scale on the context. So the
 * bottom rung of the degradation ladder cannot move a river by a fraction of a pixel,
 * which is the only reason "geometry accuracy is never degraded" can survive a DPR lever
 * at all.
 *
 * NOTHING IS ALLOCATED PER FRAME. The particle output buffers, the frame-time ring and
 * the draw options object are created once at construction and mutated in place. That is
 * what the ten-minute idle measurement is testing, and it is easier to hold by
 * construction than to chase later.
 */
import type { CanvasModel } from '../encoding';
import { ParticleSystem, buildFlowField, type FlowSource } from '../particles';
import { DegradationController, levelByRank, type QualityLevel } from './degradation';
import { drawScene, type DrawOptions } from './draw-scene';
import type { Ctx2D } from './draw-primitives';
import { buildHitIndex, hitTest, type HitIndex, type HitTarget } from './hit-test';
import { layoutScene } from './layout';
import { FrameClock, browserHost, type FrameClockHost, type LockedHz } from './rate-lock';
import { prefersReducedMotion } from './reduced-motion';
import type { Scene, Viewport } from './scene';

/**
 * Ceiling on the canvas backing store, in device pixels. A 2020 MacBook Air will happily
 * allocate more, but a canvas that fails to allocate is a blank screen, and "no crashes on
 * any machine of the reference class or newer" is the standard. When the ceiling binds,
 * DPR is clamped and `dprClampedByMemory` is reported — it is a finding, not a silent fix.
 */
export const MAX_BACKING_STORE_PX = 16_000_000;

/** Frames retained for the percentile view. 30s at 60fps. */
const FRAME_RING = 1800;

export interface RendererMetrics {
  readonly presentedFrames: number;
  readonly lockedHz: LockedHz;
  readonly effectiveHz: number;
  readonly displayHz: number;
  readonly stride: number;
  readonly qualityLevel: QualityLevel['id'];
  readonly particleCount: number;
  readonly particleCapacity: number;
  readonly devicePixelRatio: number;
  readonly backingStorePx: number;
  readonly dprClampedByMemory: boolean;
  readonly timeToFirstRenderMs: number | null;
  readonly lastInteractionLatencyMs: number | null;
  readonly reducedMotion: boolean;
  /** Every distinct locked rate this renderer has presented at. Should be {60} or {60,30}. */
  readonly observedLockedRates: readonly number[];
}

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly model: CanvasModel;
  readonly viewport: Viewport;
  /** Element whose text is committed synchronously on hover. Latency lives here. */
  readonly overlay?: HTMLElement | null;
  readonly host?: FrameClockHost;
  /** Overrides the media query. Used by the harness and by tests. */
  readonly reducedMotion?: boolean;
  readonly devicePixelRatio?: number;
  readonly onHover?: (target: HitTarget | null) => void;
  /** World scenery seed (0038): the filer's CIK string. Identity only, never a figure. */
  readonly worldSeed?: string;
}

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: Ctx2D;
  private readonly overlay: HTMLElement | null;
  /**
   * The overlay's row elements, resolved once and then written by `.textContent` only.
   *
   * Null means the overlay has no rows — the perf harness builds a bare div, and so does any
   * embedder that mounts the renderer without the React component. That case falls back to
   * the single-line write this overlay has always done, which is why adding rows cannot
   * regress the Invariant 4.1 latency gate.
   */
  private overlayRows: {
    readonly label: HTMLElement;
    readonly value: HTMLElement;
    readonly detail: readonly HTMLElement[];
  } | null = null;
  private overlayRowsResolved = false;
  private readonly onHover: ((target: HitTarget | null) => void) | null;
  private readonly clock: FrameClock;
  private readonly controller = new DegradationController();
  private readonly frameIntervals = new Float64Array(FRAME_RING);
  private readonly frameCosts = new Float64Array(FRAME_RING);
  private frameWrite = 0;
  private frameFilled = 0;
  private readonly observedLockedRates = new Set<number>();

  private model: CanvasModel;
  private scene: Scene;
  private hitIndex: HitIndex;
  private particles: ParticleSystem;
  private outX: Float32Array;
  private outY: Float32Array;
  private drawOptions: {
    effectsQuality: number;
    particleX: Float32Array;
    particleY: Float32Array;
    particleCount: number;
    highlightId: string | null;
    worldSeed: string;
  };

  private requestedDpr: number;
  private appliedDpr = 1;
  private dprClampedByMemory = false;
  private reducedMotion: boolean;
  private startedAtMs: number | null = null;
  private timeToFirstRenderMs: number | null = null;
  private lastInteractionLatencyMs: number | null = null;
  private hovered: HitTarget | null = null;
  private disposed = false;
  private canvasRect: { left: number; top: number } | null = null;

  constructor(options: RendererOptions) {
    this.canvas = options.canvas;
    const context = options.canvas.getContext('2d', { alpha: false });
    if (context === null) throw new Error('Canvas 2D context unavailable.');
    this.ctx = context;
    this.overlay = options.overlay ?? null;
    this.onHover = options.onHover ?? null;
    this.model = options.model;
    this.reducedMotion = options.reducedMotion ?? prefersReducedMotion();
    this.requestedDpr =
      options.devicePixelRatio ??
      (typeof globalThis.devicePixelRatio === 'number' ? globalThis.devicePixelRatio : 1);

    this.scene = layoutScene(this.model, options.viewport);
    this.hitIndex = buildHitIndex(this.scene);
    this.particles = buildParticles(this.scene);
    this.outX = new Float32Array(this.particles.capacity);
    this.outY = new Float32Array(this.particles.capacity);
    this.drawOptions = {
      effectsQuality: 1,
      particleX: this.outX,
      particleY: this.outY,
      particleCount: 0,
      highlightId: null,
      worldSeed: options.worldSeed ?? 'no-company',
    };

    this.clock = new FrameClock(options.host ?? browserHost(), (dtSec) => {
      this.frame(dtSec);
    });
    this.applyBackingStore();
  }

  scene_(): Scene {
    return this.scene;
  }

  metrics(): RendererMetrics {
    return {
      presentedFrames: this.clock.presentedFrames(),
      lockedHz: this.clock.getLockedHz(),
      effectiveHz: this.clock.getEffectiveHz(),
      displayHz: this.clock.getDisplayHz(),
      stride: this.clock.getStride(),
      qualityLevel: this.controller.level().id,
      particleCount: this.particles.activeCount(),
      particleCapacity: this.particles.capacity,
      devicePixelRatio: this.appliedDpr,
      backingStorePx: this.canvas.width * this.canvas.height,
      dprClampedByMemory: this.dprClampedByMemory,
      timeToFirstRenderMs: this.timeToFirstRenderMs,
      lastInteractionLatencyMs: this.lastInteractionLatencyMs,
      reducedMotion: this.reducedMotion,
      observedLockedRates: [...this.observedLockedRates],
    };
  }

  /** Presented frame intervals, oldest first. Copied out; the ring itself never grows. */
  frameSamples(): { intervalsMs: number[]; costsMs: number[] } {
    const intervalsMs: number[] = [];
    const costsMs: number[] = [];
    const count = this.frameFilled;
    for (let i = 0; i < count; i += 1) {
      const index = (this.frameWrite - count + i + FRAME_RING) % FRAME_RING;
      intervalsMs.push(this.frameIntervals[index] as number);
      costsMs.push(this.frameCosts[index] as number);
    }
    return { intervalsMs, costsMs };
  }

  start(): void {
    if (this.disposed) return;
    this.startedAtMs ??= performanceNow();
    if (this.reducedMotion) {
      // Invariant 4.2: an equivalent, not a lesser version. One complete draw, at full
      // density, with the same geometry — then no clock at all.
      this.frame(0);
      return;
    }
    this.clock.start();
  }

  stop(): void {
    this.clock.stop();
  }

  dispose(): void {
    this.disposed = true;
    this.clock.stop();
  }

  setReducedMotion(reduced: boolean): void {
    if (reduced === this.reducedMotion) return;
    this.reducedMotion = reduced;
    if (reduced) {
      this.clock.stop();
      this.frame(0);
    } else if (!this.disposed) {
      this.clock.start();
    }
  }

  /** Relayout. Geometry is recomputed from the model; no quantity is reused stale. */
  setModel(model: CanvasModel, viewport: Viewport): void {
    this.model = model;
    this.relayout(viewport);
  }

  resize(viewport: Viewport, devicePixelRatio?: number): void {
    if (devicePixelRatio !== undefined) this.requestedDpr = devicePixelRatio;
    this.relayout(viewport);
  }

  private relayout(viewport: Viewport): void {
    this.scene = layoutScene(this.model, viewport);
    this.hitIndex = buildHitIndex(this.scene);
    this.particles = buildParticles(this.scene);
    this.particles.setDensityScale(this.controller.level().densityScale);
    if (this.particles.capacity > this.outX.length) {
      this.outX = new Float32Array(this.particles.capacity);
      this.outY = new Float32Array(this.particles.capacity);
      this.drawOptions.particleX = this.outX;
      this.drawOptions.particleY = this.outY;
    }
    this.applyBackingStore();
    this.canvasRect = null;
    if (this.reducedMotion) this.frame(0);
  }

  private applyBackingStore(): void {
    const cssW = Math.max(1, Math.ceil(this.scene.contentWidthPx));
    const cssH = Math.max(1, Math.ceil(this.scene.contentHeightPx));
    const level = this.controller.level();
    let dpr = Math.max(1, Math.min(this.requestedDpr, level.maxDpr));
    this.dprClampedByMemory = false;
    while (dpr > 1 && cssW * dpr * cssH * dpr > MAX_BACKING_STORE_PX) {
      dpr = Math.max(1, dpr - 0.25);
      this.dprClampedByMemory = true;
    }
    this.appliedDpr = dpr;
    this.canvas.width = Math.ceil(cssW * dpr);
    this.canvas.height = Math.ceil(cssH * dpr);
    if (this.canvas.style !== undefined) {
      this.canvas.style.width = `${cssW}px`;
      this.canvas.style.height = `${cssH}px`;
    }
    // The one and only place DPR touches drawing. Everything downstream is CSS pixels.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Caches the canvas origin so `handlePointer` never calls `getBoundingClientRect`.
   *
   * This is not a micro-optimisation, it is a correctness fix for Invariant 4.1's input
   * standard. `getBoundingClientRect` forces a synchronous style and layout flush, and
   * calling it inside a pointer handler that has just written to the overlay is textbook
   * layout thrash. Measured: a burst of 30 pointer events cost exactly one dropped display
   * tick before this change. Refreshed once per presented frame and on demand, so the
   * input path reads two cached numbers and touches no layout at all.
   */
  refreshCanvasRect(): void {
    if (typeof this.canvas.getBoundingClientRect !== 'function') return;
    const rect = this.canvas.getBoundingClientRect();
    this.canvasRect = { left: rect.left, top: rect.top };
  }

  private frame(dtSec: number): void {
    this.refreshCanvasRect();
    if (dtSec > 0) this.particles.step(dtSec);
    this.drawOptions.particleCount = this.particles.writePositions(this.outX, this.outY);
    this.drawOptions.highlightId = this.hovered === null ? null : this.hovered.id;
    drawScene(this.ctx, this.scene, this.drawOptions as DrawOptions);

    if (this.timeToFirstRenderMs === null) {
      this.timeToFirstRenderMs = performanceNow() - (this.startedAtMs ?? performanceNow());
    }
    if (dtSec === 0) return;

    this.observedLockedRates.add(this.clock.getLockedHz());
    const index = this.frameWrite;
    this.frameIntervals[index] = this.clock.lastIntervalMs;
    this.frameCosts[index] = this.clock.lastCostMs;
    this.frameWrite = (index + 1) % FRAME_RING;
    if (this.frameFilled < FRAME_RING) this.frameFilled += 1;

    const before = this.controller.level();
    const after = this.controller.observe(this.clock.lastCostMs);
    if (after.id !== before.id) this.applyLevel(after);
  }

  private applyLevel(level: QualityLevel): void {
    this.clock.setLockedHz(level.lockedHz, `degradation ladder -> ${level.id}`);
    this.particles.setDensityScale(level.densityScale);
    this.drawOptions.effectsQuality = level.effectsQuality;
    this.applyBackingStore();
  }

  /** Harness and test hook. Pins a rung without waiting for the ladder to walk there. */
  pinQuality(rank: number): QualityLevel {
    const level = this.controller.pin(rank);
    this.applyLevel(level);
    return levelByRank(rank);
  }

  /**
   * SYNCHRONOUS. Runs inside the event dispatch, touches no canvas state, and commits
   * hover feedback to the overlay before returning. Latency is measured against the
   * event's own timestamp, not against a frame boundary.
   */
  private resolveOverlayRows(): void {
    // Once per renderer, never on the input path after the first move. `querySelector` is a
    // tree walk, not a layout read, so it forces no reflow even on that first call.
    this.overlayRowsResolved = true;
    const overlay = this.overlay;
    if (overlay === null || typeof overlay.querySelector !== 'function') return;
    const label = overlay.querySelector('[data-overlay-row="label"]');
    const value = overlay.querySelector('[data-overlay-row="value"]');
    if (label === null || value === null) return;
    this.overlayRows = {
      label: label as HTMLElement,
      value: value as HTMLElement,
      detail: Array.from(overlay.querySelectorAll('[data-overlay-row="detail"]')) as HTMLElement[],
    };
  }

  handlePointer(clientX: number, clientY: number, eventTimeMs?: number): HitTarget | null {
    if (this.canvasRect === null) this.refreshCanvasRect();
    const origin = this.canvasRect ?? { left: 0, top: 0 };
    const x = clientX - origin.left;
    const y = clientY - origin.top;
    const target = hitTest(this.hitIndex, x, y);
    if (target?.id !== this.hovered?.id) {
      this.hovered = target;
      if (this.overlay !== null) {
        if (!this.overlayRowsResolved) this.resolveOverlayRows();
        const rows = this.overlayRows;
        if (rows === null) {
          this.overlay.textContent = target === null ? '' : `${target.label} — ${target.valueText}`;
        } else {
          rows.label.textContent = target === null ? '' : target.label;
          rows.value.textContent = target === null ? '' : target.valueText;
          for (let i = 0; i < rows.detail.length; i += 1) {
            const row = rows.detail[i] as HTMLElement;
            row.textContent = target === null ? '' : (target.detail[i] ?? '');
          }
        }
        this.overlay.style.transform = `translate(${x}px, ${y}px)`;
        this.overlay.dataset.visible = target === null ? 'false' : 'true';
        this.overlay.dataset.kind = target === null ? '' : target.kind;
        // Which way the box opens. Two comparisons against numbers already on the scene —
        // no element measurement, no `getBoundingClientRect`, nothing that reads layout.
        // CSS resolves the actual offset against the box's own rendered size, so the browser
        // does the measuring for free and the box always opens toward the content centre.
        this.overlay.dataset.flip = x > this.scene.contentWidthPx / 2 ? 'left' : 'right';
        this.overlay.dataset.vflip = y > this.scene.contentHeightPx / 2 ? 'up' : 'down';
      }
      if (this.onHover !== null) this.onHover(target);
    }
    if (eventTimeMs !== undefined) this.lastInteractionLatencyMs = performanceNow() - eventTimeMs;
    return target;
  }
}

function performanceNow(): number {
  return typeof performance === 'object' ? performance.now() : Date.now();
}

/**
 * Every flow on the canvas becomes one particle source. The trunk is in the list on the
 * same terms as a river, so the areal density is genuinely global.
 */
export function buildParticles(scene: Scene): ParticleSystem {
  const flows: FlowSource[] = scene.rivers.map((lane) => ({
    id: lane.id,
    field: buildFlowField(lane.banks.top, lane.banks.bottom),
    surfacePx2: lane.surfacePx2,
  }));
  flows.push({
    id: 'trunk',
    field: buildFlowField(scene.trunk.banks.top, scene.trunk.banks.bottom),
    surfacePx2: scene.trunk.surfacePx2,
  });
  return new ParticleSystem(flows);
}
