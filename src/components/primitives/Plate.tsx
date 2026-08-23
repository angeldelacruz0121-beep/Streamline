/**
 * A raised plate. Depth is a lightness step (--surface-raised) plus one
 * hairline inset ring — never a shadow stack, never glass (DESIGN.md,
 * DELIBERATELY AVOIDING).
 */
import type { JSX, ReactNode } from 'react';

export interface PlateProps {
  readonly children: ReactNode;
}

export function Plate({ children }: PlateProps): JSX.Element {
  return <div data-primitive="plate">{children}</div>;
}
