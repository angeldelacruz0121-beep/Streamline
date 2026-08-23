/**
 * The v1 coverage test (Invariant 1).
 *
 * Technology only, by SIC code as EDGAR reports it on the filer's record. A
 * company outside the ranges renders an explicit out-of-coverage state — never a
 * partial render, and never an approximation of a model built for a different
 * income statement.
 *
 * The ranges are a proxy and they are known to be one: D10 is open precisely
 * because SIC will miss filers that are plainly technology companies and admit
 * some that are not. This module implements the rule as written in Invariant 1
 * and does not soften it. Changing the ranges is Angel's call, not a code
 * change made here.
 *
 * **2026-08-23 — Angel's ruling, after the first adversarial pass.** SIC 3674
 * (Semiconductors & Related Devices) is admitted, and nothing else. It brings in
 * NVIDIA, AMD, Intel, Broadcom, Qualcomm, Micron and TI, all of which run the
 * same income statement the model already handles.
 *
 * SIC **7389 was considered and explicitly rejected**, so a later reader does not
 * reopen it as an oversight. 7389 is "Services-Business Services, NEC" — EDGAR's
 * not-elsewhere-classified catch-all, not a technology classification. It is the
 * code Uber files under, and admitting it would admit the whole residue of the
 * services bucket along with it. Uber is out of coverage by decision.
 *
 * The band was not widened to the whole 36xx range for the same reason: 36xx is
 * electronic and electrical equipment generally, and the rest of it is not this
 * income statement.
 */

/**
 * SIC 3570–3579 computer and office equipment; 3674 semiconductors and related
 * devices; 7370–7379 software and data services.
 */
export const COVERAGE_SIC_RANGES: readonly (readonly [number, number])[] = [
  [3570, 3579],
  [3674, 3674],
  [7370, 7379],
];

export type CoverageResult =
  | { readonly inScope: true; readonly sic: number }
  | { readonly inScope: false; readonly sic: number | null; readonly detail: string };

export function checkCoverage(sic: string | null, sicDescription?: string | null): CoverageResult {
  if (sic === null || sic.trim().length === 0) {
    return {
      inScope: false,
      sic: null,
      detail:
        'EDGAR reports no SIC code for this filer, so the coverage test cannot be applied. ' +
        'Streamline v1 covers SIC 3570–3579, 3674 and 7370–7379 only.',
    };
  }

  const parsed = Number(sic.trim());

  if (!Number.isInteger(parsed)) {
    return {
      inScope: false,
      sic: null,
      detail: `EDGAR reports SIC ${JSON.stringify(sic)} for this filer, which is not a SIC code.`,
    };
  }

  for (const [low, high] of COVERAGE_SIC_RANGES) {
    if (parsed >= low && parsed <= high) return { inScope: true, sic: parsed };
  }

  const named =
    sicDescription === null || sicDescription === undefined ? '' : ` (${sicDescription})`;

  return {
    inScope: false,
    sic: parsed,
    detail:
      `This filer's SIC code is ${String(parsed)}${named}. Streamline v1 covers the technology ` +
      'sector only: SIC 3570–3579 (computer and office equipment), 3674 (semiconductors) and ' +
      '7370–7379 (software and data services). Other sectors need their own income-statement ' +
      'model and are added one at a time.',
  };
}
