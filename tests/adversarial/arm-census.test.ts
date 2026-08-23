// @vitest-environment node
/**
 * THE ARM CENSUS — increment A2 of QA Engineer's standing adversarial set.
 *
 * One question: for each real filer in the corpus, which arm of `CompanyView`
 * does the shipping route return today? Every other adversarial test depends on
 * the answer, because an invariant about river width cannot be tested against a
 * filer that never produces a river.
 *
 * ============================================================================
 * READ THIS BEFORE CHANGING AN EXPECTED VALUE.
 *
 * The `CENSUS` table below records what the product DOES, not what it SHOULD
 * do. Several rows are findings filed with Angel, not desired behaviour. A row
 * that changes is not automatically a regression and not automatically a fix —
 * it means someone changed how a real filing is handled, and the change has to
 * be argued for. Update a row deliberately, with the finding it resolves named
 * in the commit.
 *
 * Do not "fix" a failing row by editing the expectation to match new output.
 * That is the failure mode decision 0010 was written about: the test stops
 * testing the service and starts agreeing with it.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  readManifest,
  readEnvelopeText,
  readEnvelope,
  viewKindOf,
  envelopeKindOf,
  detailOf,
  isInCoverageBand,
} from '../helpers/adversarial-corpus.ts';

const MANIFEST = readManifest();

function rowFor(ticker: string) {
  const row = MANIFEST.find((r) => r.ticker === ticker);
  if (row === undefined) throw new Error(`No corpus row for ${ticker}.`);
  return row;
}

function sicOf(envelope: unknown): string | null {
  const view = (envelope as { view?: { entity?: { sic?: unknown } } }).view;
  const sic = view?.entity?.sic;
  return typeof sic === 'string' ? sic : null;
}

describe('corpus integrity', () => {
  it('every manifest row has its captured file, byte-identical to capture time', () => {
    for (const row of MANIFEST) {
      const body = readEnvelopeText(row.file);
      expect(body.length, `${row.ticker} byte count`).toBe(row.bytes);
      expect(createHash('sha256').update(body).digest('hex'), `${row.ticker} sha256`).toBe(
        row.sha256,
      );
    }
  });

  it('stays inside the committed-corpus size cap Angel approved (assumption 7)', () => {
    const total = MANIFEST.reduce((sum, row) => sum + row.bytes, 0);
    expect(total).toBeLessThan(5 * 1024 * 1024);
  });

  it('covers nineteen filers', () => {
    expect(MANIFEST).toHaveLength(19);
  });
});

describe('coverage band — Invariant §1, D7', () => {
  it('every filer outside SIC 3570–3579 / 7370–7379 returns out-of-coverage', () => {
    for (const row of MANIFEST) {
      const envelope = readEnvelope(row.file);
      const sic = sicOf(envelope);
      if (sic === null) continue; // the 404 arm carries no entity; see the 20-F block below
      if (!isInCoverageBand(sic)) {
        expect(viewKindOf(envelope), `${row.ticker} (SIC ${sic})`).toBe('out-of-coverage');
      }
    }
  });

  it('no in-band filer is refused for coverage', () => {
    for (const row of MANIFEST) {
      const envelope = readEnvelope(row.file);
      const sic = sicOf(envelope);
      if (sic !== null && isInCoverageBand(sic)) {
        expect(viewKindOf(envelope), `${row.ticker} (SIC ${sic})`).not.toBe('out-of-coverage');
      }
    }
  });

  /**
   * Assumption 5: assert that the refusal NAMES the defect, never its prose.
   * Copy is escalate-only, so the shape of the sentence is not this test's
   * business — but a refusal a user cannot act on is a product failure, and
   * naming the filer's own SIC is the minimum that makes it actionable.
   */
  it('an out-of-coverage refusal names the filer’s SIC and the covered band', () => {
    for (const row of MANIFEST) {
      const envelope = readEnvelope(row.file);
      if (viewKindOf(envelope) !== 'out-of-coverage') continue;
      const detail = detailOf(envelope) ?? '';
      const sic = sicOf(envelope) ?? '';
      expect(detail, `${row.ticker} names its own SIC`).toContain(sic);
      expect(detail, `${row.ticker} names the covered band`).toContain('3570');
      expect(detail, `${row.ticker} names the covered band`).toContain('7370');
    }
  });

  /**
   * FINDING (product question, filed with Angel — not a bug).
   *
   * Uber is SIC 7389 "Services-Business Services, NEC" and NVIDIA is SIC 3674
   * "Semiconductors & Related Devices". Both are refused. Both are companies a
   * young investor researching technology would certainly expect to find, and
   * Uber's code is adjacent to the band rather than far from it. This is D10
   * ("SIC ranges are a proxy for tech and will miss or wrongly include some
   * filers") observed on real filers rather than argued in the abstract.
   *
   * The test asserts the refusal happens and is honest. Whether the band is the
   * right band is Angel's call.
   */
  it('D10 in the wild: Uber (7389) and NVIDIA (3674) are both refused', () => {
    expect(viewKindOf(readEnvelope(rowFor('UBER').file))).toBe('out-of-coverage');
    expect(viewKindOf(readEnvelope(rowFor('NVDA').file))).toBe('out-of-coverage');
  });
});

/**
 * What each filer returns today. Observations. See the header before editing.
 */
const CENSUS: readonly (readonly [
  ticker: string,
  envelopeKind: string,
  viewKind: string | null,
])[] = [
  ['ADSK', 'view', 'renderable'],
  ['U', 'view', 'no-segment-disclosure'],
  ['SMCI', 'view', 'no-segment-disclosure'],
  ['UBER', 'view', 'out-of-coverage'],
  ['NVDA', 'view', 'out-of-coverage'],
  ['NOW', 'view', 'segment-identity-unresolved'],
  ['SNOW', 'view', 'segment-identity-unresolved'],
  ['META', 'view', 'segment-identity-unresolved'],
  ['GOOGL', 'view', 'segment-identity-unresolved'],
  ['IBM', 'view', 'segment-identity-unresolved'],
  ['ADBE', 'view', 'segment-identity-unresolved'],
  ['CSCO', 'view', 'segment-identity-unresolved'],
  ['AAPL', 'view', 'segment-identity-unresolved'],
  ['HPQ', 'view', 'segment-identity-unresolved'],
  ['VYX', 'view', 'segment-identity-unresolved'],
  ['JKHY', 'view', 'segment-identity-unresolved'],
  ['DBD', 'view', 'segment-identity-unresolved'],
  ['SAP', 'not-found', null],
  ['DOX', 'not-found', null],
];

describe('arm census', () => {
  it.each(CENSUS)('%s returns envelope %s / view %s', (ticker, envelopeKind, viewKind) => {
    const envelope = readEnvelope(rowFor(ticker).file);
    expect(envelopeKindOf(envelope)).toBe(envelopeKind);
    expect(viewKindOf(envelope)).toBe(viewKind);
  });

  it('the census covers every filer in the corpus, so nothing is quietly omitted', () => {
    expect([...CENSUS.map(([t]) => t)].sort()).toEqual([...MANIFEST.map((r) => r.ticker)].sort());
  });
});

describe('the headline', () => {
  /**
   * FINDING (product question, filed with Angel).
   *
   * Seventeen of the nineteen filers captured are inside the coverage band.
   * Exactly ONE of them renders. The other sixteen split: twelve
   * `segment-identity-unresolved`, two `no-segment-disclosure`, and two that
   * 404 before a company is built at all. Adding Microsoft — Software
   * Architect's capture at
   * `src/app/sources/fixtures/msft-0000789019-segments.json`, referenced rather
   * than duplicated — makes it two renderable out of eighteen.
   *
   * The vertical slice is real and Microsoft is genuinely correct. But the
   * slice validated a filer that turns out to be unusual in exactly the way
   * that matters, and the standing adversarial set exists to say so before a
   * user does. This number is the situation report.
   */
  it('exactly one in-coverage filer in this corpus renders', () => {
    const renderable = MANIFEST.filter((row) => {
      const envelope = readEnvelope(row.file);
      const sic = sicOf(envelope);
      return sic !== null && isInCoverageBand(sic) && viewKindOf(envelope) === 'renderable';
    });

    expect(renderable.map((r) => r.ticker)).toEqual(['ADSK']);
  });

  /**
   * The dominant refusal, isolated so its size is visible rather than inferred.
   * Twelve of the fifteen in-coverage filers that get far enough to build an
   * entity fail on `segment-identity-unresolved` — four fifths of everything
   * that is not already refused for coverage.
   */
  it('segment-identity-unresolved is the dominant outcome for in-coverage filers', () => {
    const byArm = new Map<string, string[]>();

    for (const row of MANIFEST) {
      const envelope = readEnvelope(row.file);
      const sic = sicOf(envelope);
      if (sic === null || !isInCoverageBand(sic)) continue;
      const arm = viewKindOf(envelope) ?? 'no-view';
      byArm.set(arm, [...(byArm.get(arm) ?? []), row.ticker]);
    }

    expect(byArm.get('segment-identity-unresolved')).toHaveLength(12);
    expect(byArm.get('no-segment-disclosure')).toHaveLength(2);
    expect(byArm.get('renderable')).toHaveLength(1);
  });
});
