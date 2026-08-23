import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONTROLLER,
  DegradationController,
  QUALITY_LADDER,
  levelByRank,
} from './degradation';

describe('the degradation ladder', () => {
  it('steps the rate down before it touches quality — Invariant 4.1', () => {
    // The whole ordering claim, as one assertion. Rung 1 is a rate change at FULL
    // quality; nothing visual moves until rung 2.
    const [full60, full30, density30] = QUALITY_LADDER;
    expect(full60?.lockedHz).toBe(60);
    expect(full60?.densityScale).toBe(1);
    expect(full30?.lockedHz).toBe(30);
    expect(full30?.densityScale).toBe(1);
    expect(full30?.effectsQuality).toBe(1);
    expect(full30?.maxDpr).toBe(full60?.maxDpr);
    expect(density30?.densityScale).toBeLessThan(1);
  });

  it('never offers a rate that is not 60 or 30', () => {
    for (const level of QUALITY_LADDER) {
      expect([60, 30]).toContain(level.lockedHz);
    }
  });

  it('reduces density before effects and effects before DPR', () => {
    const ranks = QUALITY_LADDER.map((level) => level.rank);
    expect(ranks).toEqual([0, 1, 2, 3, 4]);
    // Monotone: nothing on the ladder ever gets better as you descend.
    for (let i = 1; i < QUALITY_LADDER.length; i += 1) {
      const previous = QUALITY_LADDER[i - 1];
      const current = QUALITY_LADDER[i];
      expect(current?.densityScale).toBeLessThanOrEqual(previous?.densityScale ?? 1);
      expect(current?.effectsQuality).toBeLessThanOrEqual(previous?.effectsQuality ?? 1);
      expect(current?.maxDpr).toBeLessThanOrEqual(previous?.maxDpr ?? 2);
    }
    // DPR is the last thing to move, and only on the final rung.
    const dprMoves = QUALITY_LADDER.filter((level, i) =>
      i === 0 ? false : level.maxDpr < (QUALITY_LADDER[i - 1]?.maxDpr ?? 2),
    );
    expect(dprMoves.map((level) => level.id)).toEqual(['dpr-30']);
  });

  it('starts at full quality and 60fps, banking no headroom', () => {
    const controller = new DegradationController();
    expect(controller.level().id).toBe('full-60');
    // A hundred comfortable frames must not "save" anything. Headroom above the floor
    // belongs to visual quality, not to a number on the harness.
    for (let i = 0; i < 100; i += 1) controller.observe(3);
    expect(controller.level().id).toBe('full-60');
    expect(controller.transitions()).toHaveLength(0);
  });

  it('descends only after sustained over-budget frames, and one rung at a time', () => {
    const controller = new DegradationController();
    const badAt60 = (1000 / 60) * 1.6;
    for (let i = 0; i < DEFAULT_CONTROLLER.demoteAfterBadFrames - 1; i += 1) {
      controller.observe(badAt60);
    }
    expect(controller.level().id).toBe('full-60');
    controller.observe(badAt60);
    expect(controller.level().id).toBe('full-30');
    expect(controller.transitions()).toHaveLength(1);
    expect(controller.transitions()[0]?.direction).toBe('down');
  });

  it('a frame that is bad at 60 can be comfortable at 30 — the rate step is the fix', () => {
    const controller = new DegradationController();
    const cost = 28; // over 1.5x of 16.67ms, under 0.6x of 33.3ms... no: under 1.5x of 33.3
    for (let i = 0; i < 20; i += 1) controller.observe(cost);
    expect(controller.level().id).toBe('full-30');
    // At 30 the same cost is inside the pacing rule, so the ladder stops descending.
    for (let i = 0; i < 60; i += 1) controller.observe(cost);
    expect(controller.level().id).toBe('full-30');
  });

  it('keeps descending only if the 30fps floor genuinely cannot hold', () => {
    const controller = new DegradationController();
    const awful = 200;
    for (let i = 0; i < 200; i += 1) controller.observe(awful);
    expect(controller.level().id).toBe('dpr-30');
    const order = controller.transitions().map((t) => t.to);
    expect(order).toEqual(['full-30', 'density-30', 'effects-30', 'dpr-30']);
  });

  it('does not oscillate: promotion needs a long comfortable run and a cooldown', () => {
    const controller = new DegradationController();
    for (let i = 0; i < 20; i += 1) controller.observe(200);
    const afterDrop = controller.level().id;
    for (let i = 0; i < DEFAULT_CONTROLLER.promoteAfterGoodFrames - 1; i += 1) {
      controller.observe(1);
    }
    expect(controller.level().id).toBe(afterDrop);
    for (let i = 0; i < DEFAULT_CONTROLLER.promoteAfterGoodFrames + 10; i += 1) {
      controller.observe(1);
    }
    expect(controller.level().rank).toBeLessThan(levelByRank(4).rank);
  });

  it('clamps a pinned rank rather than falling off the ladder', () => {
    const controller = new DegradationController();
    expect(controller.pin(99).id).toBe('dpr-30');
    expect(controller.pin(-5).id).toBe('full-60');
  });
});
