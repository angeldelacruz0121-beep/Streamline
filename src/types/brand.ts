/**
 * Invariant 4.3, compile-time half.
 *
 * `validated` is declared but never defined, and never exported. No module
 * outside this file can name the symbol, so no module outside this file can
 * construct a value of type `Validated<T>`. A renderer whose parameter is typed
 * `Validated<Company>` therefore cannot be called with a raw `Company`: it is a
 * type error, not a lint rule or a convention.
 *
 * The only way to mint one is `defineBoundary` in `./boundary`, which mints it
 * only after a runtime schema check has passed.
 */
declare const validated: unique symbol;

/** A `T` that has passed the pipeline-boundary check. */
export type Validated<T> = T & { readonly [validated]: true };

/** Strips the brand — the inverse of `Validated`, for signatures that need the raw shape. */
export type Unvalidated<T> = T extends Validated<infer U> ? U : T;

/** One reason an input was rejected at the boundary. */
export interface ValidationIssue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/** The outcome of a non-throwing boundary check. */
export type ValidationResult<T> =
  | { readonly ok: true; readonly value: Validated<T> }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/**
 * The boundary contract. Data owners (Ledger) supply the schema; every consumer
 * downstream of the boundary receives `Validated<T>` or nothing at all.
 */
export interface BoundaryValidator<T> {
  /** Throws `BoundaryValidationError` on invalid input. */
  readonly parse: (input: unknown) => Validated<T>;
  /** Returns the failure instead of throwing — for surfaces that render a data-quality state. */
  readonly check: (input: unknown) => ValidationResult<T>;
}
