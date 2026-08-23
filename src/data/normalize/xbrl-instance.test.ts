import { describe, expect, it } from 'vitest';
import { isUsGaapNamespace, readXbrlInstance, toModelUnit } from './xbrl-instance.ts';
import { MSFT_INSTANCE_EXCERPT } from './__fixtures__/msft-fy2026.ts';
import { IBM_PRECISION_EXCERPT, NOW_PRECISION_EXCERPT } from './__fixtures__/precision-pairs.ts';

function ok(text: string) {
  const result = readXbrlInstance(text);

  if (result.kind !== 'ok') throw new Error(`expected a readable instance: ${result.detail}`);

  return result.instance;
}

describe('readXbrlInstance, against the captured Microsoft instance', () => {
  const instance = ok(MSFT_INSTANCE_EXCERPT);

  it('resolves the default namespace so unprefixed elements are found', () => {
    expect(instance.defaultNamespace).toBe('http://www.xbrl.org/2003/instance');
    expect(instance.contexts.size).toBeGreaterThan(0);
  });

  it('resolves fact namespaces from the root declarations', () => {
    const fact = instance.facts.find((item) => item.qname.localName === 'OperatingIncomeLoss');

    expect(fact?.qname.namespace).toBe('http://fasb.org/us-gaap/2025');
    expect(isUsGaapNamespace(fact?.qname.namespace ?? null)).toBe(true);
  });

  it('keeps a tagged amount as the filer wrote it and parses it exactly', () => {
    const fact = instance.facts.find(
      (item) => item.qname.localName === 'NumberOfReportableSegments',
    );

    expect(fact?.raw).toBe('3');
    expect(fact?.numeric).toBe(3);
    expect(fact?.unitRef).toBe('U_Segment');
  });

  it('reads dimensions off a context as axis and member QNames', () => {
    const segmentContext = [...instance.contexts.values()].find((context) =>
      context.dimensions.some(
        (dimension) => dimension.axis.localName === 'StatementBusinessSegmentsAxis',
      ),
    );

    expect(segmentContext).toBeDefined();
    expect(segmentContext?.dimensions[0]?.axis.namespace).toBe('http://fasb.org/us-gaap/2025');
    expect(segmentContext?.dimensions[0]?.member.namespace).toBe(
      'http://www.microsoft.com/20260630',
    );
  });

  it('collapses facts the filing repeats identically', () => {
    expect(instance.duplicatesCollapsed).toBeGreaterThan(0);
    expect(instance.conflicts).toHaveLength(0);
  });

  it('keeps the filer’s finer statement when it states one amount at two precisions', () => {
    // The narrative says $24.7 billion (decimals -8); the table says
    // $24,729 million (decimals -6). Both are true and the finer one wins.
    const benefits = instance.facts.filter(
      (item) => item.qname.localName === 'UnrecognizedTaxBenefits',
    );

    expect(MSFT_INSTANCE_EXCERPT).toContain('>24700000000<');
    expect(MSFT_INSTANCE_EXCERPT).toContain('>24729000000<');
    expect(benefits.map((item) => item.numeric)).toContain(24_729_000_000);
    expect(benefits.map((item) => item.numeric)).not.toContain(24_700_000_000);
    expect(instance.precisionMerged).toBeGreaterThan(0);
    expect(instance.conflicts).toHaveLength(0);
  });

  it('still calls a real disagreement a conflict, however it is written', () => {
    const contradictory = MSFT_INSTANCE_EXCERPT.replace('>24700000000<', '>19000000000<');
    const result = readXbrlInstance(contradictory);

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.instance.conflicts).toHaveLength(1);
  });

  it('treats the same amount written two ways as one fact, not a contradiction', () => {
    // The filer tags basic EPS as both `18.00` and `18` in the required context.
    const eps = instance.facts.filter((item) => item.qname.localName === 'EarningsPerShareBasic');

    expect(MSFT_INSTANCE_EXCERPT).toContain('>18.00<');
    expect(MSFT_INSTANCE_EXCERPT).toContain('>18<');
    expect(eps.map((item) => item.numeric)).toEqual([18, 13.7]);
    expect(instance.conflicts).toHaveLength(0);
  });

  it('finds no figure too large to hold exactly', () => {
    expect(instance.precisionLoss).toHaveLength(0);
  });

  it('groups facts by the context they were reported in', () => {
    const [contextId] = [...instance.factsByContext.keys()];

    expect(contextId).toBeDefined();
    expect(instance.factsByContext.get(contextId ?? '')?.length).toBeGreaterThan(0);
  });

  it('reads a currency unit as a currency, not as a bare string', () => {
    expect(toModelUnit(instance.units.get('U_USD'))).toEqual({
      kind: 'monetary',
      currency: 'USD',
    });
  });
});

describe('readXbrlInstance, namespace handling', () => {
  const rebound = `<?xml version="1.0"?>
<x:xbrl xmlns:x="http://www.xbrl.org/2003/instance"
        xmlns:gaap="http://fasb.org/us-gaap/2024"
        xmlns:dim="http://xbrl.org/2006/xbrldi"
        xmlns:acme="http://acme.example/2024">
  <x:context id="c1">
    <x:entity><x:identifier scheme="http://www.sec.gov/CIK">0000000001</x:identifier>
      <x:segment>
        <dim:explicitMember dimension="gaap:StatementBusinessSegmentsAxis">acme:OneMember</dim:explicitMember>
      </x:segment>
    </x:entity>
    <x:period><x:startDate>2024-01-01</x:startDate><x:endDate>2024-12-31</x:endDate></x:period>
  </x:context>
  <x:unit id="U"><x:measure>iso4217:EUR</x:measure></x:unit>
  <gaap:OperatingIncomeLoss contextRef="c1" decimals="-6" unitRef="U">1000000</gaap:OperatingIncomeLoss>
</x:xbrl>`;

  it('finds contexts and dimensions when the filer uses different prefixes', () => {
    const instance = ok(rebound);
    const context = instance.contexts.get('c1');

    expect(context?.dimensions[0]?.axis.localName).toBe('StatementBusinessSegmentsAxis');
    expect(context?.dimensions[0]?.axis.namespace).toBe('http://fasb.org/us-gaap/2024');
    expect(context?.dimensions[0]?.member.source).toBe('acme:OneMember');
  });

  it('accepts any us-gaap taxonomy year and rejects a look-alike namespace', () => {
    expect(isUsGaapNamespace('http://fasb.org/us-gaap/2024')).toBe(true);
    expect(isUsGaapNamespace('https://fasb.org/us-gaap/2031')).toBe(true);
    expect(isUsGaapNamespace('http://fasb.org/srt/2025')).toBe(false);
    expect(isUsGaapNamespace('http://evil.example/us-gaap/2025')).toBe(false);
    expect(isUsGaapNamespace(null)).toBe(false);
  });

  it('does not assume a currency for a unit it cannot read', () => {
    expect(toModelUnit(undefined)).toBeNull();
    expect(toModelUnit({ id: 'U', measures: ['iso4217:USD', 'shares'], isRatio: true })).toBeNull();
    expect(toModelUnit({ id: 'U', measures: ['pure'], isRatio: false })).toEqual({ kind: 'pure' });
    expect(toModelUnit({ id: 'U', measures: ['msft:Segment'], isRatio: false })).toEqual({
      kind: 'count',
      measure: 'Segment',
    });
  });
});

describe('readXbrlInstance, refusals', () => {
  it('refuses an empty document', () => {
    expect(readXbrlInstance('   ').kind).toBe('unreadable');
  });

  it('refuses a document that is not an instance', () => {
    const result = readXbrlInstance('<html><body><p>Not XBRL</p></body></html>');

    expect(result.kind).toBe('unreadable');
    expect(result.kind === 'unreadable' && result.detail).toContain('not an instance document');
  });

  it('refuses an instance that parses to no facts at all', () => {
    const result = readXbrlInstance(
      `<xbrl xmlns="http://www.xbrl.org/2003/instance"><context id="c"><entity><identifier scheme="s">1</identifier></entity><period><instant>2026-06-30</instant></period></context></xbrl>`,
    );

    expect(result.kind).toBe('unreadable');
    expect(result.kind === 'unreadable' && result.detail).toContain('no facts');
  });

  it('reports a filing that contradicts itself rather than picking a value', () => {
    const contradictory = MSFT_INSTANCE_EXCERPT.replace(
      /(<us-gaap:NetIncomeLoss\b[\s\S]{0,240}?>)133749000000(<\/us-gaap:NetIncomeLoss>)/,
      '$1133700000000$2',
    );

    expect(contradictory).not.toBe(MSFT_INSTANCE_EXCERPT);

    const instance = ok(contradictory);

    expect(instance.conflicts).toHaveLength(1);
    expect([...(instance.conflicts[0]?.values ?? [])].sort()).toEqual([
      '133700000000',
      '133749000000',
    ]);
  });
});

describe('precision, against the pairs that refused two real 10-Ks', () => {
  it('reads decimals="INF" as exact and keeps the exact share count', () => {
    const instance = ok(NOW_PRECISION_EXCERPT);
    const outstanding = instance.facts.filter(
      (fact) => fact.qname.localName === 'CommonStockSharesOutstanding',
    );

    expect(instance.conflicts).toHaveLength(0);
    expect(outstanding).toHaveLength(1);
    expect(outstanding[0]?.numeric).toBe(1_047_278_000);
    expect(outstanding[0]?.exact).toBe(true);
    expect(instance.precisionMerged).toBeGreaterThan(0);
  });

  it('never lets a coarser twin overwrite an exact fact that agrees with it', () => {
    const instance = ok(NOW_PRECISION_EXCERPT);
    const authorized = instance.facts.filter(
      (fact) => fact.qname.localName === 'CommonStockSharesAuthorized',
    );

    expect(authorized).toHaveLength(1);
    expect(authorized[0]?.exact).toBe(true);
    expect(authorized[0]?.decimals).toBeNull();
  });

  it('accepts 0.135 and 0.14 as one rate, where subtraction called it a contradiction', () => {
    const instance = ok(IBM_PRECISION_EXCERPT);
    const rate = instance.facts.filter(
      (fact) => fact.qname.localName === 'EffectiveIncomeTaxRateContinuingOperations',
    );

    // The float arithmetic the old rule used, preserved so the reason this test
    // exists cannot be lost: the difference overshoots the envelope by 4.34e-18.
    expect(Math.abs(0.14 - 0.135) > 0.5 * 10 ** -2).toBe(true);

    expect(instance.conflicts).toHaveLength(0);
    expect(rate).toHaveLength(1);
    expect(rate[0]?.numeric).toBe(0.135);
    expect(rate[0]?.decimals).toBe(3);
  });

  it('still refuses a rate that does not round to its coarser twin', () => {
    const contradictory = IBM_PRECISION_EXCERPT.replace('>0.14<', '>0.16<');
    const instance = ok(contradictory);

    expect(instance.conflicts).toHaveLength(1);
    expect(instance.conflicts[0]?.localName).toBe('EffectiveIncomeTaxRateContinuingOperations');
    expect(instance.conflicts[0]?.contextRef).toBe('c-57');
    expect([...(instance.conflicts[0]?.values ?? [])].sort()).toEqual(['0.135', '0.16']);
  });

  it('drops both sides of a real contradiction rather than rendering the first', () => {
    const contradictory = IBM_PRECISION_EXCERPT.replace('>0.14<', '>0.16<');
    const instance = ok(contradictory);

    expect(
      instance.facts.filter(
        (fact) => fact.qname.localName === 'EffectiveIncomeTaxRateContinuingOperations',
      ),
    ).toHaveLength(0);
  });

  it('refuses two exact facts that disagree, having no envelope to reconcile them', () => {
    const contradictory = NOW_PRECISION_EXCERPT.replace(
      '<us-gaap:CommonStockSharesOutstanding contextRef="c-4" decimals="-6" id="f-861" unitRef="shares">1047000000<',
      '<us-gaap:CommonStockSharesOutstanding contextRef="c-4" decimals="INF" id="f-861" unitRef="shares">1047000000<',
    );
    const instance = ok(contradictory);

    expect(instance.conflicts).toHaveLength(1);
    expect(instance.conflicts[0]?.localName).toBe('CommonStockSharesOutstanding');
  });
});
