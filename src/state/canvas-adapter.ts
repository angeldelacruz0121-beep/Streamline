/**
 * The only file in the app that knows `composeCanvas` exists.
 *
 * `RenderableCompany` is Ledger's vocabulary — figures with units and
 * provenance, constrictions with a direction, a trunk that reports what it
 * cannot explain. `CanvasInput` is Cartographer's — plain USD numbers on a
 * fixed set of fields. Translating between them is app work, not data work and
 * not encoding work, so it lives here and every disagreement between the two
 * vocabularies is resolved on these lines rather than in six call sites.
 *
 * THIS FUNCTION ASSUMES `composeCanvas` IS NOT TOTAL, AND KEEPS ASSUMING IT.
 * It handles `EncodingResult.ok === false` *and* catches. That is not a
 * workaround for any one upstream defect: an encoding whose job is to refuse
 * rather than approximate will always have inputs it declines, and a scale that
 * asserts its domain will always have a caller that violates it first. A throw
 * that escapes here is a white screen for a filer whose only crime was losing
 * money. So the catch stays permanently, and the reason it stays is written
 * down so nobody deletes it as dead code.
 *
 * NO COPY IS ORIGINATED HERE. `TRUNK_CONSTRICTION_LABEL` reuses the exact string
 * already standing in `src/viz/encoding`; decision record 0002 C5 leaves the
 * final wording to Angel, and a second competing string would be worse than one
 * imperfect one.
 */
import { composeCanvas, type Blocked, type CanvasInput, type CanvasModel } from '../viz/encoding';
import type { DisclosedCost, RiverInput } from '../viz/encoding';
import type { ResidualComponent } from '../viz/encoding';
import type { Usd } from '../viz/scales';
import type {
  Constriction,
  RenderableCompany,
  Segment,
  TrunkConstriction,
} from '../data/model/company.ts';
import type { Figure } from '../data/model/figure.ts';
import type { Validated } from '../types/brand';

/** Verbatim from `src/viz/encoding/compose.test.ts` and `cross-filer.test.ts`. Angel's to finalise (0002 C5). */
export const TRUNK_CONSTRICTION_LABEL = 'Tax and other items outside the business segments';

export type CanvasOutcome =
  | { readonly kind: 'model'; readonly model: CanvasModel }
  /** The encoding declined. Every reason is a finding with a subject and, usually, an amount. */
  | { readonly kind: 'blocked'; readonly reasons: readonly Blocked[] }
  /** The adapter declined before the encoding was reached. */
  | { readonly kind: 'refused'; readonly detail: string }
  /** The encoding threw. A defect, surfaced rather than swallowed. */
  | { readonly kind: 'threw'; readonly detail: string };

/**
 * Invariant 2.6: currency is part of the value. A filer reporting in a currency
 * the width scale was not calibrated against is refused, never converted — an
 * FX rate the filing does not contain is an invented number (4.5).
 */
function usdValue(figure: Figure, subject: string): number {
  if (figure.unit.kind !== 'monetary') {
    throw new UnsupportedFigure(`${subject} is not a monetary amount.`);
  }

  if (figure.unit.currency !== 'USD') {
    throw new UnsupportedFigure(
      `${subject} is reported in ${figure.unit.currency}. Streamline's scales are calibrated in USD and this app does not convert currencies, because the exchange rate is not in the filing.`,
    );
  }

  return figure.value;
}

class UnsupportedFigure extends Error {}

/**
 * Direction to sign.
 *
 * The model carries the filer's reported amount with its sign intact and says
 * separately which way the item moves the flow, so the sign convention is
 * applied exactly once — here. `reduces` contributes positively to a residual
 * that is defined as (what arrived − what was kept); `increases` contributes
 * negatively. Microsoft FY2026 is the proof: income tax 32,185 reduces,
 * nonoperating income 10,697 increases, and 32,185 − 10,697 = the 21,488
 * residual `composeTrunk` computes independently.
 */
function signedUsd(item: Constriction, subject: string): number {
  const magnitude = usdValue(item.amount, subject);

  return item.direction === 'reduces' ? magnitude : -magnitude;
}

function toDisclosedCost(item: Constriction, segmentId: string): DisclosedCost {
  return {
    id: item.id,
    label: item.label,
    amountUsd: signedUsd(item, `${segmentId} / ${item.id}`) as Usd,
  };
}

function toRiverInput(segment: Segment): RiverInput {
  return {
    id: segment.id,
    label: segment.label,
    revenueUsd: usdValue(segment.revenue, `${segment.id} revenue`) as Usd,
    costs: segment.constrictions.map((item) => toDisclosedCost(item, segment.id)),
    operatingIncomeUsd: usdValue(segment.operatingIncome, `${segment.id} operating income`) as Usd,
  };
}

/**
 * Itemised residual components, but only when Ledger says they tie.
 *
 * `composeTrunk` blocks outright if the components do not sum to the residual,
 * on the reasoning that an itemisation which does not tie is worse than none.
 * `TrunkConstriction` already carries that verdict as `fullyExplained`, so the
 * decision is read from the data rather than rediscovered by arithmetic here.
 * When it is false the components are withheld and `unexplained` stays visible
 * on the surface — the picture loses a breakdown, never a dollar.
 */
export function toResidualComponents(trunk: TrunkConstriction): readonly ResidualComponent[] {
  if (!trunk.fullyExplained) return [];

  return trunk.components.map((item) => ({
    id: item.id,
    label: item.label,
    amountUsd: signedUsd(item, `trunk / ${item.id}`) as Usd,
  }));
}

export interface CanvasAdapterOptions {
  readonly displayCap?: number;
  readonly availableCrossAxisPx?: number;
}

/**
 * `RenderableCompany` -> `CanvasInput`. Pure, and separated from the compose
 * call so a test can assert the mapping without asserting geometry.
 */
export function toCanvasInput(
  view: RenderableCompany,
  options: CanvasAdapterOptions = {},
): CanvasInput {
  return {
    fiscalPeriodLabel: view.period.label,
    // Every reportable segment, not the visible ones. Invariant 3.7 is upstream
    // of the display cap and `composeCanvas` needs the full set to hold it.
    segments: view.segments.map(toRiverInput),
    netEarningsUsd: usdValue(view.trunk.netEarnings, 'consolidated net earnings') as Usd,
    trunkConstrictionLabel: TRUNK_CONSTRICTION_LABEL,
    residualComponents: toResidualComponents(view.trunk),
    ...(options.displayCap === undefined ? {} : { displayCap: options.displayCap }),
    ...(options.availableCrossAxisPx === undefined
      ? {}
      : { availableCrossAxisPx: options.availableCrossAxisPx }),
  };
}

/**
 * The whole translation, refusals included. Takes a `Validated` view: the
 * signature is the compile-time half of Invariant 4.3 at this seam, so an
 * unvalidated `RenderableCompany` cannot reach the encoding even by mistake.
 */
export function composeFromCompany(
  view: Validated<RenderableCompany>,
  options: CanvasAdapterOptions = {},
): CanvasOutcome {
  let input: CanvasInput;

  try {
    input = toCanvasInput(view, options);
  } catch (cause) {
    if (cause instanceof UnsupportedFigure) {
      return { kind: 'refused', detail: cause.message };
    }

    throw cause;
  }

  let result: ReturnType<typeof composeCanvas>;

  try {
    result = composeCanvas(input);
  } catch (cause) {
    return {
      kind: 'threw',
      detail: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
    };
  }

  if (!result.ok) return { kind: 'blocked', reasons: result.blocked };

  return { kind: 'model', model: result.value };
}
