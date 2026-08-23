/**
 * The canonical company object, and the reason it is a union.
 *
 * Keel's boundary (`src/types/boundary.ts`) rejects malformed input and mints
 * `Validated<T>` for everything else. But "Microsoft's segment revenues do not
 * sum to consolidated revenue" is not malformed input — it is a well-formed,
 * fully-sourced finding that Invariants 1 and 2.4 require the product to
 * *render*, naming the discrepancy. If that travelled as a validation issue it
 * would reach the renderer as a string with no figures attached.
 *
 * So `CompanyView` is a discriminated union whose non-renderable arms are
 * first-class data-quality states, and the boundary validates the whole union.
 * Malformed input still fails the boundary; an honest refusal to draw rivers
 * passes it, carrying the numbers that justify the refusal.
 */
import type { Figure } from './figure.ts';
import type { FiscalPeriod } from './period.ts';
import type { SourceRef } from './source-ref.ts';

export interface Entity {
  readonly cik: string;
  readonly name: string;
  readonly sic: string | null;
  readonly sicDescription: string | null;
  /** EDGAR's `category`, verbatim. The input to a late-filing rule (Invariant 2.5). */
  readonly filerCategory: string | null;
  readonly tickers: readonly string[];
  readonly exchanges: readonly string[];
}

export interface FilingRef {
  readonly accession: string;
  readonly form: string;
  readonly filedAt: string;
  readonly periodOfReport: string;
  /** The archive file the figures were read from. */
  readonly documentFile: string;
}

/** How a segment got its display name. Surfaced so a fallback name is visible as one. */
export type LabelSource = 'label-linkbase' | 'rendered-report' | 'member-local-name';

/**
 * One cost the filer discloses for one segment. The set is filer-shaped and its
 * size varies between filers and between segments (D11): each entry exists
 * because the filer tagged it, never to fill a template.
 */
export interface Constriction {
  /** The XBRL tag, qualified: `us-gaap:CostOfGoodsAndServicesSold`. */
  readonly id: string;
  /** The filer's own label for it. */
  readonly label: string;
  readonly amount: Figure;
  /**
   * Which way the item moves the flow. A segment cost always `reduces`. The
   * trunk carries both: income tax reduces, a non-operating gain `increases`.
   * Carried as direction rather than as a negated value so the figure stays the
   * filer's reported amount, sign and all.
   */
  readonly direction: ConstrictionDirection;
}

export type ConstrictionDirection = 'reduces' | 'increases';

/**
 * Whether the disclosed costs actually carry revenue down to the reported
 * profit.
 *
 * **On a rendered company this is always closed, and `residual` is always
 * `null`.** `segment-bridge-must-close-v1` refuses the filing when a segment's
 * cost stack does not add up, so an open bridge never reaches a renderer. It
 * used to render with a warning; that let a constriction whose width is not a
 * number the filer reported be drawn to scale, which Invariant 3.1 forbids and
 * which no reader would catch.
 *
 * The pair is kept rather than reduced to nothing because it is the assertion
 * itself: a reader of this object is entitled to see that the arithmetic was
 * checked and closed, not to take it on trust.
 */
export interface SegmentBridge {
  readonly closes: boolean;
  readonly residual: Figure | null;
}

export interface Segment {
  /** The member QName, e.g. `msft:IntelligentCloudMember`. Stable across periods. */
  readonly id: string;
  readonly label: string;
  readonly labelSource: LabelSource;
  readonly revenue: Figure;
  readonly constrictions: readonly Constriction[];
  readonly operatingIncome: Figure;
  readonly bridge: SegmentBridge;
}

/**
 * The shared constriction after the confluence (Invariant 3.2, D16).
 *
 * `residual` is the gap between what the segments earned and what the company
 * kept. `components` are the reported items that fill it — tax and
 * non-operating amounts read from the filing, not apportioned. `unexplained` is
 * whatever the components fail to account for, kept visible rather than
 * rounded away.
 */
export interface TrunkConstriction {
  readonly segmentOperatingIncomeTotal: Figure;
  readonly consolidatedOperatingIncome: Figure | null;
  readonly netEarnings: Figure;
  readonly residual: Figure;
  readonly components: readonly Constriction[];
  readonly unexplained: Figure;
  readonly fullyExplained: boolean;
}

/** Invariant 2.4. Rendered whether or not it passes. */
export interface RevenueReconciliation {
  readonly segmentRevenueTotal: Figure;
  readonly consolidatedRevenue: Figure;
  readonly difference: Figure;
  /** |difference| / consolidated revenue. */
  readonly ratio: number;
  readonly tolerance: number;
  readonly withinTolerance: boolean;
  /**
   * The unallocated corporate and elimination amounts the filer discloses on the
   * segment axis. Rendered explicitly, never silently dropped.
   */
  readonly unallocated: readonly Constriction[];
}

/** The `NumberOfReportableSegments` cross-check. */
export interface SegmentCountCheck {
  readonly enumerated: number;
  /** `null` when the filer does not tag the count at all. */
  readonly reported: number | null;
  readonly agrees: boolean;
  readonly reportedSourceRef: SourceRef | null;
}

export type NoteSeverity = 'info' | 'warning';

/** Something true about this data that a reader must be told. Never a log line. */
export interface DataNote {
  readonly code: string;
  readonly severity: NoteSeverity;
  readonly message: string;
}

export interface RenderableCompany {
  readonly kind: 'renderable';
  readonly entity: Entity;
  readonly filing: FilingRef;
  readonly period: FiscalPeriod;
  readonly segments: readonly Segment[];
  readonly trunk: TrunkConstriction;
  readonly reconciliation: RevenueReconciliation;
  readonly segmentCount: SegmentCountCheck;
  readonly notes: readonly DataNote[];
}

/** The filer is outside the v1 coverage test (Invariant 1). */
export interface OutOfCoverage {
  readonly kind: 'out-of-coverage';
  readonly entity: Entity;
  readonly detail: string;
  readonly ranges: readonly (readonly [number, number])[];
}

/**
 * The filing's segment tagging cannot be resolved to a confident set of
 * segments. Carries what was found so the discrepancy can be named on screen.
 */
export interface SegmentIdentityUnresolved {
  readonly kind: 'segment-identity-unresolved';
  readonly entity: Entity;
  readonly filing: FilingRef;
  readonly enumeratedMembers: readonly string[];
  readonly reportedSegmentCount: number | null;
  readonly detail: string;
  readonly notes: readonly DataNote[];
}

/** Segment revenues do not reconcile to consolidated revenue within tolerance. */
export interface ReconciliationBreak {
  readonly kind: 'reconciliation-break';
  readonly entity: Entity;
  readonly filing: FilingRef;
  readonly period: FiscalPeriod;
  readonly reconciliation: RevenueReconciliation;
  readonly detail: string;
  readonly notes: readonly DataNote[];
}

/** The accession does not carry the artifacts dimensional facts are read from. */
export interface IncompleteFiling {
  readonly kind: 'incomplete-filing';
  readonly entity: Entity;
  readonly filing: FilingRef | null;
  readonly missing: readonly string[];
  readonly detail: string;
}

/** The filing is readable but discloses no segment axis at all. */
export interface NoSegmentDisclosure {
  readonly kind: 'no-segment-disclosure';
  readonly entity: Entity;
  readonly filing: FilingRef;
  readonly detail: string;
}

export type CompanyView =
  | RenderableCompany
  | OutOfCoverage
  | SegmentIdentityUnresolved
  | ReconciliationBreak
  | IncompleteFiling
  | NoSegmentDisclosure;

export function isRenderable(view: CompanyView): view is RenderableCompany {
  return view.kind === 'renderable';
}

/**
 * Every figure a renderer could reach, flattened. The test that proves Invariant
 * 2.2 walks this: nothing in it may lack a source ref, and `sourceRefsOf` makes
 * that unrepresentable rather than merely unlikely.
 */
export function renderableFigures(view: CompanyView): readonly Figure[] {
  if (view.kind === 'reconciliation-break') {
    return [
      view.reconciliation.segmentRevenueTotal,
      view.reconciliation.consolidatedRevenue,
      view.reconciliation.difference,
      ...view.reconciliation.unallocated.map((item) => item.amount),
    ];
  }

  if (view.kind !== 'renderable') return [];

  const figures: Figure[] = [];

  for (const segment of view.segments) {
    figures.push(segment.revenue, segment.operatingIncome);
    for (const constriction of segment.constrictions) figures.push(constriction.amount);
    if (segment.bridge.residual !== null) figures.push(segment.bridge.residual);
  }

  figures.push(
    view.trunk.segmentOperatingIncomeTotal,
    view.trunk.netEarnings,
    view.trunk.residual,
    view.trunk.unexplained,
    view.reconciliation.segmentRevenueTotal,
    view.reconciliation.consolidatedRevenue,
    view.reconciliation.difference,
  );

  if (view.trunk.consolidatedOperatingIncome !== null) {
    figures.push(view.trunk.consolidatedOperatingIncome);
  }

  for (const component of view.trunk.components) figures.push(component.amount);
  for (const item of view.reconciliation.unallocated) figures.push(item.amount);

  return figures;
}
