import { describe, expect, it } from 'vitest';
import { CONSTRICTION_SPAN_PX } from '../encoding';
import { usdFromMillions, widthPx } from '../scales';
import { layoutScene } from './layout';
import { SPACING } from './placeholders';
import { composeOrThrow, microsoftFy2026, referenceLoad } from './reference-load';
import type { Scene } from './scene';

const VIEWPORT = { widthPx: 1440, heightPx: 900 };

function msftScene(): Scene {
  return layoutScene(composeOrThrow(microsoftFy2026()), VIEWPORT);
}

describe('layout — widths are copied, never computed', () => {
  it('renders every river at exactly the width Cartographer stated', () => {
    const model = composeOrThrow(microsoftFy2026());
    const scene = layoutScene(model, VIEWPORT);
    for (let i = 0; i < model.rivers.length; i += 1) {
      const river = model.rivers[i];
      const lane = scene.rivers[i];
      expect(lane?.headWidthPx).toBe(river?.headWidthPx);
      expect(lane?.mouthWidthPx).toBe(river?.mouthWidthPx);
      expect(lane?.stations.map((s) => s.widthPx)).toEqual(river?.stations.map((s) => s.widthPx));
    }
  });

  it('puts Microsoft on screen at the documented pixel figures', () => {
    const scene = msftScene();
    expect(scene.rivers[0]?.headWidthPx).toBeCloseTo(139.996, 6);
    expect(scene.rivers[0]?.mouthWidthPx).toBeCloseTo(83.879, 6);
    expect(scene.trunk.arrivingWidthPx).toBeCloseTo(155.237, 6);
    expect(scene.trunk.departingWidthPx).toBeCloseTo(133.749, 6);
    expect(scene.trunk.constriction.removedWidthPx).toBeCloseTo(21.488, 6);
  });

  it('drawn bank separation equals the stated width at every station', () => {
    // The pixels a reader actually measures. If the polyline drifted from the station
    // widths, Invariant 3.1 would be broken in the one place it matters.
    const scene = msftScene();
    for (const lane of scene.rivers) {
      for (const station of lane.stations) {
        const top = lane.banks.top.find((p) => Math.abs(p.x - station.x) < 1e-9);
        const bottom = lane.banks.bottom.find((p) => Math.abs(p.x - station.x) < 1e-9);
        expect(top).toBeDefined();
        expect(bottom).toBeDefined();
        expect((bottom?.y ?? 0) - (top?.y ?? 0)).toBeCloseTo(station.widthPx, 6);
      }
    }
  });

  it('conserves at the confluence: the mouths exactly fill the trunk', () => {
    // The whole picture rests on this. Rivers in, trunk out, nothing created or lost.
    const scene = msftScene();
    const mouths = scene.rivers.reduce((sum, lane) => sum + lane.mouthWidthPx, 0);
    expect(mouths).toBeCloseTo(scene.trunk.arrivingWidthPx, 9);

    // And they are packed edge to edge, centred on the trunk axis, with no gaps.
    const ordered = [...scene.rivers].sort((a, b) => a.mouthCentreY - b.mouthCentreY);
    for (let i = 1; i < ordered.length; i += 1) {
      const above = ordered[i - 1];
      const below = ordered[i];
      const aboveEdge = (above?.mouthCentreY ?? 0) + (above?.mouthWidthPx ?? 0) / 2;
      const belowEdge = (below?.mouthCentreY ?? 0) - (below?.mouthWidthPx ?? 0) / 2;
      expect(aboveEdge).toBeCloseTo(belowEdge, 6);
    }
  });

  it('holds every river width constant through the confluence run', () => {
    const scene = msftScene();
    for (const lane of scene.rivers) {
      const tail = lane.banks.top.filter((p) => p.x > lane.mouthX);
      for (const point of tail) {
        const bottom = lane.banks.bottom[lane.banks.top.indexOf(point)];
        expect((bottom?.y ?? 0) - point.y).toBeCloseTo(lane.mouthWidthPx, 6);
      }
    }
  });

  it('gives every constriction the identical longitudinal span, trunk included', () => {
    const scene = msftScene();
    const spans = new Set<number>();
    for (const lane of scene.rivers) {
      for (const c of lane.constrictions) spans.add(Number((c.exitX - c.enterX).toFixed(9)));
    }
    spans.add(
      Number((scene.trunk.constriction.exitX - scene.trunk.constriction.enterX).toFixed(9)),
    );
    expect([...spans]).toEqual([CONSTRICTION_SPAN_PX]);
  });

  it('carries a dollar annotation on every constriction — 0002 C2', () => {
    const scene = msftScene();
    const all = [...scene.rivers.flatMap((l) => l.constrictions), scene.trunk.constriction];
    expect(all).toHaveLength(7);
    for (const c of all) {
      // Scaled and exact: `$25.017B`, `$31.1B`. Was `/^\$[\d,]+M$/` when every figure
      // was drawn in millions. What C2 requires is that the figure is PRESENT, not which
      // unit carries it — and `format.test.ts` proves the scaling loses nothing.
      expect(c.annotation.text).toMatch(/^−?\$[\d,]+(\.\d{1,3})?[TBM]?$/);
      expect(c.annotation.valueUsd).toBeGreaterThan(0);
      expect(c.removedWidthPx + (c.overdraw?.unrepresentedWidthPx ?? 0)).toBeCloseTo(
        widthPx(c.annotation.valueUsd),
        9,
      );
    }
  });

  it('carries the trunk constriction distinct-treatment flag through to the scene', () => {
    const scene = msftScene();
    expect(scene.trunk.constriction.distinctTreatmentRequired).toBe(true);
    for (const lane of scene.rivers) {
      for (const c of lane.constrictions) expect(c.distinctTreatmentRequired).toBe(false);
    }
  });

  it('labels disclosure depth on every river — Invariant 3.2', () => {
    const scene = msftScene();
    for (const lane of scene.rivers) {
      expect(lane.disclosureNote).toContain('2 expense categories');
    }
  });

  it('marks the aggregate river as combined rather than filer-shaped', () => {
    const scene = layoutScene(composeOrThrow(referenceLoad(12)), VIEWPORT);
    const aggregate = scene.rivers.find((lane) => lane.aggregated);
    expect(aggregate?.disclosureNote).toContain('Combined');
    expect(aggregate?.disclosureNote).not.toContain('expense categories');
  });
});

describe('layout — overflow is reported, never corrected', () => {
  it('reports overflow instead of scaling to fit', () => {
    const scene = layoutScene(composeOrThrow(referenceLoad(12)), { widthPx: 800, heightPx: 400 });
    expect(scene.overflow.panRequired).toBe(true);
    expect(scene.notes.some((note) => note.code === 'overflow')).toBe(true);
    // The pixel widths are unchanged by the small viewport. That is the assertion.
    const wide = layoutScene(composeOrThrow(referenceLoad(12)), { widthPx: 4000, heightPx: 3000 });
    expect(scene.rivers.map((l) => l.headWidthPx)).toEqual(wide.rivers.map((l) => l.headWidthPx));
    expect(scene.trunk.arrivingWidthPx).toBe(wide.trunk.arrivingWidthPx);
    expect(scene.lakeRegion.lake.planAreaPx2).toBe(wide.lakeRegion.lake.planAreaPx2);
  });

  it('is otherwise independent of the viewport — layout is not responsive geometry', () => {
    const a = layoutScene(composeOrThrow(microsoftFy2026()), { widthPx: 1440, heightPx: 900 });
    const b = layoutScene(composeOrThrow(microsoftFy2026()), { widthPx: 2560, heightPx: 1440 });
    expect(a.rivers).toEqual(b.rivers);
    expect(a.trunk).toEqual(b.trunk);
    expect(a.lakeRegion).toEqual(b.lakeRegion);
  });
});

describe('layout — determinism and notes', () => {
  it('is a pure function: same model, same scene, every time', () => {
    expect(msftScene()).toEqual(msftScene());
  });

  it('states the fiscal period and the baseline-flow disclosure', () => {
    const scene = msftScene();
    const codes = scene.notes.map((note) => note.code);
    expect(codes).toContain('period');
    expect(codes).toContain('baseline-flow');
    expect(scene.notes.find((n) => n.code === 'period')?.text).toBe('FY2026');
  });

  it('adds the single-segment note only when the filer reports one segment — 3.8', () => {
    expect(msftScene().notes.some((n) => n.code === 'single-segment')).toBe(false);
    const single = composeOrThrow({
      ...microsoftFy2026(),
      segments: [microsoftFy2026().segments[0]] as never,
      netEarningsUsd: usdFromMillions(70_000),
      residualComponents: [{ id: 'x', label: 'Taxes', amountUsd: usdFromMillions(13_879) }],
    });
    const scene = layoutScene(single, VIEWPORT);
    expect(scene.notes.some((n) => n.code === 'single-segment')).toBe(true);
  });

  it('says when segments are collapsed and that they still reach the lake — 3.7', () => {
    const scene = layoutScene(composeOrThrow(referenceLoad(12)), VIEWPORT);
    const note = scene.notes.find((n) => n.code === 'collapsed');
    expect(note?.text).toContain('4 more segments');
    expect(note?.text).toContain('still flow into the lake');
  });

  it('never places a lane gap that varies with a quantity', () => {
    const scene = msftScene();
    const gaps: number[] = [];
    const ordered = [...scene.rivers].sort((a, b) => a.headCentreY - b.headCentreY);
    for (let i = 1; i < ordered.length; i += 1) {
      const above = ordered[i - 1];
      const below = ordered[i];
      gaps.push(
        (below?.headCentreY ?? 0) -
          (below?.headWidthPx ?? 0) / 2 -
          ((above?.headCentreY ?? 0) + (above?.headWidthPx ?? 0) / 2),
      );
    }
    for (const gap of gaps) expect(gap).toBeCloseTo(SPACING.laneGapPx, 9);
  });
});
