/**
 * The canonical financial quantity. Invariants 2.2, 2.3 and 2.6 in one type.
 *
 * A `Figure` cannot exist without a unit and cannot exist without provenance.
 * There are exactly two constructors: `reportedFigure`, which demands the
 * `SourceRef` of the tagged fact it read, and `derivedFigure`, which demands a
 * registered method, a plain-language assumption, and the non-empty list of
 * source refs the derivation consumed. `sourceRefsOf` is therefore total: every
 * figure that can reach a renderer traces to at least one tagged fact.
 */
import type { SourceRef } from './source-ref.ts';

/** Invariant 2.6: currency is part of the value, never a formatting concern. */
export interface MonetaryUnit {
  readonly kind: 'monetary';
  /** ISO 4217, as declared by the instance's unit, e.g. `USD`. */
  readonly currency: string;
}

/** A counted thing, e.g. `us-gaap:NumberOfReportableSegments` in `msft:Segment`. */
export interface CountUnit {
  readonly kind: 'count';
  readonly measure: string;
}

/** A ratio or percentage carried as `pure` in the instance. */
export interface PureUnit {
  readonly kind: 'pure';
}

export type Unit = MonetaryUnit | CountUnit | PureUnit;

export function usd(): MonetaryUnit {
  return { kind: 'monetary', currency: 'USD' };
}

export function sameUnit(left: Unit, right: Unit): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'monetary' && right.kind === 'monetary') {
    return left.currency === right.currency;
  }
  if (left.kind === 'count' && right.kind === 'count') return left.measure === right.measure;

  return true;
}

export function describeUnit(unit: Unit): string {
  switch (unit.kind) {
    case 'monetary':
      return unit.currency;
    case 'count':
      return unit.measure;
    case 'pure':
      return 'pure';
  }
}

/** The figure was read from a tagged fact, unchanged. */
export interface ReportedProvenance {
  readonly kind: 'reported';
  readonly sourceRef: SourceRef;
}

/**
 * The figure was computed. `method` is the id of a function in
 * `derivations.ts`; `assumption` is that function's assumption in plain
 * language, copied onto the figure so a detail panel can state it without
 * reaching back into the registry (Invariant 2.3).
 */
export interface DerivedProvenance {
  readonly kind: 'derived';
  readonly method: string;
  readonly assumption: string;
  /** Never empty. Every input is itself a tagged fact. */
  readonly inputs: readonly SourceRef[];
}

export type Provenance = ReportedProvenance | DerivedProvenance;

export interface Figure {
  readonly value: number;
  readonly unit: Unit;
  /** XBRL `decimals` for a reported figure; the coarsest input's for a derived one. */
  readonly decimals: number | null;
  readonly provenance: Provenance;
}

export function reportedFigure(value: number, unit: Unit, sourceRef: SourceRef): Figure {
  return {
    value,
    unit,
    decimals: sourceRef.decimals,
    provenance: { kind: 'reported', sourceRef },
  };
}

/** Thrown only for a programming error: a derivation with no inputs is a bug. */
export class ProvenanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProvenanceError';
  }
}

export function derivedFigure(
  value: number,
  unit: Unit,
  detail: {
    readonly method: string;
    readonly assumption: string;
    readonly inputs: readonly SourceRef[];
    readonly decimals: number | null;
  },
): Figure {
  if (detail.inputs.length === 0) {
    throw new ProvenanceError(
      `Derivation ${detail.method} produced a figure with no source refs. Invariant 2.2 forbids it.`,
    );
  }

  return {
    value,
    unit,
    decimals: detail.decimals,
    provenance: {
      kind: 'derived',
      method: detail.method,
      assumption: detail.assumption,
      inputs: detail.inputs,
    },
  };
}

export function isReported(figure: Figure): boolean {
  return figure.provenance.kind === 'reported';
}

/** Total by construction: never empty, for any figure this module can build. */
export function sourceRefsOf(figure: Figure): readonly SourceRef[] {
  return figure.provenance.kind === 'reported'
    ? [figure.provenance.sourceRef]
    : figure.provenance.inputs;
}

/**
 * The coarsest precision among a set of inputs. Adding a figure reported to the
 * million to one reported to the thousand yields a sum trustworthy only to the
 * million, and `decimals` is XBRL's own sign convention for that: -6 is coarser
 * than -3, so the coarsest is the minimum.
 */
export function coarsestDecimals(figures: readonly Figure[]): number | null {
  let coarsest: number | null = null;

  for (const figure of figures) {
    if (figure.decimals === null) return null;
    coarsest = coarsest === null ? figure.decimals : Math.min(coarsest, figure.decimals);
  }

  return coarsest;
}

/**
 * The rounding slack implied by `decimals`. A figure reported to the million
 * (`decimals = -6`) can be off by up to half a million and still be the same
 * number. Comparisons between reported figures use this rather than an
 * arbitrary epsilon.
 */
export function roundingTolerance(decimals: number | null): number {
  return decimals === null ? 0 : 0.5 * 10 ** -decimals;
}
