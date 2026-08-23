import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineBoundary } from './boundary';
import type { Validated } from './brand';

// Deliberately non-financial. Invariant 4.5 bars example companies and figures
// from every committed code path, tests included; this fixture carries no
// domain meaning at all.
const shape = z.object({ label: z.string(), count: z.number().int() });
type Shape = z.infer<typeof shape>;

const boundary = defineBoundary(shape);

/** Stands in for a renderer entry point: it accepts branded input only. */
function acceptsOnlyValidated(input: Validated<Shape>): string {
  return input.label;
}

describe('Validated brand', () => {
  it('cannot be satisfied by a raw object', () => {
    // @ts-expect-error - a raw Shape must never satisfy Validated<Shape>. If the
    // brand stops working this line compiles, the directive becomes unused, and
    // `npm run typecheck` fails. That failure is the point of this test.
    acceptsOnlyValidated({ label: 'scaffold', count: 1 });
  });

  it('is satisfied only by the output of a boundary check', () => {
    const validated = boundary.parse({ label: 'scaffold', count: 1 });

    expect(acceptsOnlyValidated(validated)).toBe('scaffold');
  });
});
