/**
 * The state machine, including the states it refuses to have.
 *
 * The assertion this file exists for is `fromResult`: a `CompanyView` arm — any
 * arm — lands in `ready`. Out-of-coverage is not an error state, a
 * reconciliation break is not an error state, and if either ever becomes one
 * these tests fail (decision 0012).
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_STATE, appReducer, fromResult, useCompanyView } from './company-store';
import { companyBoundary } from '../data/validate/company-schema.ts';
import type { AppState } from './company-store';
import type { CompanySource, SourceResult } from '../types/source';
import { MSFT_CIK, XOM_CIK, readFixtureView } from '../../tests/infra/company-fixtures';

function viewResult(fixture: 'msft' | 'xom'): SourceResult {
  return {
    kind: 'view',
    provenance: null,
    view: companyBoundary.parse(readFixtureView(fixture)),
  };
}

function sourceReturning(result: SourceResult, delayMs = 0): CompanySource {
  return {
    id: 'test',
    label: 'Test',
    fetchCompanyView: () =>
      delayMs === 0
        ? Promise.resolve(result)
        : new Promise((resolve) =>
            setTimeout(() => {
              resolve(result);
            }, delayMs),
          ),
  };
}

describe('every CompanyView arm is a ready state', () => {
  it('puts a renderable filer in ready', () => {
    const state = fromResult(MSFT_CIK, viewResult('msft'));

    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;
    expect(state.view.kind).toBe('renderable');
    expect(state.missing).toBeNull();
  });

  it('puts an out-of-coverage filer in ready, not in an error state', () => {
    const state = fromResult(XOM_CIK, viewResult('xom'));

    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;
    expect(state.view.kind).toBe('out-of-coverage');
  });

  it('puts an incomplete read in ready and keeps the missing list', () => {
    const state = fromResult(XOM_CIK, {
      kind: 'incomplete-accession',
      provenance: null,
      missing: ['R-files'],
      view: companyBoundary.parse(readFixtureView('xom')),
    });

    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;
    expect(state.missing).toEqual(['R-files']);
  });

  it('reserves the failure states for transport and for boundary rejection', () => {
    const failed = fromResult(MSFT_CIK, {
      kind: 'source-failure',
      failure: {
        kind: 'transport-error',
        detail: 'unreachable',
        provenance: null,
        retryAfterMs: null,
        status: null,
      },
    });
    const rejected = fromResult(MSFT_CIK, {
      kind: 'invalid-payload',
      detail: 'rejected',
      issues: [{ path: ['segments', 0], message: 'required' }],
      provenance: null,
    });

    expect(failed.status).toBe('source-failure');
    expect(rejected.status).toBe('invalid-payload');
    if (rejected.status !== 'invalid-payload') return;
    expect(rejected.issues).toHaveLength(1);
  });
});

describe('the reducer', () => {
  it('starts idle and returns to idle when cleared', () => {
    expect(INITIAL_STATE).toEqual({ status: 'idle' });
    expect(appReducer({ status: 'loading', companyId: MSFT_CIK }, { type: 'cleared' })).toEqual({
      status: 'idle',
    });
  });

  it('moves to loading on request', () => {
    const state = appReducer(INITIAL_STATE, { type: 'requested', companyId: MSFT_CIK });

    expect(state).toEqual({ status: 'loading', companyId: MSFT_CIK });
  });

  /** The race the store exists to lose safely. */
  it('drops a response for a filer the reader already navigated away from', () => {
    const loading: AppState = { status: 'loading', companyId: XOM_CIK };
    const stale = appReducer(loading, {
      type: 'resolved',
      companyId: MSFT_CIK,
      result: viewResult('msft'),
    });

    expect(stale).toBe(loading);
  });

  it('ignores a response that arrives when nothing is in flight', () => {
    const settled = appReducer(INITIAL_STATE, {
      type: 'resolved',
      companyId: MSFT_CIK,
      result: viewResult('msft'),
    });

    expect(settled).toBe(INITIAL_STATE);
  });
});

describe('the hook', () => {
  it('goes idle -> loading -> ready for a chosen filer', async () => {
    const source = sourceReturning(viewResult('msft'), 5);
    const { result } = renderHook(() =>
      useCompanyView(source, { kind: 'company', companyId: MSFT_CIK }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
  });

  it('stays idle when no filer is chosen, and never calls the source', () => {
    const fetchCompanyView = vi.fn();
    const source: CompanySource = { id: 'test', label: 'Test', fetchCompanyView };

    const { result } = renderHook(() => useCompanyView(source, { kind: 'idle' }));

    expect(result.current.status).toBe('idle');
    expect(fetchCompanyView).not.toHaveBeenCalled();
  });

  it('returns to idle when the reader leaves a filer', async () => {
    const source = sourceReturning(viewResult('msft'));
    const { result, rerender } = renderHook(
      ({ companyId }: { companyId: string | null }) =>
        useCompanyView(
          source,
          companyId === null ? { kind: 'idle' } : { kind: 'company', companyId },
        ),
      { initialProps: { companyId: MSFT_CIK as string | null } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    act(() => {
      rerender({ companyId: null });
    });

    expect(result.current.status).toBe('idle');
  });

  it('aborts the in-flight request when the filer changes', async () => {
    const seen: (AbortSignal | undefined)[] = [];
    const source: CompanySource = {
      id: 'test',
      label: 'Test',
      fetchCompanyView: (_request, signal) => {
        seen.push(signal);

        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(viewResult('msft'));
          }, 20);
        });
      },
    };

    const { rerender } = renderHook(
      ({ companyId }: { companyId: string }) =>
        useCompanyView(source, { kind: 'company', companyId }),
      { initialProps: { companyId: MSFT_CIK } },
    );

    act(() => {
      rerender({ companyId: XOM_CIK });
    });

    expect(seen).toHaveLength(2);
    expect(seen[0]?.aborted).toBe(true);
    expect(seen[1]?.aborted).toBe(false);
  });

  it('does not surface an aborted request as an error', async () => {
    const source: CompanySource = {
      id: 'test',
      label: 'Test',
      fetchCompanyView: () =>
        Promise.resolve({
          kind: 'source-failure',
          failure: {
            kind: 'aborted',
            detail: 'superseded',
            provenance: null,
            retryAfterMs: null,
            status: null,
          },
        }),
    };

    const { result } = renderHook(() =>
      useCompanyView(source, { kind: 'company', companyId: MSFT_CIK }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('loading');
    });
    expect(result.current.status).not.toBe('source-failure');
  });
});

describe('visualization state stays in the visualization', () => {
  /**
   * `keel.md`: "Visualization state stays in the visualization; app state stays
   * in the app." This is that boundary, asserted rather than described — a
   * store that grows a `hoveredSegment` has started dragging the renderer's
   * concerns into a reducer, and it never comes back out.
   */
  it('holds no viewport, hover, selection or pacing state', () => {
    const state = fromResult(MSFT_CIK, viewResult('msft'));
    const keys = Object.keys(state).sort();

    expect(keys).toEqual(['companyId', 'missing', 'provenance', 'status', 'view']);
    for (const banned of ['hover', 'selected', 'zoom', 'pan', 'fps', 'viewport', 'reducedMotion']) {
      expect(keys).not.toContain(banned);
    }
  });
});
