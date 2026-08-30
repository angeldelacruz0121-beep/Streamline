import { describe, expect, it } from 'vitest';
import { usdFromMillions } from '../scales';
import { buildHitIndex, hitTest } from './hit-test';
import { layoutScene } from './layout';
import { composeOrThrow, microsoftFy2026, referenceLoad } from './reference-load';

const VIEWPORT = { widthPx: 1440, heightPx: 900 };
const scene = layoutScene(composeOrThrow(microsoftFy2026()), VIEWPORT);
const index = buildHitIndex(scene);

describe('hit testing — Invariant 1, every river and constriction is clickable', () => {
  it('finds a river from a point inside its banks', () => {
    const lane = scene.rivers[0];
    const hit = hitTest(index, (lane?.headX ?? 0) + 20, lane?.headCentreY ?? 0);
    expect(hit?.id).toBe(lane?.id);
    expect(hit?.kind).toBe('river');
    expect(hit?.valueUsd).toBe(usdFromMillions(139_996));
    // The template the river head has always printed, reused verbatim for the hover box.
    expect(hit?.valueText).toBe('$139,996M revenue');
  });

  it('carries the rows the canvas stopped drawing, and nothing it never had', () => {
    // The other half of the text triage. What left the picture is reachable here, so no
    // information was lost — and what was never on the canvas is not invented here either.
    const lane = scene.rivers[0];
    const hit = hitTest(index, (lane?.headX ?? 0) + 20, lane?.headCentreY ?? 0);
    expect(hit?.detail?.[0]).toBe('$83,879M segment operating income');
    expect(hit?.detail?.[1]).toContain('2 expense categories');

    // NOT the D17 analyst panel: no accession, form, tag or provenance reaches a hit.
    const serialised = JSON.stringify(hit);
    for (const forbidden of ['accession', 'us-gaap', 'provenance', 'sourceRef', '10-K']) {
      expect(serialised, forbidden).not.toContain(forbidden);
    }
  });

  it('gives a constriction its figure, and the trunk its shortfall note when there is one', () => {
    const c = scene.rivers[0]?.constrictions[0];
    const hit = hitTest(index, ((c?.enterX ?? 0) + (c?.exitX ?? 0)) / 2, c?.centreY ?? 0);
    expect(hit?.kind).toBe('constriction');
    // The hover box quotes the filing's unit; the canvas quotes the scaled one. Both exact.
    expect(hit?.valueText).toBe('$25,017M');
    expect(c?.annotation.text).toBe('$25.017B');
    // Microsoft overdraws nothing, so there is no shortfall to state.
    expect(hit?.detail).toEqual([]);
  });

  it('finds every constriction on every river', () => {
    for (const lane of scene.rivers) {
      for (const c of lane.constrictions) {
        const hit = hitTest(index, (c.enterX + c.exitX) / 2, c.centreY);
        expect(hit?.id, c.id).toBe(c.id);
        expect(hit?.kind).toBe('constriction');
        expect(hit?.valueUsd).toBe(c.annotation.valueUsd);
      }
    }
  });

  it('prefers the constriction over the river it sits on', () => {
    const c = scene.rivers[0]?.constrictions[0];
    const hit = hitTest(index, (c?.enterX ?? 0) + 1, c?.centreY ?? 0);
    expect(hit?.kind).toBe('constriction');
  });

  it('finds the trunk constriction and reports it as its own kind', () => {
    const c = scene.trunk.constriction;
    const hit = hitTest(index, (c.enterX + c.exitX) / 2, c.centreY);
    expect(hit?.kind).toBe('trunk-constriction');
    expect(hit?.valueUsd).toBe(usdFromMillions(21_488));
    expect(hit?.label).toBe('Taxes and non-operating items');
  });

  it('gives a 21px constriction enough grab area to be clickable', () => {
    // The trunk pinch is 21.5px of removed width on a 155px trunk. Invariant 3.9 says
    // legibility is solved by interaction, so the target has to actually be hittable.
    const c = scene.trunk.constriction;
    const hit = hitTest(index, c.enterX - 4, c.centreY);
    expect(hit?.id).toBe(c.id);
  });

  it('finds the lake and reports the exact net-earnings figure', () => {
    const hit = hitTest(index, scene.lakeRegion.lake.centre.x, scene.lakeRegion.lake.centre.y);
    expect(hit?.kind).toBe('lake');
    expect(hit?.valueText).toBe('$133,749M');
    expect(hit?.label).toBe('FY2026 net earnings');
  });

  it('returns null in the stated separation, which contains nothing to click', () => {
    const midGap = (scene.separation.trunkTerminusX + scene.separation.lakeRegionX) / 2;
    expect(hitTest(index, midGap, scene.trunk.centreY)).toBeNull();
  });

  it('returns null off the canvas', () => {
    expect(hitTest(index, -100, -100)).toBeNull();
    expect(hitTest(index, 99_999, 99_999)).toBeNull();
  });

  it('covers the aggregate river too, so "More" is reachable', () => {
    const big = layoutScene(composeOrThrow(referenceLoad(12)), VIEWPORT);
    const bigIndex = buildHitIndex(big);
    const aggregate = big.rivers.find((lane) => lane.aggregated);
    const hit = hitTest(bigIndex, (aggregate?.headX ?? 0) + 20, aggregate?.headCentreY ?? 0);
    expect(hit?.id).toBe(aggregate?.id);
  });

  it('is fast enough that latency cannot depend on the frame', () => {
    // Not a benchmark — a sanity bound. Twelve lanes, a thousand queries, well under the
    // 100ms budget for a single one by three orders of magnitude.
    const big = buildHitIndex(layoutScene(composeOrThrow(referenceLoad(12)), VIEWPORT));
    const started = performance.now();
    for (let i = 0; i < 1_000; i += 1) hitTest(big, 200 + (i % 900), 100 + (i % 600));
    const perQueryMs = (performance.now() - started) / 1_000;
    expect(perQueryMs).toBeLessThan(1);
  });
});
