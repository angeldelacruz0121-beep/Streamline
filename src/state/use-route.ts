/**
 * The hash route as React state.
 *
 * `useSyncExternalStore` rather than an effect plus `useState`: the hash is an
 * external mutable source, and reading it during render through the store
 * contract is what keeps the first paint from being a frame of the wrong route.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { IDLE_ROUTE, parseRoute, type Route } from './route';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);

  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

export function useRoute(): Route {
  const getSnapshot = useCallback(() => window.location.hash, []);
  // Server render has no location. `idle` is the correct answer there and also
  // the correct answer for a reader who has not chosen a filer.
  const getServerSnapshot = useCallback(() => '', []);
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return hash === '' ? IDLE_ROUTE : parseRoute(hash);
}
