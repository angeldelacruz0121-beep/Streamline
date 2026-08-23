import { describe, expect, it } from 'vitest';
import {
  labelForTag,
  qNameToTagKey,
  readTaxonomyIndex,
  reportForRole,
  reportForRoleId,
  rolesPresentingAll,
  tagKeyToQName,
  tagsInRole,
  type TaxonomyIndex,
} from './taxonomy-presentation.ts';
import { MSFT_METALINKS_EXCERPT, MSFT_SEGMENT_NOTE_ROLE_ID } from './__fixtures__/msft-fy2026.ts';

function load(): TaxonomyIndex {
  const result = readTaxonomyIndex(MSFT_METALINKS_EXCERPT);

  if (result.kind !== 'ok') throw new Error(result.detail);

  return result.index;
}

describe('taxonomy index', () => {
  const index = load();

  it('names the inline document the linkbases belong to', () => {
    expect(index.document).toBe('msft-20260630.htm');
  });

  it('reads the role id out of the long name so lookup is not by note number', () => {
    const note = reportForRoleId(index, MSFT_SEGMENT_NOTE_ROLE_ID);

    expect(note?.file).toBe('R28.htm');
    expect(note?.shortName).toBe('SEGMENT INFORMATION AND GEOGRAPHIC DATA');
    expect(note?.longName).toContain('995637');
  });

  it('returns nothing for a role id the filing does not carry', () => {
    expect(reportForRoleId(index, '000000')).toBeNull();
  });

  it('finds the one role presenting both the segment axis and segment revenue', () => {
    const roles = rolesPresentingAll(index, [
      'us-gaap_StatementBusinessSegmentsAxis',
      'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax',
    ]);

    expect(roles).toHaveLength(1);
    expect(reportForRole(index, roles[0] ?? '')?.file).toBe('R107.htm');
  });

  it('returns no role when one of the tags is not presented anywhere', () => {
    expect(
      rolesPresentingAll(index, ['us-gaap_StatementBusinessSegmentsAxis', 'nope_Tag']),
    ).toEqual([]);
    expect(rolesPresentingAll(index, [])).toEqual([]);
  });

  it('lists exactly the monetary measures the filer puts in its segment schedule', () => {
    const [role] = rolesPresentingAll(index, [
      'us-gaap_StatementBusinessSegmentsAxis',
      'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax',
    ]);

    expect(
      tagsInRole(index, role ?? '', 'monetaryItemType')
        .map((tag) => tag.key)
        .sort(),
    ).toEqual([
      'us-gaap_CostOfGoodsAndServicesSold',
      'us-gaap_OperatingExpenses',
      'us-gaap_OperatingIncomeLoss',
      'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax',
    ]);
  });

  it('does not admit goodwill, which the filer presents on the same axis elsewhere', () => {
    const [role] = rolesPresentingAll(index, [
      'us-gaap_StatementBusinessSegmentsAxis',
      'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax',
    ]);

    expect(tagsInRole(index, role ?? '').map((tag) => tag.key)).not.toContain(
      'us-gaap_GoodwillAcquiredDuringPeriod',
    );
  });

  it('takes a segment’s name from the filer’s own terse label', () => {
    expect(labelForTag(index, 'msft_ProductivityAndBusinessProcessesMember')).toBe(
      'Productivity and Business Processes',
    );
    expect(labelForTag(index, 'msft_IntelligentCloudMember')).toBe('Intelligent Cloud');
    expect(labelForTag(index, 'msft_MorePersonalComputingMember')).toBe('More Personal Computing');
  });

  it('returns nothing rather than inventing a name for an unknown tag', () => {
    expect(labelForTag(index, 'msft_NotATagMember')).toBeNull();
  });

  it('translates between the two spellings of a concept', () => {
    expect(tagKeyToQName('us-gaap_OperatingIncomeLoss')).toBe('us-gaap:OperatingIncomeLoss');
    expect(qNameToTagKey('msft:IntelligentCloudMember')).toBe('msft_IntelligentCloudMember');
  });
});

describe('taxonomy index refusals', () => {
  it('refuses text that is not JSON', () => {
    expect(readTaxonomyIndex('<xml/>').kind).toBe('unreadable');
  });

  it('refuses JSON with no instance object', () => {
    const result = readTaxonomyIndex('{"version":"2.1"}');

    expect(result.kind).toBe('unreadable');
    expect(result.kind === 'unreadable' && result.detail).toContain('no `instance` object');
  });

  it('refuses a document that yields neither a report nor a tag', () => {
    const result = readTaxonomyIndex('{"instance":{"doc.htm":{"report":{},"tag":{}}}}');

    expect(result.kind).toBe('unreadable');
    expect(result.kind === 'unreadable' && result.detail).toContain('parse defect');
  });

  it('strips taxonomy bookkeeping from a standard label used as a fallback', () => {
    const result = readTaxonomyIndex(
      JSON.stringify({
        instance: {
          'doc.htm': {
            report: { R1: { role: 'r', longName: '1 - X', shortName: 'X' } },
            tag: {
              acme_OneMember: {
                xbrltype: 'domainItemType',
                nsuri: 'http://acme.example',
                localname: 'OneMember',
                lang: { 'en-us': { role: { label: 'One [Member]' } } },
              },
            },
          },
        },
      }),
    );

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && labelForTag(result.index, 'acme_OneMember')).toBe('One');
  });
});
