/**
 * Number presentation for the canvas.
 *
 * THE UNIT SCALES; THE VALUE NEVER MOVES. Angel ruled on 2026-08-26 that the picture reads
 * in billions — `$139.996B` — and that no figure is rounded to get there.
 *
 * The problem being solved is real and it is a five-second-test problem. `$139,996M` makes
 * a first-time reader do long division before learning the segment earned about $140
 * billion, and Invariant 1 gives that reader five seconds. The obvious fix — round to
 * `$140.0B` — was considered and rejected by Angel on the same day, for the reason
 * `kill-list.md` already records against `$133,700M`: it is a value the filer does not
 * publish, and Invariant 2.2 says every number on screen traces to a tagged fact.
 *
 * So the scaling is LOSSLESS, and that is a property, not a hope. Filers tag in whole
 * millions, so a figure divided by a thousand lands in at most three decimal places and
 * `$139,996M` is `$139.996B` exactly — the same number, written where a human can read it.
 * `formatUsdScaled` proves this per call with integer arithmetic rather than assuming it:
 * a value that would not survive the scaling drops to the next unit down, and in the last
 * resort renders as grouped dollars. No code path rounds.
 *
 * Both forms are exact, so which one appears where is a question of audience rather than of
 * accuracy. The canvas draws the scaled form because it is read at a glance; `hit-test.ts`
 * puts the millions form on hover because filings quote in millions and an analyst checking
 * the picture against the 10-K wants the figure in the filing's own units.
 */
import { USD_PER_MILLION, type Usd } from '../scales';

const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const USD_PER_BILLION = 1_000 * USD_PER_MILLION;
const USD_PER_TRILLION = 1_000 * USD_PER_BILLION;

/**
 * Splits `magnitude` into whole units and up to three exact decimal places, or returns null
 * when that cannot be done without losing a cent.
 *
 * Integer arithmetic throughout. `139_996_000_000 / 1_000_000_000` is not exactly 139.996 in
 * binary floating point, so comparing a scaled float back against its source would make the
 * losslessness claim depend on rounding luck. Dividing the remainder by a thousandth of the
 * unit keeps every step on integers, where equality means what it says.
 */
function exactAtScale(magnitude: number, unit: number): string | null {
  const step = unit / 1_000;
  if (magnitude % step !== 0) return null;
  const whole = GROUPED.format(Math.floor(magnitude / unit));
  const thousandths = (magnitude % unit) / step;
  if (thousandths === 0) return whole;
  return `${whole}.${String(thousandths).padStart(3, '0').replace(/0+$/, '')}`;
}

/**
 * `$139.996B`. The form the canvas draws: exact to the dollar, in a unit a person reads.
 *
 * Falls through unit by unit rather than forcing one: a figure that is not a whole thousandth
 * of a billion is shown in millions, and one that is not a whole thousandth of a million is
 * shown as grouped dollars. The fall-through is what makes "no code path rounds" checkable.
 */
export function formatUsdScaled(usd: Usd): string {
  const magnitude = Math.abs(usd);
  const sign = usd < 0 ? '−' : '';
  // No thousands tier. A figure below a million that is not a whole thousandth of a million
  // reads better as grouped dollars than as `$1,234.567K`, and this product's figures come
  // from filings that tag in millions, so the tier would earn its keep about never.
  for (const [unit, suffix] of [
    [USD_PER_TRILLION, 'T'],
    [USD_PER_BILLION, 'B'],
    [USD_PER_MILLION, 'M'],
  ] as const) {
    if (magnitude < unit) continue;
    const digits = exactAtScale(magnitude, unit);
    if (digits !== null) return `${sign}$${digits}${suffix}`;
  }
  return `${sign}$${GROUPED.format(magnitude)}`;
}

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
