/**
 * The Invariant 4.1 degradation ladder.
 *
 * "When the budget is tight the renderer steps the *locked rate* down first — 60 to 30 —
 * and keeps render quality... Reducing visual density is the second lever, used only when
 * the 30fps floor cannot hold."
 *
 * So the ladder's first rung is a RATE change at FULL quality, and only rungs below that
 * touch the picture. Ordering among the quality levers is Forge's judgment and is stated
 * here so it can be argued with: particle density first because it is the cheapest visual
 * loss, effects second, device pixel ratio last because a soft picture is the most
 * visible degradation of the three.
 *
 * Two rules the controller enforces and `degradation.test.ts` proves:
 *
 *   THE RATE NEVER FLOATS. `lockedHz` is only ever 60 or 30. There is no intermediate
 *   value and no code path that computes one. An unlocked rate is a hard fail under 4.1
 *   regardless of its average.
 *
 *   HEADROOM IS NOT BANKED. The controller starts at level 0 — 60fps, full quality — and
 *   only ever descends on a *measured* violation. It never pre-emptively reduces anything
 *   to protect a number on the harness. Forge's mandate is explicit that headroom above
 *   the floor belongs to visual quality.
 */

export type QualityLevelId = 'full-60' | 'full-30' | 'density-30' | 'effects-30' | 'dpr-30';

export interface QualityLevel {
  readonly id: QualityLevelId;
  readonly rank: number;
  /** Only ever 60 or 30. Asserted. */
  readonly lockedHz: 60 | 30;
  /** Global multiplier on particle areal density. 1 is full. */
  readonly densityScale: number;
  /**
   * Effects rung. STUBBED AS A NO-OP: there is no bloom or blur pass yet because Atelier
   * has shipped no tokens for one, and inventing a glow look would be originating taste.
   * The rung exists so the ladder's ORDER is already correct and testable, and so
   * Atelier's effect drops into `effectsQuality` without a rewrite. ATELIER-REPLACE.
   */
  readonly effectsQuality: 1 | 0.5 | 0;
  /** Upper bound on device pixel ratio. The renderer still respects the display's own. */
  readonly maxDpr: number;
  readonly rationale: string;
}

export const QUALITY_LADDER: readonly QualityLevel[] = [
  {
    id: 'full-60',
    rank: 0,
    lockedHz: 60,
    densityScale: 1,
    effectsQuality: 1,
    maxDpr: 2,
    rationale: 'Preferred rate, full quality. The starting state, always.',
  },
  {
    id: 'full-30',
    rank: 1,
    lockedHz: 30,
    densityScale: 1,
    effectsQuality: 1,
    maxDpr: 2,
    rationale:
      'Rate steps down first and quality is untouched. Invariant 4.1: a thinner-looking ' +
      'product on the hardware most users have is a worse outcome than a locked 30.',
  },
  {
    id: 'density-30',
    rank: 2,
    lockedHz: 30,
    densityScale: 0.6,
    effectsQuality: 1,
    maxDpr: 2,
    rationale: 'Floor cannot hold at full quality. Cheapest visual loss goes first.',
  },
  {
    id: 'effects-30',
    rank: 3,
    lockedHz: 30,
    densityScale: 0.45,
    effectsQuality: 0.5,
    maxDpr: 2,
    rationale: 'Second quality lever. No-op today; the rung is here so the order is fixed.',
  },
  {
    id: 'dpr-30',
    rank: 4,
    lockedHz: 30,
    densityScale: 0.35,
    effectsQuality: 0,
    maxDpr: 1,
    rationale: 'Last resort. A soft picture is the most visible loss, so it is taken last.',
  },
];

export function levelByRank(rank: number): QualityLevel {
  const clamped = Math.min(QUALITY_LADDER.length - 1, Math.max(0, rank));
  return QUALITY_LADDER[clamped] as QualityLevel;
}

export interface ControllerConfig {
  /** Frames of over-budget pacing that trigger a step down. */
  readonly demoteAfterBadFrames: number;
  /** Consecutive frames comfortably inside budget before a step up is considered. */
  readonly promoteAfterGoodFrames: number;
  /** A frame is "bad" above this multiple of the locked interval. 4.1 pacing rule. */
  readonly pacingMultiple: number;
  /** A frame is "comfortable" below this fraction of the locked interval. */
  readonly comfortFraction: number;
  /** Minimum frames between any two transitions. Stops the ladder oscillating. */
  readonly cooldownFrames: number;
}

export const DEFAULT_CONTROLLER: ControllerConfig = {
  demoteAfterBadFrames: 6,
  promoteAfterGoodFrames: 240,
  pacingMultiple: 1.5,
  comfortFraction: 0.6,
  cooldownFrames: 120,
};

export interface Transition {
  readonly from: QualityLevelId;
  readonly to: QualityLevelId;
  readonly direction: 'down' | 'up';
  readonly atFrame: number;
  readonly reason: string;
}

/**
 * Decides which rung the renderer is on. Pure state machine over frame costs — it holds
 * no canvas, no timers and no DOM, so the ladder is testable without a browser.
 */
export class DegradationController {
  private rank = 0;
  private bad = 0;
  private good = 0;
  private frame = 0;
  private lastChangeFrame = -Infinity;
  private pinned = false;
  private readonly log: Transition[] = [];
  private readonly config: ControllerConfig;

  constructor(config: ControllerConfig = DEFAULT_CONTROLLER) {
    this.config = config;
  }

  level(): QualityLevel {
    return levelByRank(this.rank);
  }

  transitions(): readonly Transition[] {
    return this.log;
  }

  /** Feed one frame's cost in milliseconds. Returns the level to render the next frame at. */
  observe(frameCostMs: number): QualityLevel {
    this.frame += 1;
    // A pinned rung does not move. The harness pins one to prove the 30fps floor holds,
    // and an unpinned controller would climb back to 60 the moment it saw headroom —
    // correct behaviour in the product, and useless for measuring the floor.
    if (this.pinned) return this.level();
    const current = this.level();
    const intervalMs = 1000 / current.lockedHz;

    if (frameCostMs > intervalMs * this.config.pacingMultiple) {
      this.bad += 1;
      this.good = 0;
    } else if (frameCostMs < intervalMs * this.config.comfortFraction) {
      this.good += 1;
      this.bad = 0;
    } else {
      this.bad = 0;
      this.good = 0;
    }

    const cooled = this.frame - this.lastChangeFrame >= this.config.cooldownFrames;

    if (this.bad >= this.config.demoteAfterBadFrames && this.rank < QUALITY_LADDER.length - 1) {
      this.step(
        this.rank + 1,
        'down',
        `${this.bad} frames over ${this.config.pacingMultiple}x interval`,
      );
    } else if (this.good >= this.config.promoteAfterGoodFrames && this.rank > 0 && cooled) {
      this.step(
        this.rank - 1,
        'up',
        `${this.good} frames inside ${this.config.comfortFraction}x interval`,
      );
    }

    return this.level();
  }

  /** HARNESS AND TESTS ONLY. Latches a rung; automatic transitions stop until `unpin`. */
  pin(rank: number): QualityLevel {
    this.step(rank, rank > this.rank ? 'down' : 'up', 'pinned');
    this.pinned = true;
    return this.level();
  }

  unpin(): void {
    this.pinned = false;
  }

  isPinned(): boolean {
    return this.pinned;
  }

  private step(nextRank: number, direction: 'down' | 'up', reason: string): void {
    const from = this.level().id;
    this.rank = Math.min(QUALITY_LADDER.length - 1, Math.max(0, nextRank));
    const to = this.level().id;
    if (from === to) return;
    this.bad = 0;
    this.good = 0;
    this.lastChangeFrame = this.frame;
    this.log.push({ from, to, direction, atFrame: this.frame, reason });
  }
}
