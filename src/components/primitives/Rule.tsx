/**
 * The separation rule. Its canonical use is the Q1 decision: the lake is
 * stated separately from the trunk, and this hairline is that statement.
 * Rendered as a real separator with an explicit orientation so the boundary
 * is in the accessibility tree, not just the pixels.
 */
import type { JSX } from 'react';

export interface RuleProps {
  readonly orientation?: 'vertical' | 'horizontal';
}

export function Rule({ orientation = 'vertical' }: RuleProps): JSX.Element {
  return <div data-primitive="rule" role="separator" aria-orientation={orientation} />;
}
