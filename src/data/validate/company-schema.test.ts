import { describe, expect, it } from 'vitest';
import {
  companyBoundary,
  companyViewSchema,
  type CompanyViewFromSchema,
} from './company-schema.ts';
import { buildCompanyView } from '../normalize/ingest.ts';
import type { CompanyView } from '../model/company.ts';
import * as MSFT from '../normalize/__fixtures__/msft-fy2026.ts';

/**
 * The schema and the model are one description, checked in both directions. If
 * either drifts, `npm run typecheck` fails here rather than at runtime in front
 * of a user. These are the assertions; calling them is what makes the check run
 * under `noUnusedLocals`.
 */
const schemaSatisfiesModel = (value: CompanyViewFromSchema): CompanyView => value;
const modelSatisfiesSchema = (value: CompanyView): CompanyViewFromSchema => value;

function view(overrides: Partial<Parameters<typeof buildCompanyView>[0]['documents']> = {}) {
  return buildCompanyView({
    submissions: {
      cik: MSFT.MSFT_CIK,
      entityName: 'MICROSOFT CORP',
      sic: MSFT.MSFT_SIC,
      sicDescription: 'Services-Prepackaged Software',
      filerCategory: 'Large accelerated filer',
      tickers: ['MSFT'],
      exchanges: ['Nasdaq'],
    },
    documents: {
      accession: MSFT.MSFT_ACCESSION,
      form: MSFT.MSFT_FORM,
      filedAt: MSFT.MSFT_FILED_AT,
      instanceFile: MSFT.MSFT_INSTANCE_FILE,
      instanceText: MSFT.MSFT_INSTANCE_EXCERPT,
      metaLinksText: MSFT.MSFT_METALINKS_EXCERPT,
      renderedSegmentReportText: MSFT.MSFT_SEGMENT_RFILE_EXCERPT,
      ...overrides,
    },
  });
}

describe('the pipeline boundary', () => {
  it('describes the same shape the model does, in both directions', () => {
    const parsed = companyViewSchema.parse(view());

    expect(schemaSatisfiesModel(parsed).kind).toBe('renderable');
    expect(modelSatisfiesSchema(view()).kind).toBe('renderable');
  });

  it('admits a company built from the filing', () => {
    const result = companyBoundary.check(view());

    expect(result.ok).toBe(true);
  });

  it('admits a data-quality state as a valid value, not as a rejection', () => {
    const broken = view({
      // One segment loses $20B of revenue *and* the same $20B of operating
      instanceText:
        // income, so its own cost stack still bridges exactly and the only thing
        // that fails is Invariant 2.4's sum against consolidated revenue.
        MSFT.MSFT_INSTANCE_EXCERPT.replace('139996000000', '119996000000').replace(
          '83879000000',
          '63879000000',
        ),
    });

    expect(broken.kind).toBe('reconciliation-break');

    const result = companyBoundary.check(broken);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.kind).toBe('reconciliation-break');
  });

  it('rejects a reported figure with no source ref', () => {
    const good = view();

    if (good.kind !== 'renderable') throw new Error('expected a renderable company');

    const stripped = structuredClone(good) as unknown as {
      segments: { revenue: { provenance: Record<string, unknown> } }[];
    };

    delete stripped.segments[0]?.revenue.provenance['sourceRef'];

    const result = companyBoundary.check(stripped);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.length).toBeGreaterThan(0);
  });

  it('rejects a derived figure with no inputs', () => {
    const good = view();

    if (good.kind !== 'renderable') throw new Error('expected a renderable company');

    const emptied = structuredClone(good) as unknown as {
      trunk: { residual: { provenance: { inputs: unknown[] } } };
    };

    emptied.trunk.residual.provenance.inputs = [];

    expect(companyBoundary.check(emptied).ok).toBe(false);
  });

  it('rejects a figure with no unit', () => {
    const good = view();

    if (good.kind !== 'renderable') throw new Error('expected a renderable company');

    const unitless = structuredClone(good) as unknown as {
      segments: { revenue: Record<string, unknown> }[];
    };

    delete unitless.segments[0]?.revenue['unit'];

    expect(companyBoundary.check(unitless).ok).toBe(false);
  });

  it('rejects a renderable company with no segments', () => {
    const good = view();

    if (good.kind !== 'renderable') throw new Error('expected a renderable company');

    expect(companyBoundary.check({ ...good, segments: [] }).ok).toBe(false);
  });

  it('rejects an unknown view kind rather than passing it through', () => {
    expect(companyBoundary.check({ kind: 'looks-fine', entity: {} }).ok).toBe(false);
    expect(companyBoundary.check(null).ok).toBe(false);
    expect(companyBoundary.check('renderable').ok).toBe(false);
  });

  it('throws with the offending paths when parse is used instead of check', () => {
    let thrown: unknown;

    try {
      companyBoundary.parse({ kind: 'renderable' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown)).toContain('Rejected at the pipeline boundary');
  });
});
