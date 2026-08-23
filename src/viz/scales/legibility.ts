/**
 * Legibility assessment. Invariants 3.1, 3.9, 3.11 and protocol section 3.
 *
 * THIS MODULE NEVER CHANGES A SIZE. It measures the rendered geometry against floors and
 * reports what falls below them. Invariant 3.9 is explicit that legibility is solved
 * with labelling and interaction, never by distorting the scale, and protocol section 3
 * makes any accuracy-versus-appearance trade an escalation rather than a fix. So the
 * output here is evidence for an escalation, not a correction applied on the way past.
 *
 * The binding constraint is the SMALLEST RIVER, per test record 0002: at any scale where
 * the smallest river is legible, the trunk constriction is comfortably above its own
 * threshold. The report names that explicitly so nobody re-derives it from the trunk.
 *
 * EVERY FLOOR BELOW IS PROVISIONAL. None is a measured figure. The 8px "reads as a step
 * rather than a taper" threshold is Advocate's stated assumption in record 0002, not an
 * observation, and the other two are of the same kind. They are carried as data with a
 * provenance field rather than as bare numbers so that nothing downstream can mistake
 * them for findings. Replace them with measured values before they gate a release.
 */

export interface LegibilityFloor {
  readonly px: number;
  readonly provisional: true;
  readonly source: string;
}

export const LEGIBILITY_FLOORS = {
  /** Width at which record 0002's table treats a river as legible. */
  riverMinWidthPx: {
    px: 12,
    provisional: true,
    source: 'Advocate, two-audience test 0002 — assumption, not measurement',
  },
  /** Width removed at which a constriction reads as a step rather than a taper. */
  constrictionStepMinPx: {
    px: 8,
    provisional: true,
    source: 'Advocate, two-audience test 0002 — explicitly flagged as an unmeasured assumption',
  },
  /** Equivalent diameter at which a body of water reads as a body of water. */
  lakeMinDiameterPx: {
    px: 10,
    provisional: true,
    source: 'Cartographer — the small-end floor the 3.3 area constant is derived against',
  },
} as const satisfies Record<string, LegibilityFloor>;

export type LegibilityCode =
  | 'river-below-floor'
  | 'constriction-below-floor'
  | 'lake-below-floor'
  | 'indicator-dwarfs-subject';

export interface LegibilityFinding {
  readonly code: LegibilityCode;
  /** Which element. A river id, a constriction id, or `lake` / `indicator`. */
  readonly subject: string;
  readonly measuredPx: number;
  readonly floorPx: number;
  readonly provisional: true;
  readonly message: string;
}

export interface LegibilityReport {
  /**
   * The element that binds. Normally the narrowest river mouth — 0002's finding. Null
   * only when there are no rivers.
   */
  readonly bindingElement: string | null;
  readonly smallestRiverMouthWidthPx: number | null;
  readonly findings: readonly LegibilityFinding[];
  /** True when nothing is below a floor. Not a licence to rescale when false. */
  readonly legible: boolean;
  readonly note: string;
}

export interface LegibilityInput {
  readonly rivers: readonly { readonly id: string; readonly mouthWidthPx: number }[];
  readonly constrictions: readonly { readonly id: string; readonly removedWidthPx: number }[];
  readonly lakeEquivalentDiameterPx: number;
  readonly indicatorValueUsd: number;
  readonly subjectUsd: number;
}

export function assessLegibility(input: LegibilityInput): LegibilityReport {
  const findings: LegibilityFinding[] = [];

  let smallest: { id: string; px: number } | null = null;
  for (const river of input.rivers) {
    if (smallest === null || river.mouthWidthPx < smallest.px) {
      smallest = { id: river.id, px: river.mouthWidthPx };
    }
    if (river.mouthWidthPx < LEGIBILITY_FLOORS.riverMinWidthPx.px) {
      findings.push({
        code: 'river-below-floor',
        subject: river.id,
        measuredPx: river.mouthWidthPx,
        floorPx: LEGIBILITY_FLOORS.riverMinWidthPx.px,
        provisional: true,
        message:
          `River ${river.id} is ${river.mouthWidthPx.toFixed(2)}px at its mouth, below the ` +
          `provisional ${LEGIBILITY_FLOORS.riverMinWidthPx.px}px floor. Invariant 3.9: this is the ` +
          `correct rendering. Solve it with labelling and interaction, never by rescaling.`,
      });
    }
  }

  for (const constriction of input.constrictions) {
    if (constriction.removedWidthPx < LEGIBILITY_FLOORS.constrictionStepMinPx.px) {
      findings.push({
        code: 'constriction-below-floor',
        subject: constriction.id,
        measuredPx: constriction.removedWidthPx,
        floorPx: LEGIBILITY_FLOORS.constrictionStepMinPx.px,
        provisional: true,
        message:
          `Constriction ${constriction.id} removes ${constriction.removedWidthPx.toFixed(2)}px, ` +
          `below the provisional ${LEGIBILITY_FLOORS.constrictionStepMinPx.px}px step threshold. ` +
          `Kill-list K1 forbids enlarging it. Annotate the dollar figure (0002 C2).`,
      });
    }
  }

  if (input.lakeEquivalentDiameterPx < LEGIBILITY_FLOORS.lakeMinDiameterPx.px) {
    findings.push({
      code: 'lake-below-floor',
      subject: 'lake',
      measuredPx: input.lakeEquivalentDiameterPx,
      floorPx: LEGIBILITY_FLOORS.lakeMinDiameterPx.px,
      provisional: true,
      message:
        `The water body is ${input.lakeEquivalentDiameterPx.toFixed(2)}px across, below the ` +
        `provisional ${LEGIBILITY_FLOORS.lakeMinDiameterPx.px}px floor. Invariant 3.3: a small ` +
        `positive result renders as a small lake and the smallness is the point.`,
    });
  }

  const subjectMagnitude = Math.abs(input.subjectUsd);
  if (subjectMagnitude > 0 && input.indicatorValueUsd > subjectMagnitude) {
    findings.push({
      code: 'indicator-dwarfs-subject',
      subject: 'indicator',
      measuredPx: input.indicatorValueUsd / subjectMagnitude,
      floorPx: 1,
      provisional: true,
      message:
        `The area reference states a value larger than the subject itself, so the legend is ` +
        `bigger than the thing it explains. The legend is still true. Choosing a smaller stated ` +
        `value is a legend decision, not a scale decision.`,
    });
  }

  return {
    bindingElement: smallest === null ? null : smallest.id,
    smallestRiverMouthWidthPx: smallest === null ? null : smallest.px,
    findings,
    legible: findings.length === 0,
    note:
      'The binding legibility constraint in this picture is the smallest river, not the trunk ' +
      'constriction (test record 0002). All floors here are provisional and unmeasured.',
  };
}

export interface CrossAxisFitReport {
  readonly requiredPx: number;
  readonly availablePx: number;
  readonly fits: boolean;
  readonly overflowPx: number;
  readonly note: string;
}

/**
 * Does the canvas fit across the flow axis at the fixed width constant?
 *
 * There is no fit-to-viewport multiplier anywhere in this directory, on purpose: any
 * such multiplier is per-company rescaling and Invariant 3.1 forbids it. When this
 * reports an overflow the answer is an escalation — pan, a larger viewport, or a decision
 * to decline the filer — never a quiet rescale.
 */
export function assessCrossAxisFit(requiredPx: number, availablePx: number): CrossAxisFitReport {
  const overflowPx = Math.max(0, requiredPx - availablePx);
  return {
    requiredPx,
    availablePx,
    fits: overflowPx === 0,
    overflowPx,
    note:
      'Overflow is reported, never corrected. Rescaling to fit is per-company rescaling and is ' +
      'forbidden by Invariant 3.1; resolve by escalation under protocol section 3.',
  };
}
