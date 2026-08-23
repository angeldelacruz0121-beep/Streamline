/**
 * Fiscal calendar normalisation (Invariant 2.5).
 *
 * Everything here is read from the filing's own cover-page facts rather than
 * inferred from the filing date. `dei:DocumentPeriodEndDate` also identifies the
 * required context — the consolidated, undimensioned duration the cover page is
 * tagged in — which is the context every consolidated figure in this workstream
 * is read from. Finding it this way rather than by looking for "the context with
 * no dimensions" is deliberate: large filings have several.
 */
import {
  normalizeAnnualPeriod,
  type FiscalPeriod,
  type FiscalPeriodFocus,
} from '../model/period.ts';
import type { XbrlContext, XbrlInstance, XbrlQName } from './xbrl-instance.ts';

const DEI_NAMESPACE = /^https?:\/\/xbrl\.sec\.gov\/dei\//;

function isDei(qname: XbrlQName, localName: string): boolean {
  return (
    qname.namespace !== null && DEI_NAMESPACE.test(qname.namespace) && qname.localName === localName
  );
}

/** The raw text of a cover-page fact, or `null` when the filer omitted it. */
export function coverFact(instance: XbrlInstance, localName: string): string | null {
  for (const fact of instance.facts) {
    if (isDei(fact.qname, localName)) return fact.raw;
  }

  return null;
}

function coverFactContext(instance: XbrlInstance, localName: string): string | null {
  for (const fact of instance.facts) {
    if (isDei(fact.qname, localName)) return fact.contextRef;
  }

  return null;
}

export interface FilingPeriod {
  readonly period: FiscalPeriod;
  /** The undimensioned duration context consolidated figures are read from. */
  readonly requiredContext: XbrlContext;
  readonly documentType: string | null;
  readonly amendment: boolean;
  /** Cover-page facts that disagree with the context they are tagged in. */
  readonly warnings: readonly string[];
}

export type FilingPeriodResult =
  | { readonly kind: 'ok'; readonly filingPeriod: FilingPeriod }
  | { readonly kind: 'unresolved'; readonly detail: string };

const FOCUSES: readonly FiscalPeriodFocus[] = ['FY', 'Q1', 'Q2', 'Q3', 'Q4'];

function toFocus(value: string | null): FiscalPeriodFocus {
  const found = FOCUSES.find((focus) => focus === value?.trim().toUpperCase());

  return found ?? 'FY';
}

/**
 * Builds the canonical period for an annual filing.
 *
 * Refuses when the cover page does not carry a period end date, or when the
 * context it is tagged in is not a duration. Both cases mean the document is
 * not the annual instance it was taken for, and guessing a year from the file
 * name would be exactly the kind of invention Invariant 2.2 forbids.
 */
export function readAnnualFilingPeriod(instance: XbrlInstance): FilingPeriodResult {
  const periodEnd = coverFact(instance, 'DocumentPeriodEndDate');
  const contextId = coverFactContext(instance, 'DocumentPeriodEndDate');

  if (periodEnd === null || contextId === null) {
    return {
      kind: 'unresolved',
      detail: 'The instance carries no dei:DocumentPeriodEndDate, so its fiscal period is unknown.',
    };
  }

  const context = instance.contexts.get(contextId);

  if (context === undefined) {
    return {
      kind: 'unresolved',
      detail: `dei:DocumentPeriodEndDate points at context ${contextId}, which the instance does not define.`,
    };
  }

  if (context.period.kind !== 'duration') {
    return {
      kind: 'unresolved',
      detail: `dei:DocumentPeriodEndDate is tagged in an instant context; an annual filing needs a duration.`,
    };
  }

  if (context.dimensions.length > 0) {
    return {
      kind: 'unresolved',
      detail:
        'The cover-page context carries dimensions, so it is not the required context and ' +
        'consolidated figures cannot be read from it.',
    };
  }

  const focusYear = Number(coverFact(instance, 'DocumentFiscalYearFocus'));
  const warnings: string[] = [];

  if (context.period.end !== periodEnd) {
    warnings.push(
      `dei:DocumentPeriodEndDate is ${periodEnd} but its context ends ${context.period.end}.`,
    );
  }

  const period = normalizeAnnualPeriod({
    start: context.period.start,
    end: context.period.end,
    fiscalYear: Number.isFinite(focusYear) ? focusYear : Number(context.period.end.slice(0, 4)),
    focus: toFocus(coverFact(instance, 'DocumentFiscalPeriodFocus')),
    fiscalYearEndMarker: coverFact(instance, 'CurrentFiscalYearEndDate'),
    transitionReport: coverFact(instance, 'DocumentTransitionReport')?.trim() === 'true',
  });

  if (period.fiscalYearEndMonthDay !== period.end.slice(5)) {
    warnings.push(
      `dei:CurrentFiscalYearEndDate says the year ends ${period.fiscalYearEndMonthDay} but this ` +
        `period ends ${period.end.slice(5)}, which is the signature of a fiscal-year change.`,
    );
  }

  return {
    kind: 'ok',
    filingPeriod: {
      period,
      requiredContext: context,
      documentType: coverFact(instance, 'DocumentType'),
      amendment: coverFact(instance, 'AmendmentFlag')?.trim() === 'true',
      warnings,
    },
  };
}
