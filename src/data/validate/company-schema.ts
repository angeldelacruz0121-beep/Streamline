/**
 * The pipeline boundary for financial data (Invariant 4.3).
 *
 * Keel owns the mechanism — `defineBoundary` mints `Validated<T>`, and nothing
 * else can. This file owns the semantics: the schema below is the only
 * description of what a company object may contain, and it is deliberately
 * stricter than the TypeScript types in two places the types cannot reach.
 *
 * A reported figure must carry a `sourceRef`. A derived figure must carry a
 * method, an assumption, and at least one input source ref. `z.union` on
 * `provenance` makes a figure without either unrepresentable at runtime as well
 * as at compile time, which is what Invariant 2.2 asks for: a number with no
 * traceable source does not render, because it cannot get past this line.
 *
 * The union includes the data-quality states. That is the point of the shape:
 * "this filer is out of coverage" and "these revenues do not reconcile" are
 * well-formed, fully-sourced findings the product must render, not malformed
 * input to reject. Malformed input still fails here.
 */
import { z } from 'zod';
import { defineBoundary } from '../../types/boundary.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an ISO date');

const dimensionRef = z.object({
  axis: z.string().min(1),
  axisNamespace: z.string(),
  axisLocalName: z.string().min(1),
  member: z.string().min(1),
  memberNamespace: z.string(),
  memberLocalName: z.string().min(1),
});

const sourceRef = z.object({
  cik: z.string().min(1),
  accession: z.string().min(1),
  form: z.string().min(1),
  documentFile: z.string().min(1),
  fiscalYear: z.number().int(),
  fiscalPeriod: z.string().min(1),
  periodStart: isoDate.nullable(),
  periodEnd: isoDate,
  taxonomy: z.string(),
  namespace: z.string(),
  tag: z.string().min(1),
  contextRef: z.string().min(1),
  unitRef: z.string().nullable(),
  decimals: z.number().nullable(),
  dimensions: z.array(dimensionRef).readonly(),
  factId: z.string().nullable(),
});

const unit = z.union([
  z.object({ kind: z.literal('monetary'), currency: z.string().length(3) }),
  z.object({ kind: z.literal('count'), measure: z.string().min(1) }),
  z.object({ kind: z.literal('pure') }),
]);

const provenance = z.union([
  z.object({ kind: z.literal('reported'), sourceRef }),
  z.object({
    kind: z.literal('derived'),
    method: z.string().min(1),
    assumption: z.string().min(1),
    /** Non-empty: a derivation with no inputs has no provenance. */
    inputs: z.array(sourceRef).min(1).readonly(),
  }),
]);

const figure = z.object({
  value: z.number().finite(),
  unit,
  decimals: z.number().nullable(),
  provenance,
});

const constriction = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: figure,
  direction: z.union([z.literal('reduces'), z.literal('increases')]),
});

const entity = z.object({
  cik: z.string().min(1),
  name: z.string().min(1),
  sic: z.string().nullable(),
  sicDescription: z.string().nullable(),
  filerCategory: z.string().nullable(),
  tickers: z.array(z.string()).readonly(),
  exchanges: z.array(z.string()).readonly(),
});

const filingRef = z.object({
  accession: z.string().min(1),
  form: z.string().min(1),
  filedAt: z.string().min(1),
  periodOfReport: z.string(),
  documentFile: z.string(),
});

const fiscalPeriod = z.object({
  kind: z.union([z.literal('annual'), z.literal('quarterly'), z.literal('instant')]),
  fiscalYear: z.number().int(),
  focus: z.union([
    z.literal('FY'),
    z.literal('Q1'),
    z.literal('Q2'),
    z.literal('Q3'),
    z.literal('Q4'),
  ]),
  start: isoDate.nullable(),
  end: isoDate,
  days: z.number().int().nullable(),
  weekBasis: z.union([
    z.literal('calendar-months'),
    z.literal('52-week'),
    z.literal('53-week'),
    z.literal('irregular'),
  ]),
  fiscalYearEndMonthDay: z.string().regex(/^\d{2}-\d{2}$/),
  calendarAligned: z.boolean(),
  transition: z.boolean(),
  label: z.string().min(1),
});

const segment = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  labelSource: z.union([
    z.literal('label-linkbase'),
    z.literal('rendered-report'),
    z.literal('member-local-name'),
  ]),
  revenue: figure,
  constrictions: z.array(constriction).readonly(),
  operatingIncome: figure,
  bridge: z.object({ closes: z.boolean(), residual: figure.nullable() }),
});

const trunk = z.object({
  segmentOperatingIncomeTotal: figure,
  consolidatedOperatingIncome: figure.nullable(),
  netEarnings: figure,
  residual: figure,
  components: z.array(constriction).readonly(),
  unexplained: figure,
  fullyExplained: z.boolean(),
});

const reconciliation = z.object({
  segmentRevenueTotal: figure,
  consolidatedRevenue: figure,
  difference: figure,
  ratio: z.number().nonnegative(),
  tolerance: z.number().positive(),
  withinTolerance: z.boolean(),
  unallocated: z.array(constriction).readonly(),
});

const dataNote = z.object({
  code: z.string().min(1),
  severity: z.union([z.literal('info'), z.literal('warning')]),
  message: z.string().min(1),
});

const sicRange = z.tuple([z.number().int(), z.number().int()]).readonly();

export const companyViewSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('renderable'),
    entity,
    filing: filingRef,
    period: fiscalPeriod,
    /** At least one river, or there is nothing to render. */
    segments: z.array(segment).min(1).readonly(),
    trunk,
    reconciliation,
    segmentCount: z.object({
      enumerated: z.number().int().nonnegative(),
      reported: z.number().int().nullable(),
      agrees: z.boolean(),
      reportedSourceRef: sourceRef.nullable(),
    }),
    notes: z.array(dataNote).readonly(),
  }),
  z.object({
    kind: z.literal('out-of-coverage'),
    entity,
    detail: z.string().min(1),
    ranges: z.array(sicRange).readonly(),
  }),
  z.object({
    kind: z.literal('segment-identity-unresolved'),
    entity,
    filing: filingRef,
    enumeratedMembers: z.array(z.string()).readonly(),
    reportedSegmentCount: z.number().int().nullable(),
    detail: z.string().min(1),
    notes: z.array(dataNote).readonly(),
  }),
  z.object({
    kind: z.literal('reconciliation-break'),
    entity,
    filing: filingRef,
    period: fiscalPeriod,
    reconciliation,
    detail: z.string().min(1),
    notes: z.array(dataNote).readonly(),
  }),
  z.object({
    kind: z.literal('incomplete-filing'),
    entity,
    filing: filingRef.nullable(),
    missing: z.array(z.string()).readonly(),
    detail: z.string().min(1),
  }),
  z.object({
    kind: z.literal('no-segment-disclosure'),
    entity,
    filing: filingRef,
    detail: z.string().min(1),
  }),
]);

/**
 * The gate. Nothing downstream of this accepts an unbranded company object, so
 * this is the only way one reaches a renderer.
 */
export const companyBoundary = defineBoundary(companyViewSchema);

export type CompanyViewFromSchema = z.infer<typeof companyViewSchema>;
