/**
 * The shell. Route in, source in, one exhaustive switch out.
 *
 * Everything this file does is assembly: read the route, drive the store, pick
 * the surface. It holds no state of its own, formats no figure, and knows
 * nothing about EDGAR — the source arrives as a prop, defaulted for the real
 * app and overridden by every test and by any second source
 * (`src/app/sources/second-source.test.ts` is the standing proof).
 *
 * The switch below is exhaustive over `AppState` and `CompanySurface`'s is
 * exhaustive over `CompanyView`. Between them, every state this product can be
 * in has a surface, and adding a state without a surface is a compile error
 * rather than a blank screen.
 *
 * WHAT IS NOT HERE. There is no error boundary wrapped around the canvas, and
 * that is deliberate: an error boundary would turn a designed refusal into a
 * caught exception, which is precisely the failure decision 0012 forbids.
 * Refusals are values here — `CompanyView` arms and `CanvasOutcome` arms — and
 * they are rendered, not caught.
 */
import { useMemo, type JSX } from 'react';
import { createEdgarHttpSource } from './sources/edgar-http-source';
import { CompanySurface } from './surfaces/company/CompanySurface';
import {
  IdleSurface,
  InvalidPayloadSurface,
  LoadingSurface,
  SourceFailureSurface,
} from './surfaces/app-surfaces';
import { useCompanyView } from '../state/company-store';
import { useRoute } from '../state/use-route';
import { assertNever } from '../types/exhaustive';
import type { CompanySource } from '../types/source';
import type { Route } from '../state/route';

export interface AppProps {
  /** Injected so a second source is a prop change, not a code change (Invariant 4.4). */
  readonly source?: CompanySource;
  /** Test seam only. The real app reads `window.location.hash`. */
  readonly route?: Route;
}

export function App({ source, route }: AppProps = {}): JSX.Element {
  const hashRoute = useRoute();
  const activeRoute = route ?? hashRoute;
  const defaultSource = useMemo(() => createEdgarHttpSource(), []);
  const activeSource = source ?? defaultSource;
  const state = useCompanyView(activeSource, activeRoute);

  return <main>{renderState(state)}</main>;
}

function renderState(state: ReturnType<typeof useCompanyView>): JSX.Element {
  switch (state.status) {
    case 'idle':
      return <IdleSurface />;

    case 'loading':
      return <LoadingSurface companyId={state.companyId} />;

    case 'ready':
      return <CompanySurface view={state.view} missing={state.missing} />;

    case 'source-failure':
      return <SourceFailureSurface companyId={state.companyId} failure={state.failure} />;

    case 'invalid-payload':
      return (
        <InvalidPayloadSurface
          companyId={state.companyId}
          detail={state.detail}
          issues={state.issues}
        />
      );

    default:
      return assertNever(state, 'app state');
  }
}
