import type { ZodType } from 'zod';
import type { BoundaryValidator, ValidationIssue, ValidationResult, Validated } from './brand';

/** Thrown by `BoundaryValidator.parse` when input fails the schema. */
export class BoundaryValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(
      `Rejected at the pipeline boundary: ${issues
        .map((issue) => `${formatPath(issue.path)}: ${issue.message}`)
        .join('; ')}`,
    );
    this.name = 'BoundaryValidationError';
    this.issues = issues;
  }
}

function formatPath(path: readonly (string | number)[]): string {
  return path.length === 0 ? '<root>' : path.join('.');
}

/**
 * Invariant 4.3, runtime half. Wraps a schema into the single gate that can
 * produce a `Validated<T>`. Unvalidated input cannot reach anything downstream
 * because nothing downstream accepts an unbranded value.
 *
 * Generic over the schema on purpose: this file owns the mechanism, never the
 * financial semantics. The schemas themselves belong to `src/data/validate/`.
 */
export function defineBoundary<T>(schema: ZodType<T>): BoundaryValidator<T> {
  const check = (input: unknown): ValidationResult<T> => {
    const result = schema.safeParse(input);

    if (result.success) {
      return { ok: true, value: result.data as Validated<T> };
    }

    return { ok: false, issues: result.error.issues.map(toIssue) };
  };

  return {
    check,
    parse: (input: unknown): Validated<T> => {
      const result = check(input);

      if (!result.ok) {
        throw new BoundaryValidationError(result.issues);
      }

      return result.value;
    },
  };
}

function toIssue(issue: { path: PropertyKey[]; message: string }): ValidationIssue {
  return {
    path: issue.path.map((segment) => (typeof segment === 'symbol' ? segment.toString() : segment)),
    message: issue.message,
  };
}
