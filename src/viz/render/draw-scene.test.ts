import { describe, expect, it } from 'vitest';
import { usdFromMillions } from '../scales';
import {
  drawHighlight,
  drawLegend,
  drawParticles,
  drawScene,
  type DrawOptions,
} from './draw-scene';
import { drawTrunkTerminus } from './draw-trunk';
import { layoutScene } from './layout';
import { composeOrThrow, microsoftFy2026 } from './reference-load';
import { RecordingContext } from './testing/recording-context';

const VIEWPORT = { widthPx: 1440, heightPx: 900 };
const scene = layoutScene(composeOrThrow(microsoftFy2026()), VIEWPORT);

function options(overrides: Partial<DrawOptions> = {}): DrawOptions {
  return {
    effectsQuality: 1,
    particleX: new Float32Array(0),
    particleY: new Float32Array(0),
    particleCount: 0,
    highlightId: null,
    noteTextOverride: null,
    ...overrides,
  };
}

describe('drawScene', () => {
  it('draws the ground before the water, and the type last', () => {
    const ctx = new RecordingContext();
    drawScene(ctx.as(), scene, options());
    const firstFillRect = ctx.calls.findIndex((call) => call.op === 'fillRect');
    const firstFill = ctx.calls.findIndex((call) => call.op === 'fill');
    const lastText = ctx.calls.map((call) => call.op).lastIndexOf('fillText');
    expect(firstFillRect).toBeLessThan(firstFill);
    expect(lastText).toBeGreaterThan(firstFill);
  });

  it('renders every element of the metaphor the geometry resolves', () => {
    const ctx = new RecordingContext();
    drawScene(ctx.as(), scene, options());
    const texts = ctx.texts().join(' | ');
    for (const expected of [
      'Productivity and Business Processes',
      'Intelligent Cloud',
      'More Personal Computing',
      'All segments combined',
      'Taxes and non-operating items',
      '$133,749M',
      'FY2026 net earnings',
      'stated separately',
    ]) {
      expect(texts, expected).toContain(expected);
    }
  });

  it('draws the width indicator as a bar and the area indicator as a disc — 0001 C6', () => {
    const ctx = new RecordingContext();
    drawLegend(ctx.as(), scene);
    expect(ctx.ops('fillRect')).toHaveLength(1);
    expect(ctx.ops('arc').length).toBeGreaterThan(0);
    const texts = ctx.texts().join(' ');
    expect(texts).toContain('A river this wide carries');
    expect(texts).toContain('This shape covers');
  });

  it('draws particles as 1px rects and nothing when the count is zero', () => {
    const empty = new RecordingContext();
    drawParticles(empty.as(), options());
    expect(empty.calls).toHaveLength(0);

    const some = new RecordingContext();
    drawParticles(
      some.as(),
      options({
        particleX: Float32Array.from([10, 20, 30]),
        particleY: Float32Array.from([1, 2, 3]),
        particleCount: 3,
      }),
    );
    expect(some.ops('fillRect')).toHaveLength(3);
  });

  it('highlights by outline, never by a change of hue', () => {
    const ctx = new RecordingContext();
    const lane = scene.rivers[0];
    drawHighlight(ctx.as(), scene, lane?.id ?? null);
    expect(ctx.ops('stroke').length).toBeGreaterThan(0);
    for (const colour of ctx.colours()) {
      const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(colour);
      if (match === null) continue;
      expect(match[1]).toBe(match[2]);
      expect(match[2]).toBe(match[3]);
    }
  });

  it('highlights a constriction and the lake as well as a river', () => {
    for (const id of [scene.trunk.constriction.id, 'lake']) {
      const ctx = new RecordingContext();
      drawHighlight(ctx.as(), scene, id);
      expect(ctx.ops('stroke').length, id).toBeGreaterThan(0);
    }
    const none = new RecordingContext();
    drawHighlight(none.as(), scene, null);
    expect(none.calls).toHaveLength(0);
  });

  it('substitutes a note’s text without moving it', () => {
    const plain = new RecordingContext();
    const overridden = new RecordingContext();
    drawScene(plain.as(), scene, options());
    drawScene(overridden.as(), scene, options({ noteTextOverride: { 'baseline-flow': 'X' } }));
    expect(overridden.texts()).toContain('X');
    expect([...overridden.coordinates()].sort()).toEqual([...plain.coordinates()].sort());
  });
});

/**
 * The basin is composed through `composeCanvas` — the entry point everyone actually
 * calls — since Cartographer made it total over the sign of net earnings this session.
 * `encoding/loss-case.test.ts` is the regression test that keeps it so; the former
 * `basinModel()` workaround that substituted a directly-composed lake onto a positive
 * model went with the upstream gap it papered over.
 *
 * PROBE QUANTITIES, NOT AN INVENTED COMPANY — `loss-case.test.ts` states the argument
 * in full, and Angel approved its application here 2026-08-21. Microsoft is profitable,
 * so a loss cannot be exercised with reported numbers. The input below is the real
 * FY2026 fixture with net earnings negated to the same magnitude: quantities probing
 * sign handling, never presented as a filing. The itemised residual components are
 * dropped because they tie to the profitable year's residual, and an itemisation that
 * does not tie is refused upstream (`residual-components-do-not-sum`).
 */
describe('drawScene — the drained basin', () => {
  const basinScene = layoutScene(
    composeOrThrow({
      ...microsoftFy2026(),
      netEarningsUsd: usdFromMillions(-133_749),
      residualComponents: [],
    }),
    VIEWPORT,
  );

  it('occupies the same footprint as an equal-magnitude lake — 0006, 0001 C5', () => {
    expect(basinScene.lakeRegion.widthPx).toBeCloseTo(scene.lakeRegion.widthPx, 9);
    expect(basinScene.lakeRegion.lake.planAreaPx2).toBe(scene.lakeRegion.lake.planAreaPx2);
  });

  it('carries the sign by a dry floor, a rim treatment and a label — never by colour', () => {
    expect(basinScene.lakeRegion.lake.signCues).toEqual(['dry-floor', 'rim-treatment', 'label']);
    const ctx = new RecordingContext();
    drawScene(ctx.as(), basinScene, options());
    // The hatch is the dry floor; the clip proves it stayed inside the basin.
    expect(ctx.ops('clip').length).toBeGreaterThan(0);
    expect(ctx.texts().join(' ')).toContain('FY2026 net loss');
    expect(ctx.texts().join(' ')).toContain('−$133,749M');
  });

  it('shows depth as a gauge, never as volume — 3.4, kill-list K13', () => {
    const gauge = basinScene.lakeRegion.lake.depthGauge;
    expect(gauge).not.toBeNull();
    // Depth is pinned by identity to the width constant: as deep as a river carrying the
    // same dollars is wide.
    expect(basinScene.lakeRegion.lake.depthBelowShorelinePx).toBeCloseTo(133.749, 6);
    expect(gauge?.text).toContain('redundant channel');
  });

  it('gives a positive result no depth gauge at all', () => {
    expect(scene.lakeRegion.lake.depthGauge).toBeNull();
    expect(scene.lakeRegion.lake.depthBelowShorelinePx).toBe(0);
  });

  it('ends a consumed trunk AT the closure point, with no tail and no terminus mark', () => {
    // Approved by Angel 2026-08-21: the taper brings the banks to the centreline at the
    // constriction exit, and that closure point IS the terminus. The tail collapses to
    // zero length and the terminus bar is not drawn — a mark with no dollars behind it.
    // The departing caption ("$0M") is NOT suppressed; its wording is Angel's and
    // Atelier's pending call, and it stays visible by ruling.
    expect(basinScene.trunk.departingWidthPx).toBe(0);
    expect(basinScene.trunk.endX).toBe(basinScene.trunk.constriction.exitX);
    const ctx = new RecordingContext();
    drawTrunkTerminus(ctx.as(), basinScene.trunk);
    expect(ctx.calls).toHaveLength(0);
    // The positive trunk keeps both: a real tail run and a drawn terminus.
    expect(scene.trunk.endX).toBeGreaterThan(scene.trunk.constriction.exitX);
    const positive = new RecordingContext();
    drawTrunkTerminus(positive.as(), scene.trunk);
    expect(positive.calls.length).toBeGreaterThan(0);
  });
});
