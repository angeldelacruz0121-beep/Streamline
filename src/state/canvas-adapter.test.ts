// @vitest-environment node
/**
 * The translation between Ledger's vocabulary and Cartographer's.
 *
 * Every figure asserted here is Microsoft's real FY2026 10-K, read from a
 * captured response. Nothing is invented (Invariant 4.5), and the arithmetic is
 * checked against `composeTrunk`'s independent computation rather than against a
 * number typed in by hand.
 */
import { describe, expect, it, vi } from 'vitest';
import { companyBoundary } from '../data/validate/company-schema.ts';
import { composeCanvas } from '../viz/encoding';
import {
  TRUNK_CONSTRICTION_LABEL,
  composeFromCompany,
  toCanvasInput,
  toResidualComponents,
} from './canvas-adapter';
import type { RenderableCompany } from '../data/model/company.ts';
import type { Validated } from '../types/brand';
import { readFixtureView } from '../../tests/infra/company-fixtures';

function microsoft(): Validated<RenderableCompany> {
  const view = companyBoundary.parse(readFixtureView('msft'));

  if (view.kind !== 'renderable') throw new Error('fixture is not renderable');

  return view as Validated<RenderableCompany>;
}

describe('the mapping', () => {
  it('carries every reportable segment, not the visible ones (Invariant 3.7)', () => {
    const input = toCanvasInput(microsoft());

    expect(input.segments).toHaveLength(3);
    expect(input.segments.map((segment) => segment.label)).toEqual([
      'Productivity and Business Processes',
      'Intelligent Cloud',
      'More Personal Computing',
    ]);
  });

  it('carries the reported figures through unchanged', () => {
    const input = toCanvasInput(microsoft());

    expect(input.fiscalPeriodLabel).toBe('FY2026');
    expect(input.segments.map((segment) => segment.operatingIncomeUsd)).toEqual([
      83_879_000_000, 56_972_000_000, 14_386_000_000,
    ]);
    expect(input.netEarningsUsd).toBe(133_749_000_000);
    expect(input.segments.reduce((sum, segment) => sum + segment.revenueUsd, 0)).toBe(
      331_839_000_000,
    );
  });

  it('keeps each filer-shaped cost set exactly as disclosed (D11)', () => {
    const input = toCanvasInput(microsoft());

    for (const segment of input.segments) {
      expect(segment.costs.map((cost) => cost.id)).toEqual([
        'us-gaap:CostOfGoodsAndServicesSold',
        'us-gaap:OperatingExpenses',
      ]);
      // Costs plus operating income tie to revenue; `composeRiver` blocks if not.
      const total = segment.costs.reduce((sum, cost) => sum + cost.amountUsd, 0);
      expect(total + segment.operatingIncomeUsd).toBe(segment.revenueUsd);
    }
  });

  it('applies the direction-to-sign rule exactly once, and ties to the residual', () => {
    const view = microsoft();
    const components = toResidualComponents(view.trunk);
    const byId = Object.fromEntries(components.map((part) => [part.id, part.amountUsd]));

    // Income tax reduces the flow; nonoperating income increases it.
    expect(byId['us-gaap:IncomeTaxExpenseBenefit']).toBe(32_185_000_000);
    expect(byId['us-gaap:NonoperatingIncomeExpense']).toBe(-10_697_000_000);
    expect(components.reduce((sum, part) => sum + part.amountUsd, 0)).toBe(
      view.trunk.residual.value,
    );
    expect(view.trunk.residual.value).toBe(21_488_000_000);
  });

  it('reuses the standing trunk label rather than originating copy (0002 C5)', () => {
    expect(toCanvasInput(microsoft()).trunkConstrictionLabel).toBe(TRUNK_CONSTRICTION_LABEL);
  });

  it('withholds an itemisation Ledger says does not tie, and keeps the dollars', () => {
    const view = microsoft();
    const unexplained = {
      ...view,
      trunk: { ...view.trunk, fullyExplained: false },
    } as Validated<RenderableCompany>;

    // The breakdown is withheld — `composeTrunk` blocks on one that does not
    // tie — but `unexplained` is still on the model for the surface to show.
    expect(toResidualComponents(unexplained.trunk)).toEqual([]);
    expect(unexplained.trunk.unexplained.value).toBeDefined();
    expect(composeFromCompany(unexplained).kind).toBe('model');
  });
});

describe('composing', () => {
  it('produces a model whose trunk agrees with the reported figures', () => {
    const outcome = composeFromCompany(microsoft());

    expect(outcome.kind).toBe('model');
    if (outcome.kind !== 'model') return;

    expect(outcome.model.fiscalPeriodLabel).toBe('FY2026');
    expect(outcome.model.rivers).toHaveLength(3);
    expect(outcome.model.totals.netEarningsUsd).toBe(133_749_000_000);
    expect(outcome.model.totals.segmentOperatingIncomeUsd).toBe(155_237_000_000);
    expect(outcome.model.totals.trunkResidualUsd).toBe(21_488_000_000);
    expect(outcome.model.totals.segmentRevenueUsd).toBe(331_839_000_000);
  });

  it('is exactly composeCanvas over the mapped input, with nothing added', () => {
    const view = microsoft();
    const direct = composeCanvas(toCanvasInput(view));
    const throughAdapter = composeFromCompany(view);

    expect(direct.ok).toBe(true);
    if (!direct.ok || throughAdapter.kind !== 'model') return;
    expect(throughAdapter.model).toEqual(direct.value);
  });

  it('carries the display cap and cross-axis room through when given them', () => {
    const input = toCanvasInput(microsoft(), { displayCap: 5, availableCrossAxisPx: 1200 });

    expect(input.displayCap).toBe(5);
    expect(input.availableCrossAxisPx).toBe(1200);
  });
});

describe('refusals', () => {
  it('refuses a non-USD filer rather than converting at an invented rate', () => {
    const view = microsoft();
    const inEuros = {
      ...view,
      segments: view.segments.map((segment, index) =>
        index === 0
          ? {
              ...segment,
              revenue: { ...segment.revenue, unit: { kind: 'monetary', currency: 'EUR' } },
            }
          : segment,
      ),
    } as unknown as Validated<RenderableCompany>;

    const outcome = composeFromCompany(inEuros);

    expect(outcome.kind).toBe('refused');
    if (outcome.kind !== 'refused') return;
    expect(outcome.detail).toContain('EUR');
    expect(outcome.detail).toContain('does not convert');
  });

  it('reports an encoding refusal as reasons rather than as a model', () => {
    const view = microsoft();
    // A segment that lost money at the operating line. Real behaviour, not a
    // contrived one: `composeRiver` declines because the river would have to
    // have negative width.
    const loss = {
      ...view,
      segments: view.segments.map((segment, index) =>
        index === 2
          ? {
              ...segment,
              operatingIncome: { ...segment.operatingIncome, value: -1_000_000_000 },
            }
          : segment,
      ),
    } as Validated<RenderableCompany>;

    const outcome = composeFromCompany(loss);

    expect(['blocked', 'threw']).toContain(outcome.kind);
    if (outcome.kind === 'blocked') {
      expect(outcome.reasons.length).toBeGreaterThan(0);
      expect(outcome.reasons.every((reason) => reason.message.length > 0)).toBe(true);
    }
  });

  /**
   * The catch is permanent, not a workaround.
   *
   * `composeCanvas` is allowed to be non-total — its scales assert their
   * domains on purpose, and Cartographer's fix for the loss case does not
   * change that in general. The app's job is to render the defect rather than
   * blank the page. The encoding module is replaced with one that throws, which
   * is the only honest way to test a catch: the real function currently does
   * not throw for this input, and a test that depended on it doing so would
   * evaporate the moment upstream improved.
   */
  it('turns a thrown encoding into a rendered state, never a white screen', async () => {
    vi.resetModules();
    vi.doMock('../viz/encoding', async () => ({
      ...(await vi.importActual<typeof import('../viz/encoding')>('../viz/encoding')),
      composeCanvas: () => {
        throw new RangeError('width scale received a negative domain value');
      },
    }));

    const { composeFromCompany: withThrowingEncoding } = await import('./canvas-adapter');
    const outcome = withThrowingEncoding(microsoft());

    expect(outcome.kind).toBe('threw');
    if (outcome.kind !== 'threw') return;
    expect(outcome.detail).toContain('RangeError');
    expect(outcome.detail).toContain('negative domain');

    vi.doUnmock('../viz/encoding');
    vi.resetModules();
  });
});
