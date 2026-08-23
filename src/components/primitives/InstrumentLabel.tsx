/**
 * An instrument label: mono, uppercase, wide-tracked (--track-instrument).
 * The uppercasing is CSS `text-transform`, so the DOM keeps the string
 * exactly as given — copy is never rewritten by a primitive.
 */
import type { JSX } from 'react';

export interface InstrumentLabelProps {
  readonly children: string;
}

export function InstrumentLabel({ children }: InstrumentLabelProps): JSX.Element {
  return <span data-primitive="instrument-label">{children}</span>;
}
