// @vitest-environment node
/**
 * WHY each filer is refused, not just that it is.
 *
 * The arm census (`arm-census.test.ts`) says twelve of fifteen in-coverage
 * filers return `segment-identity-unresolved`. That single arm is hiding two
 * unrelated root causes with very different consequences, and a finding routed
 * to the wrong owner is a wasted invocation. This file separates them and
 * pins the evidence.
 *
 * Assumption 5 (approved): these assert that the refusal NAMES the defect —
 * the axis QName, the contradicting concept — never the prose around it. Copy
 * is escalate-only.
 */
import { describe, it, expect } from 'vitest';
import { readManifest, readEnvelope, viewKindOf, detailOf } from '../helpers/adversarial-corpus.ts';

const MANIFEST = readManifest();

function detailFor(ticker: string): string {
  const row = MANIFEST.find((r) => r.ticker === ticker);
  if (row === undefined) throw new Error(`No corpus row for ${ticker}.`);
  return detailOf(readEnvelope(row.file)) ?? '';
}

/** Root cause A: the fact carries the segment axis plus an axis the project will not interpret. */
const COMPANION_AXIS = {
  SNOW: ['srt:ProductOrServiceAxis'],
  META: ['srt:ProductOrServiceAxis'],
  GOOGL: ['srt:ProductOrServiceAxis', 'srt:ConsolidationItemsAxis'],
  ADBE: ['srt:ProductOrServiceAxis', 'srt:MajorCustomersAxis'],
  CSCO: [
    'us-gaap:BusinessAcquisitionAxis',
    'srt:ConsolidationItemsAxis',
    'srt:ProductOrServiceAxis',
  ],
  AAPL: ['srt:ConsolidationItemsAxis'],
  HPQ: ['srt:ConsolidationItemsAxis', 'us-gaap:SubsegmentsAxis'],
  VYX: ['srt:ConsolidationItemsAxis'],
  JKHY: ['us-gaap:BusinessAcquisitionAxis', 'srt:ProductOrServiceAxis'],
  DBD: ['srt:ConsolidationItemsAxis', 'srt:ProductOrServiceAxis'],
} as const;

/** Root cause B: the same concept tagged twice in one context at two precisions. */
const DUPLICATE_FACT = {
  NOW: 'CommonStockSharesOutstanding',
  IBM: 'TreasuryStockCommonShares',
} as const;

describe('root cause A — companion axes', () => {
  it.each(Object.entries(COMPANION_AXIS))(
    '%s is refused and its detail names every axis it tripped on',
    (ticker, axes) => {
      const detail = detailFor(ticker);
      for (const axis of axes) expect(detail, `${ticker} names ${axis}`).toContain(axis);
    },
  );

  it('ten of the twelve unresolved filers are this one rule', () => {
    expect(Object.keys(COMPANION_AXIS)).toHaveLength(10);
  });

  /**
   * BUG — filed with Angel for routing to Financial Data Analyst.
   *
   * `ALLOWED_COMPANION_AXES` (src/data/normalize/segment-contexts.ts:33) is
   * `['ConsolidationItemsAxis']`, and the comment above it at lines 25–32 says
   * that axis is allowed precisely because "filers use it to say 'this figure
   * is the operating-segments column' alongside the segment itself."
   *
   * It can never match. `isAllowedCompanion` (segment-contexts.ts:50-55) gates
   * on `isUsGaapNamespace(dimension.axis.namespace)`, and
   * `isUsGaapNamespace` (src/data/normalize/xbrl-instance.ts:601-605) accepts
   * only `http(s)://fasb.org/us-gaap/YYYY`. `ConsolidationItemsAxis` is an
   * **srt** taxonomy axis — `http://fasb.org/srt/YYYY` — which the proxy's own
   * refusal text confirms by reporting it as `srt:ConsolidationItemsAxis`.
   *
   * So the allowlist is unreachable code, and the one axis it was written to
   * permit is the one that refuses Apple outright.
   *
   * Apple is the clean proof: `srt:ConsolidationItemsAxis` is its ONLY
   * companion axis. Nothing else stands between Apple and a render.
   */
  it('Apple is refused for an axis that is on the allowlist', () => {
    const detail = detailFor('AAPL');
    expect(detail).toContain('srt:ConsolidationItemsAxis');
    // The allowlist names this axis. Apple trips only on this axis. Both true.
    expect(detail.match(/(srt|us-gaap):\w+Axis/g)).toEqual(['srt:ConsolidationItemsAxis']);
  });

  /**
   * Six of the ten name `srt:ConsolidationItemsAxis`. If the allowlist worked,
   * this is the population it would reach — though five of those six carry a
   * second, genuinely uninterpretable axis as well, so fixing the namespace
   * check alone unblocks Apple and NCR Voyix, not all six.
   */
  it('six filers trip on the allowlisted axis; two trip on nothing else', () => {
    const tripping = Object.entries(COMPANION_AXIS).filter(([, axes]) =>
      (axes as readonly string[]).includes('srt:ConsolidationItemsAxis'),
    );
    expect(tripping.map(([t]) => t)).toEqual(['GOOGL', 'CSCO', 'AAPL', 'HPQ', 'VYX', 'DBD']);

    const onlyBlocker = tripping.filter(([, axes]) => axes.length === 1);
    expect(onlyBlocker.map(([t]) => t)).toEqual(['AAPL', 'VYX']);
  });
});

describe('root cause B — duplicate facts at two precisions', () => {
  it.each(Object.entries(DUPLICATE_FACT))('%s is refused over %s', (ticker, concept) => {
    const detail = detailFor(ticker);
    expect(detail).toContain(concept);
    expect(detail).toContain('tags the same concept twice in the same context');
  });

  /**
   * FINDING (product question, filed with Angel) — and arguably a bug.
   *
   * The refusal text says "The filing contradicts itself and no figure from it
   * can be trusted." The evidence it cites does not support that:
   *
   *   ServiceNow  CommonStockSharesOutstanding  1047278000 vs 1047000000
   *   IBM         TreasuryStockCommonShares     1353666394 vs 1354000000
   *   IBM         EffectiveIncomeTaxRate        0.14       vs 0.135
   *
   * Each pair is the same quantity tagged at two `decimals` precisions, which
   * is ordinary XBRL — a filer tags the exact figure and the rounded one it
   * printed. It is not a contradiction.
   *
   * Two consequences worth Angel's attention:
   *  1. None of these three concepts is a segment figure. A cover-page share
   *     count and an effective tax rate discard the entire render.
   *  2. Whatever the rule should be, "no figure from it can be trusted" is a
   *     strong claim to make about IBM's 10-K on this evidence.
   *
   * Asserted here as observed behaviour, not endorsed. The values are pinned so
   * the claim survives a context clear.
   */
  it('the cited evidence is rounding, and none of it is a segment figure', () => {
    const now = detailFor('NOW');
    expect(now).toContain('1047278000');
    expect(now).toContain('1047000000');

    const ibm = detailFor('IBM');
    expect(ibm).toContain('1353666394');
    expect(ibm).toContain('1354000000');
    expect(ibm).toContain('EffectiveIncomeTaxRateContinuingOperations');

    for (const detail of [now, ibm]) {
      expect(detail).not.toContain('StatementBusinessSegmentsAxis');
      expect(detail).not.toContain('RevenueFromContractWithCustomer');
    }
  });
});

describe('root cause C — no segment axis at all', () => {
  it.each(['U', 'SMCI'])('%s tags nothing on the segment axis', (ticker) => {
    const detail = detailFor(ticker);
    expect(detail).toContain('us-gaap:StatementBusinessSegmentsAxis');
    expect(detail).toContain('no segment breakdown');
  });
});

describe('root cause D — the filer does not file a 10-K', () => {
  /**
   * FINDING (product question, filed with Angel).
   *
   * SAP SE (SIC 7372) and Amdocs (SIC 7371) are both squarely inside the
   * coverage band and both file 20-F, not 10-K. `SEGMENTS_FORM = '10-K'`
   * (server/proxy.ts:96) pins the route to one form, `resolveAccession`
   * (server/proxy.ts:118-127) finds nothing, and the route answers HTTP 404
   * with envelope kind `not-found`.
   *
   * That is a transport-shaped answer to a coverage-shaped question. Decision
   * 0012 puts every designed refusal on HTTP 200 as a `CompanyView` arm; this
   * one is the exception, and a user who searches SAP is told it was not found
   * when in truth Streamline does not read the form SAP files.
   *
   * It also means Invariant 2.6 ("no implicit USD") has no reachable test. A
   * non-USD reporting currency arrives with foreign private issuers, and no
   * foreign private issuer can currently reach the model at all. Downstream,
   * `src/viz/render/format.ts:12` imports `USD_PER_MILLION` and types money as
   * `Usd`, so even if a EUR figure did arrive the renderer could not express
   * it — while `src/data/validate/company-schema.ts:54` accepts any three-letter
   * currency code. The model admits currencies the renderer cannot draw.
   */
  it.each(['SAP', 'DOX'])('%s answers not-found rather than a designed state', (ticker) => {
    const row = MANIFEST.find((r) => r.ticker === ticker);
    if (row === undefined) throw new Error(`No corpus row for ${ticker}.`);
    const envelope = readEnvelope(row.file);

    expect(viewKindOf(envelope)).toBeNull();
    expect((envelope as { kind: string }).kind).toBe('not-found');
    // It does at least name the form, which is the actionable part.
    expect(detailOf(envelope)).toContain('No 10-K found');
  });
});
