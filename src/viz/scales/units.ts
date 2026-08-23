/**
 * What "a dollar" means to `src/viz/scales`. Fixed here so no scale has to guess.
 *
 * Invariant 2.6 keeps currency on the data object. A scale is a pure function of a
 * *magnitude*; by the time a number reaches this directory the pipeline has already
 * established it is USD. `Usd` is therefore a plain number in FULL US DOLLARS — the
 * same unit `Figure.value` carries for a monetary fact — and never millions. A silent
 * millions/dollars mix-up is the one unit error that would rescale the whole canvas by
 * 10^6 without failing a single geometric assertion, so the conversion is explicit and
 * named at every call site.
 *
 * The filings quote Microsoft in millions. `usdFromMillions` is the only bridge.
 */

/** A magnitude in full US dollars. */
export type Usd = number;

export const USD_PER_THOUSAND = 1_000;
export const USD_PER_MILLION = 1_000_000;
export const USD_PER_BILLION = 1_000_000_000;

export function usdFromMillions(millions: number): Usd {
  return millions * USD_PER_MILLION;
}

export function usdFromBillions(billions: number): Usd {
  return billions * USD_PER_BILLION;
}

export function millionsFromUsd(usd: Usd): number {
  return usd / USD_PER_MILLION;
}

/**
 * A scale was handed a quantity outside its documented domain. This is always a
 * programming error or an unvalidated figure reaching the renderer — never a
 * data-quality state, which is reported as a value, not thrown.
 */
export class ScaleDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScaleDomainError';
  }
}

export function assertFinite(value: number, what: string): void {
  if (!Number.isFinite(value)) {
    throw new ScaleDomainError(`${what} must be a finite number; received ${String(value)}.`);
  }
}

export function assertNonNegative(value: number, what: string): void {
  assertFinite(value, what);
  if (value < 0) {
    throw new ScaleDomainError(`${what} must be >= 0; received ${value}.`);
  }
}
