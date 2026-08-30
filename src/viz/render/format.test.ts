import { describe, expect, it } from 'vitest';
import { usdFromMillions } from '../scales';
import { formatUsdExact, formatUsdMillions, formatUsdScaled } from './format';

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

  describe('the scaled form the canvas draws', () => {
    it('reads in billions without moving the value', () => {
      // Angel, 2026-08-26: "$133,749M" makes a reader do long division to learn the company
      // earned about $134 billion. The unit changes; the number does not.
      expect(formatUsdScaled(usdFromMillions(133_749))).toBe('$133.749B');
      expect(formatUsdScaled(usdFromMillions(139_996))).toBe('$139.996B');
      expect(formatUsdScaled(usdFromMillions(155_237))).toBe('$155.237B');
      expect(formatUsdScaled(usdFromMillions(25_017))).toBe('$25.017B');
      expect(formatUsdScaled(usdFromMillions(21_488))).toBe('$21.488B');
    });

    it('ROUNDS NOTHING — every scaled figure survives the round trip exactly', () => {
      // The property the whole change rests on, proved rather than assumed. Rounding to
      // `$140.0B` was rejected because it is a value the filer does not publish
      // (kill-list.md, 2026-08-20); this asserts no code path can reintroduce one.
      const parse = (formatted: string): number => {
        const match = /^(−?)\$([\d,.]+)([TBM]?)$/.exec(formatted);
        if (match === null) throw new Error(`unparseable: ${formatted}`);
        const units: Record<string, number> = { T: 1e12, B: 1e9, M: 1e6, '': 1 };
        // Rounded to the dollar: the product of a decimal string and 1e9 is not exact in
        // binary floating point, and the claim under test is exactness to the dollar.
        const magnitude = Math.round(
          Number(match[2]?.replace(/,/g, '')) * (units[match[3] ?? ''] as number),
        );
        return match[1] === '−' ? -magnitude : magnitude;
      };

      for (let millions = 1; millions <= 200_000; millions += 7) {
        const usd = usdFromMillions(millions);
        expect(parse(formatUsdScaled(usd)), `${millions}M`).toBe(usd);
        expect(parse(formatUsdScaled(usdFromMillions(-millions))), `-${millions}M`).toBe(-usd);
      }
    });

    it('drops a trailing zero rather than claiming precision it did not measure', () => {
      expect(formatUsdScaled(usdFromMillions(2_000))).toBe('$2B');
      expect(formatUsdScaled(usdFromMillions(54_050))).toBe('$54.05B');
      expect(formatUsdScaled(usdFromMillions(54_000))).toBe('$54B');
    });

    it('falls to the next unit down rather than rounding to fit one', () => {
      // A figure that is not a whole thousandth of a billion cannot be written in billions
      // without losing a dollar, so it is written in millions instead. Same rule again below
      // millions. The fall-through is what makes "nothing rounds" true by construction.
      expect(formatUsdScaled(usdFromMillions(500))).toBe('$500M');
      expect(formatUsdScaled(1_000_000_000 + 500_000)).toBe('$1,000.5M');
      // Not `$1,234.567K`: below a million, grouped dollars read better and there is no
      // thousands tier to fall into.
      expect(formatUsdScaled(1_234_567)).toBe('$1,234,567');
      expect(formatUsdScaled(999_000)).toBe('$999,000');
      expect(formatUsdScaled(999)).toBe('$999');
    });

    it('carries a true minus sign, like every other figure on this canvas', () => {
      expect(formatUsdScaled(usdFromMillions(-133_749))).toBe('−$133.749B');
    });

    it('handles zero without a stray sign', () => {
      expect(formatUsdScaled(0)).toBe('$0');
    });
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
