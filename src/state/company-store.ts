/**
 * App state, and the line between app state and visualization state.
 *
 * What lives here: which filer was asked for, whether the request is in flight,
 * and what came back. What does not live here: anything the canvas knows about
 * itself — hover, selection, pan offset, frame pacing, reduced-motion. Those are
 * the renderer's and stay inside `src/viz/render`. A store that accumulates
 * viewport concerns is how a state model becomes unchangeable by month six.
 *
 * `AppState` is a closed union and every arm has a surface. Note what is *not*
 * an arm: out-of-coverage, reconciliation-break, incomplete-filing,
 * segment-identity-unresolved and no-segment-disclosure are all `ready`. They
 * are `CompanyView` arms, and per decision 0012 they are findings the product
 * renders, not failures the app recovers from. Promoting one of them to an app
 * error state would be exactly the mistake that record was written to prevent.
 *
 * The source is injected, never imported. This module has no idea EDGAR exists.
 */
import { useCallback, useEffect, useReducer } from 'react';
import type { CompanyView } from '../data/model/company.ts';
import type { Validated, ValidationIssue } from '../types/brand';
import type { CompanySource, SourceFailure, SourceProvenance, SourceResult } from '../types/source';
import { assertNever } from '../types/exhaustive';
import type { Route } from './route';

export type AppState =
  /** No filer chosen. Open question Q3 owns what this surface says. */
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly companyId: string }
  | {
      readonly status: 'ready';
      readonly companyId: string;
      readonly view: Validated<CompanyView>;
      readonly provenance: SourceProvenance | null;
      /**
       * Non-null when the document did not carry every artifact a structured
       * read needs. The view still renders; this is what was missing from it.
       */
      readonly missing: readonly string[] | null;
    }
  /** The source could not be reached or could not be understood. Nothing was learned. */
  | {
      readonly status: 'source-failure';
      readonly companyId: string;
      readonly failure: SourceFailure;
    }
  /** The source answered and what it said failed the pipeline boundary (Invariant 4.3). */
  | {
      readonly status: 'invalid-payload';
      readonly companyId: string;
      readonly detail: string;
      readonly issues: readonly ValidationIssue[];
      readonly provenance: SourceProvenance | null;
    };

export const INITIAL_STATE: AppState = { status: 'idle' };

export type AppAction =
  | { readonly type: 'cleared' }
  | { readonly type: 'requested'; readonly companyId: string }
  | { readonly type: 'resolved'; readonly companyId: string; readonly result: SourceResult };

/**
 * The `companyId` guard on `resolved` is the whole race-condition story: a
 * response for a filer the reader has already navigated away from is dropped,
 * not rendered. The `AbortSignal` in the effect below is the other half —
 * belt and braces, because an aborted fetch still resolves in some runtimes.
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'cleared':
      return INITIAL_STATE;

    case 'requested':
      return { status: 'loading', companyId: action.companyId };

    case 'resolved': {
      if (state.status !== 'loading' || state.companyId !== action.companyId) return state;

      return fromResult(action.companyId, action.result);
    }

    default:
      return assertNever(action, 'app action');
  }
}

export function fromResult(companyId: string, result: SourceResult): AppState {
  switch (result.kind) {
    case 'view':
      return {
        status: 'ready',
        companyId,
        view: result.view,
        provenance: result.provenance,
        missing: null,
      };

    case 'incomplete-accession':
      return {
        status: 'ready',
        companyId,
        view: result.view,
        provenance: result.provenance,
        missing: result.missing,
      };

    case 'source-failure':
      return { status: 'source-failure', companyId, failure: result.failure };

    case 'invalid-payload':
      return {
        status: 'invalid-payload',
        companyId,
        detail: result.detail,
        issues: result.issues,
        provenance: result.provenance,
      };

    default:
      return assertNever(result, 'source result');
  }
}

/**
 * Drives the state machine from the route.
 *
 * An aborted request reports `kind: 'aborted'`, and that never reaches state:
 * the reader moved on, which is not an error worth a surface. Every other
 * outcome does reach state, including the ones that look like nothing happened.
 */
export function useCompanyView(source: CompanySource, route: Route): AppState {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const companyId = route.kind === 'company' ? route.companyId : null;
  const fetchCompanyView = source.fetchCompanyView;

  const load = useCallback(
    (id: string, signal: AbortSignal): void => {
      dispatch({ type: 'requested', companyId: id });

      void fetchCompanyView({ companyId: id }, signal).then((result) => {
        if (signal.aborted) return;
        if (result.kind === 'source-failure' && result.failure.kind === 'aborted') return;

        dispatch({ type: 'resolved', companyId: id, result });
      });
    },
    [fetchCompanyView],
  );

  useEffect(() => {
    if (companyId === null) {
      dispatch({ type: 'cleared' });

      return;
    }

    const controller = new AbortController();

    load(companyId, controller.signal);

    return () => {
      controller.abort();
    };
  }, [companyId, load]);

  return state;
}
