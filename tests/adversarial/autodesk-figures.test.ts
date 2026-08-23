// @vitest-environment node
/**
 * Autodesk is the only filer in the corpus that renders. This file checks
 * whether what it renders is TRUE, by reading the same accession from a second
 * EDGAR path and comparing.
 *
 * This is the technique decision 0016 records: the $133,749M error was found by
 * reading the filing instead of trusting the summary. Every figure asserted
 * below was read from `us-gaap` companyconcept — a different endpoint from the
 * XBRL instance the segments route parses — and the capture is committed beside
 * this file so the claim survives a context clear.
 *
 * Reading path for every figure here: **companyconcept**
 * (`https://data.sec.gov/api/xbrl/companyconcept/CIK0000769397/us-gaap/<tag>.json`),
 * NOT the instance document. Angel's condition on assumption 2: say which path
 * it was. Both paths carry accession `0000769397-26-000015`, so they are two
 * readings of one filing, not two filings.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readManifest, readEnvelope, repoRoot } from '../helpers/adversarial-corpus.ts';

const ACCESSION = '0000769397-26-000015';
const PERIOD = { start: '2025-02-01', end: '2026-01-31' } as const;

/** Reads one figure out of a captured companyconcept envelope. Never out of pipeline output. */
function fromCompanyConcept(tag: string): number {
  const raw = readFileSync(
    `${repoRoot()}fixtures/verified/autodesk-0000769397-${tag}.json`,
    'utf8',
  );
  const inner = JSON.parse((JSON.parse(raw) as { value: { text: string } }).value.text) as {
    units: { USD: { start: string; end: string; form: string; accn: string; val: number }[] };
  };
  const rows = inner.units.USD.filter(
    (r) =>
      r.start === PERIOD.start && r.end === PERIOD.end && r.form === '10-K' && r.accn === ACCESSION,
  );
  if (rows.length !== 1) throw new Error(`Expected one ${tag} row, got ${String(rows.length)}.`);
  return rows[0]!.val;
}

function autodeskView(): Record<string, any> {
  const row = readManifest().find((r) => r.ticker === 'ADSK')!;
  return (readEnvelope(row.file) as { view: Record<string, any> }).view;
}

describe('Autodesk FY2026 — the rendered figures against the wire', () => {
  it('the view and the evidence describe the same filing', () => {
    expect(autodeskView().filing.accession).toBe(ACCESSION);
  });

  it('segment revenue is right: $7,206M', () => {
    expect(autodeskView().segments[0].revenue.value).toBe(
      fromCompanyConcept('RevenueFromContractWithCustomerExcludingAssessedTax'),
    );
  });

  it('net earnings is right: $1,124M', () => {
    expect(autodeskView().trunk.netEarnings.value).toBe(fromCompanyConcept('NetIncomeLoss'));
  });

  /**
   * BUG — filed with Angel for routing to Financial Data Analyst.
   * Severity: this is a breach of STATUS.md §0's binary gate, "no figure
   * displayed anywhere in the application is invented."
   *
   * The view reports `trunk.consolidatedOperatingIncome` as $1,124,000,000.
   * `us-gaap:OperatingIncomeLoss` for that exact accession and period is
   * $1,578,000,000. The rendered figure is not the reported figure, and the
   * $454M difference is Autodesk's entire trunk constriction.
   *
   * Root cause is visible in the view's own provenance. Autodesk tags
   * `us-gaap:NetIncomeLoss` on its segment axis. `NetIncomeLoss` is third in
   * `SEGMENT_PROFIT_CONCEPTS` (src/data/normalize/segment-facts.ts:55-61), so it
   * resolves as the segment profit measure — and that segment-level value then
   * also populates `consolidatedOperatingIncome`, which must come from the
   * undimensioned consolidated fact. `trunk.residual` is therefore 0 and the
   * trunk constriction vanishes.
   *
   * The arithmetic confirming the diagnosis is in the next test.
   */
  it('consolidated operating income is WRONG: view says $1,124M, wire says $1,578M', () => {
    const view = autodeskView();
    const wire = fromCompanyConcept('OperatingIncomeLoss');

    expect(wire).toBe(1_578_000_000);
    expect(view.trunk.consolidatedOperatingIncome.value).toBe(1_124_000_000);
    expect(view.trunk.consolidatedOperatingIncome.value).not.toBe(wire);

    // The trunk collapses as a direct result.
    expect(view.trunk.residual.value).toBe(0);
    expect(wire - view.trunk.netEarnings.value).toBe(454_000_000);
  });

  /**
   * BUG — same filing, and the more damaging half, because it inverts the
   * structural claim the whole metaphor rests on.
   *
   * Invariant §1: "The trunk constriction exists because segment reporting
   * stops at operating income. Tax and non-operating items are real, reported,
   * and attributable to no individual segment, so they cannot narrow any single
   * river without being invented." D16 says the same.
   *
   * Autodesk's single river carries `Provision for income taxes` ($479M) and
   * `Interest and other (income) expense, net` ($25M) as river constrictions.
   * Tax narrows the river. The trunk carries nothing.
   *
   * The proof that these two belong in the trunk is arithmetic: removing them
   * and only them from the constriction set lands exactly on the reported
   * operating income, to the dollar.
   *
   * Why it happens is worth stating, because it is not Autodesk being strange:
   * a single-segment filer under ASU 2023-07 may tag every income-statement
   * line to its one segment, so below-the-line items arrive dimensioned on the
   * segment axis and nothing downstream separates them. Every single-segment
   * filer that renders will hit this.
   */
  it('tax and non-operating items are drawn as river constrictions, not the trunk', () => {
    const constrictions = autodeskView().segments[0].constrictions as {
      label: string;
      amount: { value: number };
    }[];

    const belowTheLine = constrictions.filter(
      (c) => /income taxes/i.test(c.label) || /interest and other/i.test(c.label),
    );
    expect(belowTheLine.map((c) => c.label)).toEqual([
      'Interest and other (income) expense, net',
      'Provision for income taxes',
    ]);

    const total = constrictions.reduce((sum, c) => sum + c.amount.value, 0);
    const belowTotal = belowTheLine.reduce((sum, c) => sum + c.amount.value, 0);
    const revenue = autodeskView().segments[0].revenue.value as number;

    expect(belowTotal).toBe(504_000_000);
    // Remove exactly these two and the river ends on the reported operating income.
    expect(revenue - (total - belowTotal)).toBe(fromCompanyConcept('OperatingIncomeLoss'));
  });

  /**
   * Not a bug — recorded because it is the one filer proving the honest paths
   * work. Autodesk's disclosed costs do not close its own bridge, and the view
   * says so rather than folding the gap into a cost.
   */
  it('the open segment bridge is disclosed rather than absorbed', () => {
    const codes = (autodeskView().notes as { code: string }[]).map((n) => n.code);
    expect(codes).toContain('segment-bridge-open');
    expect(codes).toContain('trunk-components-discarded');
  });

  /**
   * PREDICTION FALSIFIED — recorded because a plan that only reports its hits
   * is not a test of anything.
   *
   * I predicted a Jan-31 fiscal-year filer would be labelled off by one. It is
   * not. Autodesk calls the year ending 2026-01-31 "fiscal 2026" and so does
   * the view: fiscalYear 2026, label "FY2026", calendarAligned false. The date
   * arithmetic Financial Data Analyst flagged as untested against a real filer
   * is correct for this one.
   */
  it('the Jan-31 fiscal year is labelled FY2026, matching the filer', () => {
    const period = autodeskView().period;
    expect(period.fiscalYear).toBe(2026);
    expect(period.label).toBe('FY2026');
    expect(period.end).toBe('2026-01-31');
    expect(period.calendarAligned).toBe(false);
    expect(period.days).toBe(365);
  });
});
