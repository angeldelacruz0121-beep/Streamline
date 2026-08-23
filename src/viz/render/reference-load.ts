/**
 * The performance reference load. NOT AN APPLICATION CODE PATH.
 *
 * Invariant 4.5 forbids placeholder financials, invented companies and seeded demo
 * numbers. Nothing here is invented: every figure is Microsoft's own FY2026 disclosure,
 * transcribed from accession 0001193125-26-323660 (filed 2026-07-29, period end
 * 2026-06-30, `us-gaap:StatementBusinessSegmentsAxis`, `msft:` members), and the
 * transcription is checked arithmetically by `reference-load.test.ts` rather than trusted.
 * The corrections recorded in decision 0016 are applied.
 *
 * Invariant 4.1 states the reference load as twelve segments. Microsoft reports three, so
 * `referenceLoad(12)` REPEATS the three real segments four times. Repetition of reported
 * figures is not fabrication — no number appears that Microsoft did not report — and it is
 * the only way to reach the stated load without inventing a filer. The repeated set is
 * suffixed and is never presented as a company.
 *
 * `render/index.ts` deliberately does not re-export this module, and
 * `no-encoding-leak.test.ts` asserts it, so a perf fixture cannot leak into the shell.
 */
import { composeCanvas, type CanvasInput, type CanvasModel, type RiverInput } from '../encoding';
import { usdFromMillions } from '../scales';

export const MSFT_FY2026_SOURCE = {
  cik: '0000789019',
  accession: '0001193125-26-323660',
  filed: '2026-07-29',
  periodEnd: '2026-06-30',
  fiscalPeriodLabel: 'FY2026',
} as const;

/** Exactly as tagged. Revenue − cost of revenue − operating expenses = operating income. */
export const MSFT_FY2026_SEGMENTS: readonly RiverInput[] = [
  {
    id: 'msft:ProductivityAndBusinessProcessesMember',
    label: 'Productivity and Business Processes',
    revenueUsd: usdFromMillions(139_996),
    costs: [
      {
        id: 'us-gaap:CostOfGoodsAndServicesSold',
        label: 'Cost of revenue',
        amountUsd: usdFromMillions(25_017),
      },
      {
        id: 'us-gaap:OperatingExpenses',
        label: 'Operating expenses',
        amountUsd: usdFromMillions(31_100),
      },
    ],
    operatingIncomeUsd: usdFromMillions(83_879),
  },
  {
    id: 'msft:IntelligentCloudMember',
    label: 'Intelligent Cloud',
    revenueUsd: usdFromMillions(137_791),
    costs: [
      {
        id: 'us-gaap:CostOfGoodsAndServicesSold',
        label: 'Cost of revenue',
        amountUsd: usdFromMillions(57_876),
      },
      {
        id: 'us-gaap:OperatingExpenses',
        label: 'Operating expenses',
        amountUsd: usdFromMillions(22_943),
      },
    ],
    operatingIncomeUsd: usdFromMillions(56_972),
  },
  {
    id: 'msft:MorePersonalComputingMember',
    label: 'More Personal Computing',
    revenueUsd: usdFromMillions(54_052),
    costs: [
      {
        id: 'us-gaap:CostOfGoodsAndServicesSold',
        label: 'Cost of revenue',
        amountUsd: usdFromMillions(23_481),
      },
      {
        id: 'us-gaap:OperatingExpenses',
        label: 'Operating expenses',
        amountUsd: usdFromMillions(16_185),
      },
    ],
    operatingIncomeUsd: usdFromMillions(14_386),
  },
];

export const MSFT_FY2026_NET_EARNINGS_USD = usdFromMillions(133_749);

/**
 * The residual, itemised into the two reported facts that fully explain it:
 * `us-gaap:IncomeTaxExpenseBenefit` 32,185 less `us-gaap:NonoperatingIncomeExpense`
 * 10,697 = 21,488. Nothing unexplained, nothing allocated. Sign convention follows
 * Cartographer's: a component that reduces the flow is positive.
 */
export const MSFT_FY2026_RESIDUAL_COMPONENTS = [
  {
    id: 'us-gaap:IncomeTaxExpenseBenefit',
    label: 'Provision for income taxes',
    amountUsd: usdFromMillions(32_185),
  },
  {
    id: 'us-gaap:NonoperatingIncomeExpense',
    label: 'Other income (expense), net',
    amountUsd: usdFromMillions(-10_697),
  },
] as const;

/** ANGEL-COPY. Final wording for the trunk constriction is Angel's (0002 C5). */
export const TRUNK_LABEL = 'Taxes and non-operating items';

export function microsoftFy2026(): CanvasInput {
  return {
    fiscalPeriodLabel: MSFT_FY2026_SOURCE.fiscalPeriodLabel,
    segments: MSFT_FY2026_SEGMENTS,
    netEarningsUsd: MSFT_FY2026_NET_EARNINGS_USD,
    trunkConstrictionLabel: TRUNK_LABEL,
    residualComponents: MSFT_FY2026_RESIDUAL_COMPONENTS,
  };
}

/**
 * `segmentCount` segments built by repeating the three real ones. Only multiples of three
 * are meaningful; anything else takes a prefix. Net earnings and the residual scale by the
 * same repetition factor so the canvas still conserves exactly.
 */
export function referenceLoad(segmentCount = 12): CanvasInput {
  const repeats = Math.max(1, Math.ceil(segmentCount / MSFT_FY2026_SEGMENTS.length));
  const segments: RiverInput[] = [];
  for (let r = 0; r < repeats; r += 1) {
    for (const segment of MSFT_FY2026_SEGMENTS) {
      if (segments.length >= segmentCount) break;
      segments.push(
        r === 0
          ? segment
          : {
              ...segment,
              id: `${segment.id}#${r}`,
              label: `${segment.label} (repeat ${r})`,
            },
      );
    }
  }
  const scale = segments.length / MSFT_FY2026_SEGMENTS.length;
  return {
    fiscalPeriodLabel: `${MSFT_FY2026_SOURCE.fiscalPeriodLabel} — perf reference load, ${segments.length} segments`,
    segments,
    netEarningsUsd: MSFT_FY2026_NET_EARNINGS_USD * scale,
    trunkConstrictionLabel: TRUNK_LABEL,
    residualComponents: MSFT_FY2026_RESIDUAL_COMPONENTS.map((component) => ({
      ...component,
      amountUsd: component.amountUsd * scale,
    })),
  };
}

/** Throws on a blocked compose, which for a self-checking fixture is the right failure. */
export function composeOrThrow(input: CanvasInput): CanvasModel {
  const result = composeCanvas(input);
  if (!result.ok) {
    throw new Error(
      `Reference load failed to compose: ${result.blocked.map((b) => b.message).join(' | ')}`,
    );
  }
  return result.value;
}
