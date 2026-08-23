/**
 * Refusals.
 *
 * The encoding declines rather than approximates. Invariant 4.5 forbids fabricated data
 * and 3.1 forbids bending geometry to make a picture work, so every case where the
 * numbers do not support a drawing returns a reason instead of a shape. Several of these
 * are also the mechanical trigger for an escalation that would otherwise be discovered by
 * eye at company two.
 */
import type { Usd } from '../scales';

export type BlockedCode =
  /** Disclosed costs plus operating income do not equal revenue. Open decision D18. */
  | 'segment-does-not-reconcile'
  /** A segment lost money at the operating line. The river would have negative width. */
  | 'segment-operating-loss'
  /** A disclosed cost is negative, so the river would widen mid-course. Sibling of Q2. */
  | 'negative-cost'
  | 'negative-revenue'
  /** Net earnings exceed the sum of segment operating income. The trunk would widen. Q2. */
  | 'trunk-residual-positive'
  /**
   * The segments sum to a negative operating income, so the trunk itself would arrive with
   * negative width. Reached only when a river refusal has already fired for the same
   * figures; carried anyway so that `composeTrunk` is total for every finite input rather
   * than relying on its caller to have checked first.
   */
  | 'trunk-arriving-negative'
  /** Test record 0001 C3: a water body without its period invites the balance-sheet read. */
  | 'missing-fiscal-period'
  /** Supplied residual components do not sum to the residual. */
  | 'residual-components-do-not-sum'
  | 'display-cap-out-of-range';

export interface Blocked {
  readonly code: BlockedCode;
  /** Which river, constriction, or element. */
  readonly subject: string;
  readonly message: string;
  /** The open decision or question this must be escalated against, or null. */
  readonly escalation: string | null;
  /** The dollar amount that made this fail, where one exists. */
  readonly amountUsd: Usd | null;
}

export type EncodingResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly blocked: readonly Blocked[] };

export function ok<T>(value: T): EncodingResult<T> {
  return { ok: true, value };
}

export function blocked<T>(reasons: readonly Blocked[]): EncodingResult<T> {
  return { ok: false, blocked: reasons };
}
