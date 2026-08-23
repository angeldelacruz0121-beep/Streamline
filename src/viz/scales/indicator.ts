/**
 * The on-screen scale indicators. Invariant 3.3 requires one so the encoding is
 * verifiable; test record 0001 condition C6 constrains its form.
 *
 * C6: "The scale indicator states its value as a reference of known magnitude (a shape
 * of stated dollar value), not as a linear bar. An area cannot be read against a length."
 * So the AREA indicator is a reference DISC. The WIDTH indicator is a reference BAR,
 * which is correct for that channel precisely because a length can be read against a
 * length. The two forms differ because the two channels differ; that is the point.
 *
 * An indicator is a legend, not an encoding. Its target size is a legibility choice and
 * is marked as such; the DOLLAR VALUE it states is derived from that size through the
 * scale constant and snapped to a 1-2-5 ladder so it is a number a reader can hold. The
 * property that matters, and the one under test, is that the constant recovered from any
 * indicator — its stated value divided by its rendered geometry — is exactly the scale
 * constant. An indicator that fails that is a false legend, which is worse than none.
 */
import { AREA_USD_PER_PX2, equivalentDiscRadiusPx, planAreaPx2 } from './area';
import {
  ScaleDomainError,
  USD_PER_BILLION,
  USD_PER_MILLION,
  USD_PER_THOUSAND,
  type Usd,
} from './units';
import { WIDTH_USD_PER_PX, widthPx } from './width';

/**
 * Legibility targets, not encoding constants. Changing either changes which round
 * dollar value the legend states; it cannot change what anything on the canvas means.
 * Final visual sizing is Atelier's.
 */
export const INDICATOR_TARGETS = {
  areaDiscDiameterPx: 48,
  widthBarLengthPx: 100,
} as const;

/**
 * Snap to the nearest 1-2-5 value in log space. 1.81e9 -> 2e9; 9e8 -> 1e9.
 * A legend must state a number a reader can hold, and 1-2-5 is the standard ladder for
 * that. It changes only the legend's stated value, never a rendered quantity.
 */
export function roundTo125(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ScaleDomainError(
      `Ladder value must be finite and positive; received ${String(value)}.`,
    );
  }
  const exponent = Math.floor(Math.log10(value));
  const decade = 10 ** exponent;
  const candidates = [1 * decade, 2 * decade, 5 * decade, 10 * decade];
  const target = Math.log10(value);

  let best = candidates[0] as number;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.abs(Math.log10(candidate) - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/** Fallback text. Atelier owns final typography; this exists so the legend is never blank. */
export function formatCompactUsd(usd: Usd): string {
  const magnitude = Math.abs(usd);
  const sign = usd < 0 ? '-' : '';
  const render = (divisor: number, suffix: string): string => {
    const scaled = magnitude / divisor;
    const digits = Number.isInteger(scaled) ? 0 : 1;
    return `${sign}$${scaled.toFixed(digits)}${suffix}`;
  };
  if (magnitude >= 1_000 * USD_PER_BILLION) return render(1_000 * USD_PER_BILLION, 'T');
  if (magnitude >= USD_PER_BILLION) return render(USD_PER_BILLION, 'B');
  if (magnitude >= USD_PER_MILLION) return render(USD_PER_MILLION, 'M');
  if (magnitude >= USD_PER_THOUSAND) return render(USD_PER_THOUSAND, 'K');
  return `${sign}$${magnitude.toFixed(0)}`;
}

export interface AreaScaleIndicator {
  readonly kind: 'reference-disc';
  readonly scaleId: 'area';
  readonly valueUsd: Usd;
  readonly areaPx2: number;
  readonly radiusPx: number;
  readonly statement: string;
  /** Must equal `AREA_USD_PER_PX2` exactly. Asserted. */
  readonly constantRecoveredUsdPerPx2: number;
}

export interface WidthScaleIndicator {
  readonly kind: 'reference-bar';
  readonly scaleId: 'width';
  readonly valueUsd: Usd;
  readonly lengthPx: number;
  readonly statement: string;
  /** Must equal `WIDTH_USD_PER_PX` exactly. Asserted. */
  readonly constantRecoveredUsdPerPx: number;
}

/** A reference disc of a stated dollar value, drawn on the 3.3 area constant. */
export function areaIndicatorAt(valueUsd: Usd): AreaScaleIndicator {
  if (!Number.isFinite(valueUsd) || valueUsd <= 0) {
    throw new ScaleDomainError(`Indicator value must be positive; received ${String(valueUsd)}.`);
  }
  const areaPx2 = planAreaPx2(valueUsd);
  return {
    kind: 'reference-disc',
    scaleId: 'area',
    valueUsd,
    areaPx2,
    radiusPx: equivalentDiscRadiusPx(areaPx2),
    statement: `This shape covers ${formatCompactUsd(valueUsd)} of net earnings.`,
    constantRecoveredUsdPerPx2: valueUsd / areaPx2,
  };
}

/** A reference bar of a stated dollar value, drawn on the 3.1 width constant. */
export function widthIndicatorAt(valueUsd: Usd): WidthScaleIndicator {
  if (!Number.isFinite(valueUsd) || valueUsd <= 0) {
    throw new ScaleDomainError(`Indicator value must be positive; received ${String(valueUsd)}.`);
  }
  const lengthPx = widthPx(valueUsd);
  return {
    kind: 'reference-bar',
    scaleId: 'width',
    valueUsd,
    lengthPx,
    statement: `A river this wide carries ${formatCompactUsd(valueUsd)} a year.`,
    constantRecoveredUsdPerPx: valueUsd / lengthPx,
  };
}

/**
 * The default indicators. Fixed, not per company: two filers side by side must meet the
 * same legend, or cross-company comparison is being asserted against a moving reference.
 */
export function defaultAreaIndicator(): AreaScaleIndicator {
  const targetAreaPx2 = Math.PI * (INDICATOR_TARGETS.areaDiscDiameterPx / 2) ** 2;
  return areaIndicatorAt(roundTo125(targetAreaPx2 * AREA_USD_PER_PX2));
}

export function defaultWidthIndicator(): WidthScaleIndicator {
  return widthIndicatorAt(roundTo125(INDICATOR_TARGETS.widthBarLengthPx * WIDTH_USD_PER_PX));
}
