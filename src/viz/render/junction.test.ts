import { describe, expect, it } from 'vitest';
import { AREA_PX2_PER_USD, WIDTH_PX_PER_USD, usdFromMillions } from '../scales';
import { UNRESOLVED_JUNCTION } from '../encoding';
import { drawJunctionSeam, drawSeparation, wrapText } from './draw-junction-seam';
import { layoutScene } from './layout';
import { JUNCTION_SEPARATION_PX } from './placeholders';
import { composeOrThrow, microsoftFy2026 } from './reference-load';
import { RecordingContext } from './testing/recording-context';

const VIEWPORT = { widthPx: 1440, heightPx: 900 };

function sceneFor(netEarningsMillions: number, extraTaxMillions = 0) {
  const base = microsoftFy2026();
  const operating = usdFromMillions(155_237);
  const net = usdFromMillions(netEarningsMillions);
  return layoutScene(
    composeOrThrow({
      ...base,
      netEarningsUsd: net,
      residualComponents: [
        {
          id: 'us-gaap:IncomeTaxExpenseBenefit',
          label: 'Provision for income taxes',
          amountUsd: operating - net + usdFromMillions(extraTaxMillions),
        },
        {
          id: 'us-gaap:NonoperatingIncomeExpense',
          label: 'Other income (expense), net',
          amountUsd: usdFromMillions(-extraTaxMillions),
        },
      ],
    }),
    VIEWPORT,
  );
}

/**
 * Q1 is answered — decision 0017, option 1. The lake is a labelled readout, spatially
 * separated from the trunk, and the conservation read is never invited.
 *
 * These tests exist to keep that a decision rather than a drift. `UNRESOLVED_JUNCTION`
 * names three closures that are barred; each one has an assertion here that would fail if
 * a future change took it.
 */
describe('the junction — a stated separation, not a gap', () => {
  it('records the decision on the scene', () => {
    const scene = sceneFor(133_749);
    expect(scene.separation.kind).toBe('stated-separation');
    expect(scene.separation.decision).toBe('Q1 / 0017 option 1');
    expect(scene.separation.connectorDrawn).toBe(false);
  });

  it('still carries the unresolved value as the record of why', () => {
    const scene = sceneFor(133_749);
    expect(scene.unresolvedJunction).toEqual(UNRESOLVED_JUNCTION);
    expect(scene.unresolvedJunction.blockedBy).toBe('Q1');
    expect(scene.unresolvedJunction.forbidden).toHaveLength(3);
  });

  it('separates by a constant that varies with nothing', () => {
    // If the gap moved with any quantity it would be a length channel a reader would
    // decode, which is the Invariant 3.6 breach the separation exists to avoid.
    const small = sceneFor(1_000);
    const large = sceneFor(133_749);
    expect(small.separation.gapPx).toBe(JUNCTION_SEPARATION_PX);
    expect(large.separation.gapPx).toBe(JUNCTION_SEPARATION_PX);
    expect(large.separation.lakeRegionX - large.separation.trunkTerminusX).toBeCloseTo(
      small.separation.lakeRegionX - small.separation.trunkTerminusX,
      9,
    );
  });

  // ---- FORBIDDEN CLOSURE 1 --------------------------------------------------------
  it('does not derive any placement from the ratio of the two scale constants', () => {
    // That ratio is 1000px and has no financial meaning. No length in the scene may equal
    // it or a simple multiple of it by construction.
    const ratioPx = AREA_PX2_PER_USD / WIDTH_PX_PER_USD;
    expect(ratioPx).toBeCloseTo(1000, 6);
    const scene = sceneFor(133_749);
    const lengths = [
      scene.separation.gapPx,
      scene.lakeRegion.widthPx,
      scene.lakeRegion.heightPx,
      scene.lakeRegion.x - scene.trunk.endX,
    ];
    for (const length of lengths) expect(length).not.toBeCloseTo(ratioPx, 6);
  });

  // ---- FORBIDDEN CLOSURE 2 --------------------------------------------------------
  it('does not choose a lake size that composes against the trunk', () => {
    // Change the trunk drastically while holding net earnings fixed. If the lake were
    // sized against the trunk, its geometry would move. It must not.
    const wideTrunk = sceneFor(133_749);
    const narrowTrunk = layoutScene(
      composeOrThrow({
        ...microsoftFy2026(),
        // Same net earnings, a far smaller set of segments feeding it.
        segments: [
          {
            id: 'only',
            label: 'Only segment',
            revenueUsd: usdFromMillions(150_000),
            costs: [{ id: 'c', label: 'Costs', amountUsd: usdFromMillions(10_000) }],
            operatingIncomeUsd: usdFromMillions(140_000),
          },
        ],
        netEarningsUsd: usdFromMillions(133_749),
        residualComponents: [{ id: 't', label: 'Taxes', amountUsd: usdFromMillions(6_251) }],
      }),
      VIEWPORT,
    );
    expect(narrowTrunk.trunk.arrivingWidthPx).not.toBeCloseTo(wideTrunk.trunk.arrivingWidthPx, 3);
    expect(narrowTrunk.lakeRegion.lake.planAreaPx2).toBe(wideTrunk.lakeRegion.lake.planAreaPx2);
    expect(narrowTrunk.lakeRegion.widthPx).toBeCloseTo(wideTrunk.lakeRegion.widthPx, 9);
    expect(narrowTrunk.lakeRegion.heightPx).toBeCloseTo(wideTrunk.lakeRegion.heightPx, 9);
  });

  // ---- FORBIDDEN CLOSURE 3 --------------------------------------------------------
  it('gives the lake no mouth at all, so no mouth can be set to the trunk width', () => {
    const scene = sceneFor(133_749);
    const lakeKeys = Object.keys(scene.lakeRegion.lake);
    expect(lakeKeys).not.toContain('mouthWidthPx');
    expect(lakeKeys).not.toContain('inletWidthPx');
    // And the lake's own extent is derived from plan area only.
    const area = scene.lakeRegion.lake.planAreaPx2;
    expect(scene.lakeRegion.lake.equivalentDiscRadiusPx).toBeCloseTo(Math.sqrt(area / Math.PI), 9);
  });

  it('scales the lake with the square root of earnings, not linearly like a width', () => {
    // The dimensional check that would fail if the lake had been pinned to a width.
    const one = sceneFor(30_000);
    const four = sceneFor(120_000);
    expect(four.lakeRegion.widthPx / one.lakeRegion.widthPx).toBeCloseTo(2, 6);
  });
});

describe('the junction — what is actually drawn', () => {
  function draw(): RecordingContext {
    const ctx = new RecordingContext();
    drawJunctionSeam(ctx.as(), sceneFor(133_749));
    return ctx;
  }

  it('draws nothing that crosses the gap', () => {
    const scene = sceneFor(133_749);
    const ctx = new RecordingContext();
    drawJunctionSeam(ctx.as(), scene);
    const from = scene.separation.trunkTerminusX;
    const to = scene.separation.lakeRegionX;
    const strokeOps = ctx.calls.filter((call) => call.op === 'moveTo' || call.op === 'lineTo');
    for (let i = 1; i < strokeOps.length; i += 1) {
      const a = strokeOps[i - 1];
      const b = strokeOps[i];
      if (a === undefined || b === undefined || b.op !== 'lineTo') continue;
      const ax = a.args[0] as number;
      const bx = b.args[0] as number;
      // A horizontal segment spanning the gap would be a connector. None may exist.
      const spansGap = Math.min(ax, bx) < from + 1 && Math.max(ax, bx) > to - 1;
      expect(spansGap).toBe(false);
    }
  });

  it('draws the divider as a vertical rule, which cannot be read as flow', () => {
    const scene = sceneFor(133_749);
    const ctx = new RecordingContext();
    drawSeparation(ctx.as(), scene);
    const moves = ctx.ops('moveTo');
    const lines = ctx.ops('lineTo');
    expect(moves.length).toBeGreaterThan(0);
    const x0 = moves[0]?.args[0] as number;
    const x1 = lines[0]?.args[0] as number;
    expect(x1).toBe(x0);
    expect(x0).toBeGreaterThan(scene.separation.trunkTerminusX);
    expect(x0).toBeLessThan(scene.separation.lakeRegionX);
  });

  it('never dashes anything — a dashed stub would read as a missing link', () => {
    expect(draw().ops('setLineDash')).toHaveLength(0);
  });

  it('says in words that the two scales do not convert', () => {
    // The words moved to the DOM margin; the sentence did not change and the decision did
    // not change. The picture keeps the half that belongs in a picture — the vertical rule,
    // asserted above — and the margin plate carries the prose, where the browser wraps it
    // and a screen reader can reach it.
    const note = sceneFor(133_749).separation.note;
    expect(note).toContain('stated separately');
    expect(note).toContain('do not convert');
    // And it must not read as unfinished work.
    expect(note.toLowerCase()).not.toContain('pending');
    expect(note.toLowerCase()).not.toContain('tbd');
    expect(note.toLowerCase()).not.toContain('unresolved');
    // Nothing on the canvas restates it.
    expect(draw().texts().join(' ')).not.toContain('stated separately');
  });

  it('renders the persistent exact net-earnings readout — 0001 C2', () => {
    // Persistent, tabular, and EXACT — `$133.749B` is `$133,749M` written in a unit a
    // reader takes in at a glance. Nothing is rounded, so C2 stands unamended; the
    // objection kill-list.md records against `$133,700M` does not reach this.
    expect(draw().texts()).toContain('$133.749B');
  });

  it('renders the fiscal period on the water — 0001 C3', () => {
    expect(draw().texts().join(' ')).toContain('FY2026 net earnings');
  });

  it('wraps the separation note to the width it was given', () => {
    const ctx = new RecordingContext();
    const lines = wrapText(ctx.as(), 'one two three four five six seven eight', 60);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length * 6).toBeLessThanOrEqual(66);
  });
});
