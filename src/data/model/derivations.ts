/**
 * Every number Streamline computes rather than reads, in one registry.
 *
 * Two rules govern this file. Each method is a named, individually testable
 * function whose docstring states its assumption in plain language, and that
 * same sentence is copied onto every figure the method produces so a detail
 * panel can show it (Invariant 2.3). And a method that cannot be defended is
 * not written: where no derivation is honest, the model carries "not disclosed"
 * instead, which is why this registry is deliberately short. Neither method here
 * allocates a cost. Both are arithmetic over figures the filer reported.
 */
import {
  coarsestDecimals,
  derivedFigure,
  roundingTolerance,
  sameUnit,
  type Figure,
  type Unit,
} from './figure.ts';
import type { SourceRef } from './source-ref.ts';

export type DerivationMethodId =
  | 'sum-of-reported-figures-v1'
  | 'difference-of-reported-figures-v1'
  | 'reported-bridge-remainder-v1'
  | 'single-segment-operating-income-from-consolidated-v1';

export interface DerivationMethod {
  readonly id: DerivationMethodId;
  /** The assumption, in the words that will appear in the analyst panel. */
  readonly assumption: string;
}

export const DERIVATION_METHODS: Readonly<Record<DerivationMethodId, DerivationMethod>> = {
  'sum-of-reported-figures-v1': {
    id: 'sum-of-reported-figures-v1',
    assumption:
      'Assumes the addends are disjoint amounts the filer reported in the same unit and the ' +
      'same period, so their sum double-counts nothing. It allocates nothing and estimates ' +
      'nothing: every addend is a tagged fact in the filing.',
  },
  'difference-of-reported-figures-v1': {
    id: 'difference-of-reported-figures-v1',
    assumption:
      'Assumes both terms are the filer’s own reported amounts in the same unit and period, ' +
      'so the difference between them is itself reported information rather than an estimate. ' +
      'It attributes the difference to nothing in particular — naming what the gap consists ' +
      'of is a separate, reported step.',
  },
  'single-segment-operating-income-from-consolidated-v1': {
    id: 'single-segment-operating-income-from-consolidated-v1',
    assumption:
      'Assumes a filer with exactly one reportable segment has no allocation to make, so the ' +
      'company’s consolidated operating income is that segment’s operating income. It is used ' +
      'only where the filer tags no operating profit on the segment axis itself, and only where ' +
      'the segment’s own disclosed costs carry its reported revenue to this same amount — the ' +
      'filer’s own numbers prove the attribution rather than the assumption standing alone.',
  },
  'reported-bridge-remainder-v1': {
    id: 'reported-bridge-remainder-v1',
    assumption:
      'Assumes the listed items are reported amounts the filer discloses between the two ' +
      'totals, each entering with the sign its concept implies — an expense reduces, income ' +
      'increases. The result is whatever those items fail to account for. It is displayed ' +
      'rather than absorbed into one of them, so an incomplete list shows up as a visible ' +
      'remainder instead of a silently adjusted figure.',
  },
};

export interface BridgeItem {
  readonly amount: Figure;
  readonly direction: 'reduces' | 'increases';
}

export type DerivationOutcome =
  { readonly ok: true; readonly figure: Figure } | { readonly ok: false; readonly detail: string };

function inputsOf(figures: readonly Figure[]): readonly SourceRef[] {
  return figures.flatMap((figure) =>
    figure.provenance.kind === 'reported'
      ? [figure.provenance.sourceRef]
      : figure.provenance.inputs,
  );
}

function unitsAgree(figures: readonly Figure[]): Unit | null {
  const first = figures[0];

  if (first === undefined) return null;

  for (const figure of figures) {
    if (!sameUnit(first.unit, figure.unit)) return null;
  }

  return first.unit;
}

/**
 * Adds reported amounts.
 *
 * Assumption: the addends are disjoint amounts the filer reported in the same
 * unit and the same period, so their sum double-counts nothing. It allocates
 * nothing and estimates nothing — every addend is a tagged fact in the filing.
 *
 * Fails rather than coercing when the units disagree, because a sum across two
 * currencies is not a number (Invariant 2.6), and when there is nothing to add,
 * because an empty sum has no provenance and Invariant 2.2 forbids one.
 */
export function sumOfReportedFigures(figures: readonly Figure[]): DerivationOutcome {
  if (figures.length === 0) {
    return { ok: false, detail: 'Nothing to sum: a figure with no inputs has no provenance.' };
  }

  const unit = unitsAgree(figures);

  if (unit === null) {
    return {
      ok: false,
      detail: 'Cannot sum figures reported in different units; there is no such quantity.',
    };
  }

  const method = DERIVATION_METHODS['sum-of-reported-figures-v1'];
  const total = figures.reduce((running, figure) => running + figure.value, 0);

  return {
    ok: true,
    figure: derivedFigure(total, unit, {
      method: method.id,
      assumption: method.assumption,
      inputs: inputsOf(figures),
      decimals: coarsestDecimals(figures),
    }),
  };
}

/**
 * Subtracts one reported amount from another.
 *
 * Assumption: both terms are the filer's own reported amounts in the same unit
 * and period, so the difference between them is itself reported information
 * rather than an estimate. It attributes the difference to nothing in
 * particular — naming what the gap consists of is a separate, reported step.
 *
 * This is the method behind the trunk constriction: segment operating income
 * minus consolidated net earnings is a real gap between two tagged facts, and
 * what fills it is then read from the filing, not assumed.
 */
export function differenceOfReportedFigures(
  minuend: Figure,
  subtrahend: Figure,
): DerivationOutcome {
  if (!sameUnit(minuend.unit, subtrahend.unit)) {
    return {
      ok: false,
      detail: 'Cannot subtract figures reported in different units; there is no such quantity.',
    };
  }

  const method = DERIVATION_METHODS['difference-of-reported-figures-v1'];

  return {
    ok: true,
    figure: derivedFigure(minuend.value - subtrahend.value, minuend.unit, {
      method: method.id,
      assumption: method.assumption,
      inputs: inputsOf([minuend, subtrahend]),
      decimals: coarsestDecimals([minuend, subtrahend]),
    }),
  };
}

/**
 * What a set of reported items fails to explain about a gap between two totals.
 *
 * Assumption: the listed items are reported amounts the filer discloses between
 * the two totals, each entering with the sign its concept implies — an expense
 * reduces, income increases. The result is whatever those items fail to account
 * for, and it is displayed rather than absorbed into one of them, so an
 * incomplete list shows up as a visible remainder instead of a silently
 * adjusted figure.
 *
 * This is the method behind the trunk constriction's `unexplained`. A zero
 * remainder is still returned as a figure: a reader is entitled to see that the
 * bridge closes rather than take it on trust.
 */
export function reportedBridgeRemainder(
  gap: Figure,
  items: readonly BridgeItem[],
): DerivationOutcome {
  const amounts = items.map((item) => item.amount);

  if (unitsAgree([gap, ...amounts]) === null) {
    return {
      ok: false,
      detail: 'Cannot bridge figures reported in different units; there is no such quantity.',
    };
  }

  const method = DERIVATION_METHODS['reported-bridge-remainder-v1'];
  const remainder = items.reduce(
    (running, item) =>
      running - (item.direction === 'reduces' ? item.amount.value : -item.amount.value),
    gap.value,
  );

  return {
    ok: true,
    figure: derivedFigure(remainder, gap.unit, {
      method: method.id,
      assumption: method.assumption,
      inputs: inputsOf([gap, ...amounts]),
      decimals: coarsestDecimals([gap, ...amounts]),
    }),
  };
}

/**
 * The operating income of a filer's only reportable segment, taken from the
 * consolidated income statement.
 *
 * Assumption: a filer with exactly one reportable segment has no allocation to
 * make, so the company's consolidated operating income *is* that segment's
 * operating income. The value is the filer's own tagged consolidated figure —
 * nothing is apportioned, estimated or spread.
 *
 * Why it is needed: ASU 2023-07 lets a single-segment filer tag its whole income
 * statement to its one segment, and several do so without ever tagging operating
 * income there. Autodesk's FY2026 segment axis carries revenue, eleven operating
 * costs, tax, interest and net income — but no operating income. Without this
 * rule its river has no end; with it the river ends where D16 says every river
 * ends.
 *
 * Why it is safe: the attribution is not taken on trust. The segment's own
 * disclosed costs must carry its reported revenue to this same amount within the
 * rounding slack the filer's `decimals` imply. Autodesk's do, exactly:
 * 7,206 − 5,628 = 1,578, which is the consolidated `us-gaap:OperatingIncomeLoss`
 * for that accession. If the bridge does not tie, the figure is refused rather
 * than attributed, because then the segment schedule and the income statement
 * are describing different things and this project cannot say which is the
 * river.
 *
 * The result is labelled `derived`, not `reported`, even though its value is a
 * tagged fact: the number is the filer's, the attribution to the segment is
 * this project's inference, and Invariant 2.3 is about which of those a reader
 * is looking at.
 */
export function singleSegmentOperatingIncome(
  consolidatedOperatingIncome: Figure,
  segmentRevenue: Figure,
  segmentCosts: readonly Figure[],
): DerivationOutcome {
  if (unitsAgree([consolidatedOperatingIncome, segmentRevenue, ...segmentCosts]) === null) {
    return {
      ok: false,
      detail:
        'Cannot attribute consolidated operating income to the single segment: the segment’s ' +
        'figures and the income statement are not in the same unit.',
    };
  }

  const costTotal = segmentCosts.reduce((running, cost) => running + cost.value, 0);
  const bridged = segmentRevenue.value - costTotal;
  const gap = bridged - consolidatedOperatingIncome.value;
  const slack = roundingTolerance(
    coarsestDecimals([consolidatedOperatingIncome, segmentRevenue, ...segmentCosts]),
  );

  if (Math.abs(gap) > slack) {
    return {
      ok: false,
      detail:
        'The single segment’s disclosed costs do not carry its revenue to consolidated operating ' +
        `income: revenue less costs is ${bridged.toLocaleString('en-US')} against a consolidated ` +
        `${consolidatedOperatingIncome.value.toLocaleString('en-US')}, a gap of ` +
        `${gap.toLocaleString('en-US')}. The segment schedule and the income statement are ` +
        'describing different things, so neither is attributed to the other.',
    };
  }

  const method = DERIVATION_METHODS['single-segment-operating-income-from-consolidated-v1'];

  return {
    ok: true,
    figure: derivedFigure(consolidatedOperatingIncome.value, consolidatedOperatingIncome.unit, {
      method: method.id,
      assumption: method.assumption,
      inputs: inputsOf([consolidatedOperatingIncome]),
      decimals: consolidatedOperatingIncome.decimals,
    }),
  };
}
