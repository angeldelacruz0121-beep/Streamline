import { describe, expect, it } from 'vitest';
import { checkCoverage, COVERAGE_SIC_RANGES } from './coverage.ts';
import { MSFT_SIC } from '../normalize/__fixtures__/msft-fy2026.ts';

describe('coverage test', () => {
  it('admits the subject filer, SIC 7372', () => {
    expect(checkCoverage(MSFT_SIC)).toEqual({ inScope: true, sic: 7372 });
  });

  it('admits both ends of both ranges and nothing outside them', () => {
    for (const [low, high] of COVERAGE_SIC_RANGES) {
      expect(checkCoverage(String(low)).inScope).toBe(true);
      expect(checkCoverage(String(high)).inScope).toBe(true);
      expect(checkCoverage(String(low - 1)).inScope).toBe(false);
      expect(checkCoverage(String(high + 1)).inScope).toBe(false);
    }
  });

  it('excludes an out-of-scope filer and names the ranges in the refusal', () => {
    const result = checkCoverage('2834', 'Pharmaceutical Preparations');

    expect(result.inScope).toBe(false);
    expect(!result.inScope && result.sic).toBe(2834);
    expect(!result.inScope && result.detail).toContain('Pharmaceutical Preparations');
    expect(!result.inScope && result.detail).toContain('3570');
    expect(!result.inScope && result.detail).toContain('7370');
  });

  it('admits NVIDIA at SIC 3674, per Angel’s 2026-08-23 ruling', () => {
    expect(checkCoverage('3674', 'Semiconductors & Related Devices')).toEqual({
      inScope: true,
      sic: 3674,
    });
  });

  it('excludes Uber at SIC 7389, which was considered and rejected', () => {
    const result = checkCoverage('7389', 'Services-Business Services, NEC');

    expect(result.inScope).toBe(false);
    expect(!result.inScope && result.sic).toBe(7389);
    expect(!result.inScope && result.detail).toContain('3674');
  });

  it('names the real band, including 3674, in every refusal', () => {
    const refusals = [checkCoverage('2834'), checkCoverage(null)];

    for (const refusal of refusals) {
      expect(!refusal.inScope && refusal.detail).toContain('3570');
      expect(!refusal.inScope && refusal.detail).toContain('3674');
      expect(!refusal.inScope && refusal.detail).toContain('7370');
    }
  });

  it('excludes a filer EDGAR gives no SIC for, rather than assuming', () => {
    const result = checkCoverage(null);

    expect(result.inScope).toBe(false);
    expect(!result.inScope && result.sic).toBeNull();
  });

  it('excludes a SIC that is not a number', () => {
    expect(checkCoverage('n/a').inScope).toBe(false);
    expect(checkCoverage('').inScope).toBe(false);
  });
});
