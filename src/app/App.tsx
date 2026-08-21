import type { JSX } from 'react';

/**
 * Structural shell only. Routing, the five non-success surfaces, and every
 * visual decision land in later workstreams (Keel routes them, Atelier styles
 * them). Nothing here renders data, by design: there is no data path yet, and
 * Invariant 4.5 forbids standing one in with placeholder figures.
 */
export function App(): JSX.Element {
  return (
    <main>
      <h1>Streamline</h1>
    </main>
  );
}
