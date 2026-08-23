import { describe, expect, it } from 'vitest';
import { drawConstrictionAnnotation, drawConstrictionCue, drawRiver } from './draw-river';
import { drawTrunk } from './draw-trunk';
import { layoutScene } from './layout';
import { CONSTRICTION_CUES } from './placeholders';
import { composeOrThrow, microsoftFy2026 } from './reference-load';
import { RecordingContext } from './testing/recording-context';

const scene = layoutScene(composeOrThrow(microsoftFy2026()), { widthPx: 1440, heightPx: 900 });
const quality = { effectsQuality: 1 };

function drawFirstRiver(): RecordingContext {
  const ctx = new RecordingContext();
  const lane = scene.rivers[0];
  if (lane !== undefined) drawRiver(ctx.as(), lane, quality);
  return ctx;
}

describe('drawing a river', () => {
  it('traces both banks and closes the silhouette', () => {
    const ctx = drawFirstRiver();
    const lane = scene.rivers[0];
    expect(ctx.ops('closePath').length).toBeGreaterThan(0);
    const points = ctx.coordinates();
    const head = lane?.banks.top[0];
    expect(points.has(`${head?.x.toFixed(6)},${head?.y.toFixed(6)}`)).toBe(true);
  });

  it('writes the segment label, its revenue and its disclosure depth', () => {
    const texts = drawFirstRiver().texts();
    expect(texts).toContain('Productivity and Business Processes');
    expect(texts).toContain('$139,996M revenue');
    expect(texts.some((t) => t.includes('2 expense categories'))).toBe(true);
    expect(texts).toContain('$83,879M');
  });

  it('writes the dollar figure and the filer’s own label at every constriction', () => {
    const texts = drawFirstRiver().texts();
    expect(texts).toContain('$25,017M');
    expect(texts).toContain('Cost of revenue');
    expect(texts).toContain('$31,100M');
    expect(texts).toContain('Operating expenses');
  });

  it('alternates the annotation side so two figures on one lane cannot collide', () => {
    const lane = scene.rivers[0];
    const [first, second] = lane?.constrictions ?? [];
    expect((first?.annotation.anchor.y ?? 0) < (lane?.headCentreY ?? 0)).toBe(true);
    expect((second?.annotation.anchor.y ?? 0) > (lane?.headCentreY ?? 0)).toBe(true);
  });

  it('draws a leader from the figure to the geometry it dimensions', () => {
    const ctx = new RecordingContext();
    const c = scene.rivers[0]?.constrictions[0];
    if (c !== undefined) drawConstrictionAnnotation(ctx.as(), c);
    const lines = ctx.ops('lineTo');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.args[1]).toBeCloseTo(c?.annotation.leaderTo.y ?? 0, 9);
  });

  it('drops the bank highlight when effects are off, but keeps the fill', () => {
    const ctx = new RecordingContext();
    const lane = scene.rivers[0];
    if (lane !== undefined) drawRiver(ctx.as(), lane, { effectsQuality: 0 });
    expect(ctx.ops('fill').length).toBeGreaterThan(0);
    const full = drawFirstRiver();
    expect(ctx.ops('stroke').length).toBeLessThan(full.ops('stroke').length);
    // And the geometry is untouched — the fill traced the same path.
    expect([...ctx.coordinates()].sort()).toEqual([...full.coordinates()].sort());
  });
});

describe('constriction cues — 0002 C4', () => {
  it('marks a segment cost with one rim and the trunk residual with two', () => {
    const segmentCtx = new RecordingContext();
    const c = scene.rivers[0]?.constrictions[0];
    if (c !== undefined) drawConstrictionCue(segmentCtx.as(), c);
    const trunkCtx = new RecordingContext();
    drawConstrictionCue(trunkCtx.as(), scene.trunk.constriction);

    expect(CONSTRICTION_CUES['segment-cost'].rimCount).toBe(1);
    expect(CONSTRICTION_CUES['trunk-residual'].rimCount).toBe(2);
    // One rim = one moveTo/lineTo pair. Two rims plus two ticks = four.
    expect(segmentCtx.ops('moveTo')).toHaveLength(1);
    expect(trunkCtx.ops('moveTo')).toHaveLength(4);
  });

  it('takes the distinction from shape, not from colour', () => {
    const segmentCtx = new RecordingContext();
    const c = scene.rivers[0]?.constrictions[0];
    if (c !== undefined) drawConstrictionCue(segmentCtx.as(), c);
    const trunkCtx = new RecordingContext();
    drawConstrictionCue(trunkCtx.as(), scene.trunk.constriction);
    expect([...trunkCtx.colours()]).toEqual([...segmentCtx.colours()]);
  });

  it('does not take the distinction from length — the span is identical', () => {
    const c = scene.rivers[0]?.constrictions[0];
    expect(scene.trunk.constriction.spanPx).toBe(c?.spanPx);
  });
});

describe('drawing the trunk', () => {
  function drawn(): RecordingContext {
    const ctx = new RecordingContext();
    drawTrunk(ctx.as(), scene.trunk, quality);
    return ctx;
  }

  it('names itself as the whole company, not as another segment', () => {
    const texts = drawn().texts();
    expect(texts).toContain('All segments combined');
    expect(texts).toContain('$155,237M segment operating income');
    expect(texts).toContain('$133,749M');
  });

  it('labels the residual in plain language rather than leaving it to position', () => {
    // MISREADING-TESTS §3: position after the confluence is explicitly not sufficient.
    expect(drawn().texts()).toContain('Taxes and non-operating items');
    expect(drawn().texts()).toContain('$21,488M');
  });

  it('ends the flow with a finished cap, not a torn edge', () => {
    const ctx = drawn();
    const half = scene.trunk.departingWidthPx / 2;
    const capTop = `${scene.trunk.endX.toFixed(6)},${(scene.trunk.centreY - half).toFixed(6)}`;
    const capBottom = `${scene.trunk.endX.toFixed(6)},${(scene.trunk.centreY + half).toFixed(6)}`;
    expect(ctx.coordinates().has(capTop)).toBe(true);
    expect(ctx.coordinates().has(capBottom)).toBe(true);
    expect(ctx.ops('setLineDash')).toHaveLength(0);
  });

  it('says when the residual itemisation was not supplied — 0002 C3', () => {
    const withoutItems = composeOrThrow({ ...microsoftFy2026(), residualComponents: [] });
    const bare = layoutScene(withoutItems, { widthPx: 1440, heightPx: 900 });
    const ctx = new RecordingContext();
    drawTrunk(ctx.as(), bare.trunk, quality);
    expect(ctx.texts()).toContain('Residual itemisation not supplied');
    expect(drawn().texts()).not.toContain('Residual itemisation not supplied');
  });
});
