/**
 * A financial figure. IBM Plex Mono, `font-variant-numeric: tabular-nums` —
 * required by test record 0001 C2: figures must not jitter between values.
 *
 * Takes a PREFORMATTED string. Formatting a quantity is Forge's `format.ts`;
 * this primitive only guarantees how a figure sits on the page. It never
 * invents units, signs or precision.
 */
import type { JSX } from 'react';

export interface FigureProps {
  /** The formatted figure, exactly as it should read. */
  readonly children: string;
  /** Secondary ink for figures that support rather than lead. */
  readonly dim?: boolean;
}

export function Figure({ children, dim = false }: FigureProps): JSX.Element {
  return (
    <span data-primitive="figure" data-dim={dim ? 'true' : undefined}>
      {children}
    </span>
  );
}
