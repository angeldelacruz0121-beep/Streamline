// @vitest-environment node
/**
 * The contract, checked where it is load-bearing: at compile time.
 *
 * Most of what `source.ts` guarantees is not observable at runtime. A test that
 * only exercised runtime behaviour would pass on the day the brand stopped
 * working. So the assertions here are `@ts-expect-error` directives — each one
 * fails `npm run typecheck` the moment the type it guards stops being enforced,
 * because an unused expect-error is itself an error.
 */
import { describe, expect, it } from 'vitest';
import { companyBoundary } from '../data/validate/company-schema.ts';
import type { CompanyView } from '../data/model/company.ts';
import type { Validated } from './brand';
import type { CompanySource, SourceResult } from './source';
import { readFixtureView } from '../../tests/infra/company-fixtures';

/** Stands in for the store: it accepts a validated view and nothing else. */
function acceptsOnlyValidated(view: Validated<CompanyView>): string {
  return view.kind;
}

describe('the renderer cannot be handed an unvalidated company', () => {
  it('rejects a raw CompanyView at the seam', () => {
    const raw = readFixtureView('xom') as CompanyView;

    // @ts-expect-error - a raw CompanyView must never satisfy Validated<CompanyView>.
    // If this line ever compiles, Invariant 4.3's compile-time half is gone.
    acceptsOnlyValidated(raw);

    expect(raw.kind).toBe('out-of-coverage');
  });

  it('accepts the output of the boundary', () => {
    const validated = companyBoundary.parse(readFixtureView('xom'));

    expect(acceptsOnlyValidated(validated)).toBe('out-of-coverage');
  });

  it('will not let a source return an unvalidated view', () => {
    const raw = readFixtureView('msft') as CompanyView;

    const skipsTheBoundary = (): Promise<SourceResult> =>
      // @ts-expect-error - `view` is `Validated<CompanyView>`. A source cannot
      // fabricate one, so the only way to build this result is to have parsed.
      Promise.resolve({ kind: 'view', provenance: null, view: raw });

    const cheating: CompanySource = {
      id: 'cheating',
      label: 'A source that skipped the boundary',
      fetchCompanyView: skipsTheBoundary,
    };

    expect(cheating.id).toBe('cheating');
  });
});

describe('the adapter interface is source-neutral', () => {
  /**
   * Implemented inline with no SEC import in scope. If `CompanySource` ever
   * grows a field only EDGAR can supply — an accession, a CIK, a rate-limit
   * budget — this stops compiling, which is the earliest possible warning that
   * Invariant 4.4 has been breached.
   */
  it('is implementable with no knowledge of any particular source', async () => {
    const minimal: CompanySource = {
      id: 'minimal',
      label: 'Minimal',
      fetchCompanyView: (request) =>
        Promise.resolve({
          kind: 'source-failure',
          failure: {
            kind: 'not-found',
            detail: `Nothing held for ${request.companyId}.`,
            provenance: null,
            retryAfterMs: null,
            status: null,
          },
        }),
    };

    const result = await minimal.fetchCompanyView({ companyId: 'anything' });

    expect(result.kind).toBe('source-failure');
  });

  it('keeps refusals off the failure channel', () => {
    // Decision 0012, stated as a type. `out-of-coverage` is a `CompanyView`
    // arm, so there is no `SourceFailureKind` for it and there must never be.
    const kinds: SourceResult['kind'][] = [
      'view',
      'incomplete-accession',
      'source-failure',
      'invalid-payload',
    ];

    expect(kinds).toHaveLength(4);
    // @ts-expect-error - a data-quality finding is not a source result kind.
    const invalid: SourceResult['kind'] = 'out-of-coverage';
    expect(invalid).toBe('out-of-coverage');
  });
});
