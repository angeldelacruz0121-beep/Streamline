/**
 * The frame clock. Its whole job is that the rate never floats.
 *
 * Invariant 4.1: "Locked rate — 60fps preferred; 30fps floor. Always a clean divisor of
 * display refresh — never floating." and "Hard fail — ... any unlocked/floating rate."
 *
 * HOW THE LOCK IS ENFORCED. The renderer never presents on an arbitrary schedule. It
 * counts vsync ticks and presents only on ticks whose index is an exact multiple of a
 * stride. A stride is an integer, so the presented rate is `displayHz / stride` — a clean
 * divisor of the display refresh by construction, not by arithmetic that happens to land
 * on one. There is no code path that computes a non-integer stride, which is why "the
 * renderer never floats between rates" is provable rather than observed.
 *
 * WHY `floor` AND NOT `round`. `stride = floor(displayHz / requestedHz)` can only ever
 * produce an effective rate at or ABOVE the requested one. `round` would take a 75Hz
 * panel asked for 30 down to 25 — under the floor — while looking like a locked rate.
 * The floor is a floor.
 *
 * THERMAL AND BATTERY SAVER, which is the same mechanism. When macOS Low Power Mode or a
 * thermal event halves the vsync rate, the browser simply delivers fewer callbacks. The
 * clock keeps a rolling estimate of the real presentation cadence, and when it moves it
 * re-resolves the stride against the new cadence. The rate stays a clean divisor of
 * whatever the machine is actually doing, so a throttled machine renders a locked 30
 * rather than an uneven 45. No crash and no stutter — it steps, and the step is logged.
 */

export type LockedHz = 60 | 30;

/** Panels the calibrator will snap to. Anything else falls back to the nearest of these. */
const KNOWN_REFRESH_HZ: readonly number[] = [30, 48, 50, 60, 75, 90, 100, 120, 144, 165, 240];

export interface FrameClockHost {
  now(): number;
  requestFrame(callback: (timeMs: number) => void): number;
  cancelFrame(handle: number): void;
}

export function browserHost(): FrameClockHost {
  return {
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => {
      cancelAnimationFrame(handle);
    },
  };
}

export function snapRefreshHz(measuredHz: number): number {
  let best = KNOWN_REFRESH_HZ[0] as number;
  let bestDistance = Infinity;
  for (const candidate of KNOWN_REFRESH_HZ) {
    const distance = Math.abs(candidate - measuredHz);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/** The only place a stride is produced. Integer, always; never below the request. */
export function resolveStride(displayHz: number, requestedHz: LockedHz): number {
  return Math.max(1, Math.floor(displayHz / requestedHz));
}

export function effectiveHz(displayHz: number, stride: number): number {
  return displayHz / stride;
}

export interface PresentedFrame {
  /** Milliseconds since the previous presented frame. Pacing, per Invariant 4.1. */
  readonly intervalMs: number;
  readonly lockedHz: LockedHz;
  readonly effectiveHz: number;
  readonly timeMs: number;
}

export interface RateChange {
  readonly fromHz: number;
  readonly toHz: number;
  readonly displayHz: number;
  readonly stride: number;
  readonly reason: string;
  readonly atFrame: number;
}

/** Vsync samples used to estimate the panel cadence before the first present. */
const CALIBRATION_TICKS = 12;
/** Rolling window used to notice a throttle after calibration. */
const CADENCE_WINDOW = 60;

export class FrameClock {
  private readonly host: FrameClockHost;
  private readonly onFrame: (dtSec: number, frame: PresentedFrame) => void;
  private handle: number | null = null;
  private tick = 0;
  private presented = 0;
  private lastTickMs: number | null = null;
  private lastPresentMs: number | null = null;
  private requestedHz: LockedHz = 60;
  private displayHz = 60;
  private stride = 1;
  private calibrationSamples: number[] = [];
  private cadenceSamples: number[] = [];
  private readonly rateLog: RateChange[] = [];
  /** Cost of the most recent presented frame, in ms. Read by the degradation controller. */
  lastCostMs = 0;
  /** Interval preceding the most recent presented frame, in ms. */
  lastIntervalMs = 0;

  constructor(host: FrameClockHost, onFrame: (dtSec: number, frame: PresentedFrame) => void) {
    this.host = host;
    this.onFrame = onFrame;
  }

  start(): void {
    if (this.handle !== null) return;
    this.lastTickMs = null;
    this.schedule();
  }

  stop(): void {
    if (this.handle === null) return;
    this.host.cancelFrame(this.handle);
    this.handle = null;
  }

  running(): boolean {
    return this.handle !== null;
  }

  getLockedHz(): LockedHz {
    return this.requestedHz;
  }

  getEffectiveHz(): number {
    return effectiveHz(this.displayHz, this.stride);
  }

  getStride(): number {
    return this.stride;
  }

  getDisplayHz(): number {
    return this.displayHz;
  }

  rateChanges(): readonly RateChange[] {
    return this.rateLog;
  }

  presentedFrames(): number {
    return this.presented;
  }

  /** The only way the rate ever changes. 60 or 30; nothing between them exists. */
  setLockedHz(hz: LockedHz, reason: string): void {
    if (hz === this.requestedHz) return;
    this.requestedHz = hz;
    this.applyStride(reason);
  }

  private applyStride(reason: string): void {
    const before = this.getEffectiveHz();
    const next = resolveStride(this.displayHz, this.requestedHz);
    if (next === this.stride) return;
    this.stride = next;
    // Restart the tick phase so the next presentation is exactly one full stride away.
    // Without this the change lands on whatever phase the old counter happened to be in
    // and the transition frame is arbitrarily short or long for no reason.
    this.tick = 0;
    this.rateLog.push({
      fromHz: before,
      toHz: this.getEffectiveHz(),
      displayHz: this.displayHz,
      stride: this.stride,
      reason,
      atFrame: this.presented,
    });
  }

  private schedule(): void {
    this.handle = this.host.requestFrame((timeMs) => {
      this.handle = null;
      this.onTick(timeMs);
      if (this.handle === null) this.schedule();
    });
  }

  private onTick(timeMs: number): void {
    const previous = this.lastTickMs;
    this.lastTickMs = timeMs;
    if (previous !== null) {
      const delta = timeMs - previous;
      if (delta > 0 && delta < 200) this.observeCadence(delta);
    }

    this.tick += 1;
    if (this.tick % this.stride !== 0) return;

    const presentAt = timeMs;
    const intervalMs =
      this.lastPresentMs === null ? 1000 / this.getEffectiveHz() : presentAt - this.lastPresentMs;
    this.lastPresentMs = presentAt;
    const dtSec = Math.min(0.25, intervalMs / 1000);

    const start = this.host.now();
    this.onFrame(dtSec, {
      intervalMs,
      lockedHz: this.requestedHz,
      effectiveHz: this.getEffectiveHz(),
      timeMs: presentAt,
    });
    this.lastCostMs = this.host.now() - start;
    this.lastIntervalMs = intervalMs;
    this.presented += 1;
  }

  private observeCadence(deltaMs: number): void {
    if (this.calibrationSamples.length < CALIBRATION_TICKS) {
      this.calibrationSamples.push(deltaMs);
      if (this.calibrationSamples.length === CALIBRATION_TICKS) {
        this.displayHz = snapRefreshHz(1000 / median(this.calibrationSamples));
        this.applyStride('calibrated display refresh');
      }
      return;
    }
    this.cadenceSamples.push(deltaMs);
    if (this.cadenceSamples.length < CADENCE_WINDOW) return;
    const observed = snapRefreshHz(1000 / median(this.cadenceSamples));
    this.cadenceSamples = [];
    if (observed !== this.displayHz) {
      this.displayHz = observed;
      this.applyStride('display cadence changed (thermal, battery saver, or panel switch)');
    }
  }
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}
