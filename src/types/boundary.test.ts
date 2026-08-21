import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BoundaryValidationError, defineBoundary } from './boundary';

// Non-financial by design - see the note in brand.test.ts (Invariant 4.5).
const shape = z.object({ label: z.string(), count: z.number().int() });

const boundary = defineBoundary(shape);

describe('pipeline boundary', () => {
  it('passes conforming input through', () => {
    const result = boundary.check({ label: 'scaffold', count: 1 });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.count).toBe(1);
  });

  it('reports every failing field with a path and a message', () => {
    const result = boundary.check({ label: 1, count: 'not-a-number' });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error('Expected malformed input to be rejected.');
    }

    expect(result.issues.map((issue) => issue.path.join('.')).sort()).toEqual(['count', 'label']);
    expect(result.issues.every((issue) => issue.message.length > 0)).toBe(true);
  });

  it('rejects a missing field rather than defaulting it', () => {
    const result = boundary.check({ label: 'scaffold' });

    expect(result.ok).toBe(false);
  });

  it('rejects a non-object entirely', () => {
    expect(boundary.check(null).ok).toBe(false);
    expect(boundary.check('scaffold').ok).toBe(false);
  });

  it('throws BoundaryValidationError from parse, carrying the issues', () => {
    let thrown: unknown;

    try {
      boundary.parse({ label: 1, count: 1 });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BoundaryValidationError);
    expect((thrown as BoundaryValidationError).issues).toHaveLength(1);
    expect((thrown as BoundaryValidationError).issues[0]?.path).toEqual(['label']);
  });
});
