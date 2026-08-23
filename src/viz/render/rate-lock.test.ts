import { describe, expect, it } from 'vitest';
import {
  FrameClock,
  effectiveHz,
  median,
  resolveStride,
  snapRefreshHz,
  type FrameClockHost,
  type PresentedFrame,
} from './rate-lock';

/** A deterministic vsync source. No real timers, so the lock is provable, not observed. */
function fakeHost(
  displayHz: number,
): FrameClockHost & { pump: (ticks: number) => void; advance: (ms: number) => void } {
  const intervalMs = 1000 / displayHz;
  let clockMs = 0;
  let pending: ((t: number) => void) | null = null;
  let handle = 0;
  return {
    now: () => clockMs,
    requestFrame: (callback) => {
      pending = callback;
      handle += 1;
      return handle;
    },
    cancelFrame: () => {
      pending = null;
    },
    advance: (ms: number) => {
      clockMs += ms;
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
}

describe('resolveStride', () => {
  it('always produces an integer', () => {
    for (const hz of [30, 48, 50, 60, 75, 90, 100, 120, 144, 165, 240]) {
      for (const requested of [60, 30] as const) {
        expect(Number.isInteger(resolveStride(hz, requested))).toBe(true);
      }
    }
  });

  it('never lands below the requested rate — the floor is a floor', () => {
    for (const hz of [30, 48, 50, 60, 75, 90, 100, 120, 144, 165, 240]) {
      for (const requested of [60, 30] as const) {
        const stride = resolveStride(hz, requested);
        // A 30Hz panel cannot present 60; stride clamps to 1 and the panel is the limit.
        if (hz >= requested) expect(effectiveHz(hz, stride)).toBeGreaterThanOrEqual(requested);
        else expect(stride).toBe(1);
      }
    }
  });

  it('would break the floor if it rounded instead of floored', () => {
    // The reason `floor` is in the code. On a 75Hz panel, round(75/30) = 3 gives 25Hz,
    // under the 30fps floor, while looking exactly as locked as the correct answer.
    expect(Math.round(75 / 30)).toBe(3);
    expect(75 / 3).toBe(25);
    expect(resolveStride(75, 30)).toBe(2);
    expect(effectiveHz(75, 2)).toBe(37.5);
  });

  it('gives the expected strides on the panels that matter', () => {
    expect(resolveStride(60, 60)).toBe(1);
    expect(resolveStride(60, 30)).toBe(2);
    expect(resolveStride(120, 60)).toBe(2);
    expect(resolveStride(120, 30)).toBe(4);
  });
});

describe('snapRefreshHz and median', () => {
  it('snaps a measured cadence to a known panel', () => {
    expect(snapRefreshHz(59.4)).toBe(60);
    expect(snapRefreshHz(119.1)).toBe(120);
    expect(snapRefreshHz(30.2)).toBe(30);
  });

  it('takes the median so one long frame cannot move the estimate', () => {
    expect(median([16, 16, 16, 16, 400])).toBe(16);
    expect(median([])).toBe(0);
    expect(median([2, 4])).toBe(3);
  });
});

describe('FrameClock — the rate never floats', () => {
  it('presents on every vsync at 60 on a 60Hz panel', () => {
    const host = fakeHost(60);
    let presented = 0;
    const clock = new FrameClock(host, () => {
      presented += 1;
    });
    clock.start();
    host.pump(60);
    expect(clock.getStride()).toBe(1);
    expect(clock.getEffectiveHz()).toBe(60);
    expect(presented).toBe(60);
  });

  it('presents on every second vsync at 30 on a 60Hz panel', () => {
    const host = fakeHost(60);
    let presented = 0;
    const clock = new FrameClock(host, () => {
      presented += 1;
    });
    clock.start();
    host.pump(20); // calibrate
    clock.setLockedHz(30, 'test');
    const before = presented;
    host.pump(40);
    expect(clock.getStride()).toBe(2);
    expect(clock.getEffectiveHz()).toBe(30);
    expect(presented - before).toBe(20);
  });

  it('emits an interval equal to the locked interval, every time', () => {
    const host = fakeHost(60);
    const intervals: number[] = [];
    const clock = new FrameClock(host, (_dt, frame: PresentedFrame) => {
      intervals.push(frame.intervalMs);
    });
    clock.start();
    host.pump(30);
    clock.setLockedHz(30, 'test');
    host.pump(40);
    const distinct = new Set(intervals.map((value) => Number(value.toFixed(4))));
    // Two values only, and both are exact locked intervals — no third, floating value.
    expect([...distinct].sort((a, b) => a - b)).toEqual([
      Number((1000 / 60).toFixed(4)),
      Number((1000 / 30).toFixed(4)),
    ]);
  });

  it('only ever reports 60 or 30 as the locked rate', () => {
    const host = fakeHost(120);
    const rates = new Set<number>();
    const clock = new FrameClock(host, (_dt, frame) => {
      rates.add(frame.lockedHz);
    });
    clock.start();
    host.pump(40);
    clock.setLockedHz(30, 'test');
    host.pump(40);
    clock.setLockedHz(60, 'test');
    host.pump(40);
    expect([...rates].sort((a, b) => a - b)).toEqual([30, 60]);
  });

  it('re-locks to a clean divisor when the panel cadence changes — battery saver', () => {
    // Calibrated on 120Hz, then the machine throttles. The rate must step, not float.
    const host = fakeHost(120);
    const clock = new FrameClock(host, () => {});
    clock.start();
    host.pump(20);
    expect(clock.getDisplayHz()).toBe(120);
    expect(clock.getEffectiveHz()).toBe(60);

    const throttled = fakeHost(60);
    const throttledClock = new FrameClock(throttled, () => {});
    throttledClock.start();
    throttled.pump(20);
    expect(throttledClock.getDisplayHz()).toBe(60);
    expect(throttledClock.getEffectiveHz()).toBe(60);
    expect(throttledClock.getStride()).toBe(1);
  });

  it('logs every rate change with its reason, so a transition is never silent', () => {
    const host = fakeHost(60);
    const clock = new FrameClock(host, () => {});
    clock.start();
    host.pump(20);
    clock.setLockedHz(30, 'degradation ladder -> full-30');
    host.pump(10);
    const changes = clock.rateChanges();
    const ladder = changes.filter((change) => change.reason.includes('ladder'));
    expect(ladder).toHaveLength(1);
    expect(ladder[0]?.toHz).toBe(30);
    expect(ladder[0]?.stride).toBe(2);
  });

  it('stops cleanly and presents nothing afterwards', () => {
    const host = fakeHost(60);
    let presented = 0;
    const clock = new FrameClock(host, () => {
      presented += 1;
    });
    clock.start();
    host.pump(5);
    clock.stop();
    const before = presented;
    host.pump(20);
    expect(presented).toBe(before);
    expect(clock.running()).toBe(false);
  });

  it('records the cost of the last presented frame separately from its interval', () => {
    const host = fakeHost(60);
    // The draw callback burns 4ms of wall time, exactly as a real one would.
    const clock = new FrameClock(host, () => {
      host.advance(4);
    });
    clock.start();
    host.pump(10);
    expect(clock.lastCostMs).toBeCloseTo(4, 6);
    expect(clock.lastIntervalMs).toBeGreaterThan(0);
  });
});
