import { describe, expect, it } from 'vitest';
import { usdFromMillions } from '../scales';
import { formatUsdExact, formatUsdMillions } from './format';

describe('figure formatting', () => {
  it('renders in millions, the unit the filing itself uses', () => {
    // Invariant 2.2 traceability is only useful if the reader can complete the trace by
    // eye. Microsoft reports 133,749; the screen says $133,749M.
    expect(formatUsdMillions(usdFromMillions(133_749))).toBe('$133,749M');
    expect(formatUsdMillions(usdFromMillions(21_488))).toBe('$21,488M');
    expect(formatUsdMillions(usdFromMillions(155_237))).toBe('$155,237M');
  });

  it('never abbreviates the exact figure away', () => {
    // The lake readout exists precisely so the analyst's path to the number is not lossy
    // (0001 C2). "$133.7B" would defeat it.
    expect(formatUsdExact(usdFromMillions(133_749))).not.toContain('B');
    expect(formatUsdExact(usdFromMillions(133_749))).toBe('$133,749M');
  });

  it('carries a negative with a true minus sign, for the drained basin', () => {
    expect(formatUsdMillions(usdFromMillions(-133_749))).toBe('−$133,749M');
  });

  it('falls through to whole dollars when the figure is not a round million', () => {
    expect(formatUsdExact(1_234_567)).toBe('$1,234,567');
    expect(formatUsdExact(-1_234_567)).toBe('−$1,234,567');
  });

  it('handles zero without a stray sign', () => {
    expect(formatUsdMillions(0)).toBe('$0M');
    expect(formatUsdExact(0)).toBe('$0M');
  });
});
