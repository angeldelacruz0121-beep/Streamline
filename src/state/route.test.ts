// @vitest-environment node
/**
 * Routing, including the shape it deliberately does not have.
 *
 * The last describe block is the one that matters at month six: it fails if
 * anyone adds a period segment to the URL while D12 is still open. A decision
 * held open by a comment drifts; a decision held open by a failing test does
 * not.
 */
import { describe, expect, it } from 'vitest';
import { IDLE_ROUTE, formatRoute, parseRoute, sameRoute } from './route';

describe('parsing', () => {
  it('reads a company route and canonicalises the cik', () => {
    expect(parseRoute('#/company/789019')).toEqual({ kind: 'company', companyId: '0000789019' });
    expect(parseRoute('#/company/0000789019')).toEqual({
      kind: 'company',
      companyId: '0000789019',
    });
  });

  it('tolerates the shapes a browser actually produces', () => {
    for (const hash of ['#/company/789019/', '/company/789019', 'company/789019']) {
      expect(parseRoute(hash)).toEqual({ kind: 'company', companyId: '0000789019' });
    }
  });

  it('treats an unrecognised address as idle rather than inventing a not-found state', () => {
    for (const hash of ['', '#', '#/', '#/company', '#/company/abc', '#/nonsense', '#/company/']) {
      expect(parseRoute(hash)).toEqual(IDLE_ROUTE);
    }
  });

  it('rejects a cik longer than EDGAR issues', () => {
    expect(parseRoute('#/company/12345678901')).toEqual(IDLE_ROUTE);
  });
});

describe('formatting', () => {
  it('round-trips', () => {
    const route = parseRoute('#/company/789019');

    expect(formatRoute(route)).toBe('#/company/0000789019');
    expect(parseRoute(formatRoute(route))).toEqual(route);
  });

  it('formats idle as the bare root', () => {
    expect(formatRoute(IDLE_ROUTE)).toBe('#/');
  });
});

describe('identity', () => {
  it('compares by filer, not by object', () => {
    expect(sameRoute(parseRoute('#/company/789019'), parseRoute('#/company/0000789019'))).toBe(
      true,
    );
    expect(sameRoute(parseRoute('#/company/789019'), parseRoute('#/company/34088'))).toBe(false);
    expect(sameRoute(IDLE_ROUTE, parseRoute('#/company/789019'))).toBe(false);
  });
});

describe('D12 is held open by the URL, not decided by it', () => {
  /**
   * Open decision D12 — whether the app opens on the latest fiscal year, the
   * latest quarter or TTM — is unanswered, and Angel deferred it rather than
   * letting a route shape decide it. These assertions fail if a period ever
   * appears in the address before that decision is made.
   */
  it('carries no period segment and no placeholder for one', () => {
    expect(formatRoute({ kind: 'company', companyId: '0000789019' })).toBe('#/company/0000789019');
    expect(formatRoute({ kind: 'company', companyId: '0000789019' })).not.toMatch(
      /FY|TTM|Q[1-4]|period|latest/i,
    );
  });

  it('does not silently accept a period-bearing address as if it meant something', () => {
    // Not idle-with-a-warning and not a fifth failure state: an address this
    // app has never issued is simply not a company route.
    expect(parseRoute('#/company/789019/FY2026')).toEqual(IDLE_ROUTE);
  });

  it('exposes exactly two route kinds', () => {
    const kinds = new Set([parseRoute('#/').kind, parseRoute('#/company/1').kind]);

    expect([...kinds].sort()).toEqual(['company', 'idle']);
  });
});
