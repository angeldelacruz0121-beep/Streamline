/**
 * The compile-time gate on a discriminated union.
 *
 * `CompanyView` has six arms and every one of them is a designed UI state
 * (decision 0012, Ledger A1). "Out of coverage" is not an error, a
 * reconciliation break is not an error, and neither may fall through to a
 * generic failure page. The way to guarantee that at month six — when a seventh
 * arm is added by someone who has never read this file — is to make the
 * omission a type error rather than a runtime surprise.
 *
 * Any `switch` that handles every arm narrows its subject to `never` in the
 * default branch. Passing that subject here compiles. Miss an arm and the
 * subject is still the unhandled member, which is not assignable to `never`, and
 * `npm run typecheck` fails on the line that forgot it.
 *
 * The runtime throw is the second half: a value that reaches here at runtime
 * came from outside the type system (a widened cast, a stale bundle), and
 * failing loudly is better than rendering a blank surface.
 */
export function assertNever(value: never, context: string): never {
  throw new Error(
    `Unhandled ${context}: ${JSON.stringify(value)}. Every arm of this union is a designed state; add a surface for this one.`,
  );
}

/**
 * The total-function form. Use where an exhaustive switch must produce a value
 * rather than render — `exhaustive` documents that the union was closed on
 * purpose and not merely left without a default.
 */
export function exhaustive(value: never, context: string): never {
  return assertNever(value, context);
}
