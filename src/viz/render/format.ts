/**
 * Number presentation for the canvas. ATELIER/ANGEL own the final form; this exists so a
 * figure is never blank and never rounded away, following the precedent
 * `scales/indicator.ts` sets with `formatCompactUsd`.
 *
 * Two rules, and they are not stylistic. Filings quote in millions, so a figure rendered
 * in millions can be checked against the filing by eye without arithmetic — Invariant 2.2
 * traceability is only useful if the reader can complete the trace. And the exact figure
 * is never abbreviated on the lake readout, because 0001 C2 exists precisely so the
 * analyst's path to the number does not route through a lossy channel.
 */
import { USD_PER_MILLION, type Usd } from '../scales';

const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** `$133,749M`. Exact to the dollar when the figure is a whole number of millions. */
export function formatUsdMillions(usd: Usd): string {
  const millions = usd / USD_PER_MILLION;
  const sign = millions < 0 ? '−' : '';
  return `${sign}$${GROUPED.format(Math.abs(millions))}M`;
}

/** For a figure that is not a whole number of millions, fall through to full dollars. */
export function formatUsdExact(usd: Usd): string {
  if (Number.isInteger(usd / USD_PER_MILLION)) return formatUsdMillions(usd);
  const sign = usd < 0 ? '−' : '';
  return `${sign}$${GROUPED.format(Math.abs(usd))}`;
}
