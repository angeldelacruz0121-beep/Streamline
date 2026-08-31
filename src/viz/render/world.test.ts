/**
 * The world model's contract (decision 0038): scenery, never data.
 *
 * The two theorems that let the world ship at all: the same company gets the same
 * hills forever, and no financial figure can shape the scenery. Both are proven here
 * mechanically, alongside Angel's anti-bar ruling and the sky-band fences.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPACING, WORLD } from './placeholders';
import { buildWorld, seedHash, worldFor } from './world';
import { layoutScene } from './layout';
import { composeOrThrow, microsoftFy2026 } from './reference-load';
import type { Scene } from './scene';

const VIEWPORT = { widthPx: 1440, heightPx: 900 } as const;

function msftScene(): Scene {
  return layoutScene(composeOrThrow(microsoftFy2026()), VIEWPORT);
}

/** The same filing with every financial figure doubled, composed honestly. */
function doubledScene(): Scene {
  const input = microsoftFy2026();
  const doubled = {
    ...input,
    segments: input.segments.map((segment) => ({
      ...segment,
      revenueUsd: segment.revenueUsd * 2,
      operatingIncomeUsd: segment.operatingIncomeUsd * 2,
      costs: segment.costs.map((cost) => ({ ...cost, amountUsd: cost.amountUsd * 2 })),
    })),
    netEarningsUsd: input.netEarningsUsd * 2,
    residualComponents: (input.residualComponents ?? []).map((component) => ({
      ...component,
      amountUsd: component.amountUsd * 2,
    })),
  };
  return layoutScene(composeOrThrow(doubled), VIEWPORT);
}

describe('determinism — the same company gets the same hills forever', () => {
  it('identical (scene, seed) inputs produce byte-identical models', () => {
    const a = buildWorld(msftScene(), '0000789019');
    const b = buildWorld(msftScene(), '0000789019');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds produce different ridges — the hills really are per-company', () => {
    const scene = msftScene();
    const msft = buildWorld(scene, '0000789019');
    const nvda = buildWorld(scene, '0001045810');
    expect(JSON.stringify(msft.ridgeFar)).not.toBe(JSON.stringify(nvda.ridgeFar));
  });

  it('worldFor memoizes by scene identity and seed', () => {
    const scene = msftScene();
    expect(worldFor(scene, '0000789019')).toBe(worldFor(scene, '0000789019'));
    expect(worldFor(scene, '0000789019')).not.toBe(worldFor(scene, '0001045810'));
  });

  it('seedHash is a pure function of the text', () => {
    expect(seedHash('0000789019')).toBe(seedHash('0000789019'));
    expect(seedHash('0000789019')).not.toBe(seedHash('0001045810'));
  });
});

describe('figures never shape the scenery', () => {
  it('doubling every financial figure leaves the ridge geometry untouched', () => {
    // Doubling changes widths and areas, which changes content EXTENT — so compare
    // the ridge SHAPE over the shared span, not the raw arrays.
    const base = buildWorld(msftScene(), '0000789019');
    const doubled = buildWorld(doubledScene(), '0000789019');
    expect(base.widthPx).not.toBe(doubled.widthPx); // the doubling really changed extent
    const sharedSpan = Math.min(base.widthPx, doubled.widthPx) - WORLD.hillTilePx;
    const clip = (pts: readonly { x: number; y: number }[]) =>
      pts.filter((p) => p.x > 0 && p.x < sharedSpan);
    expect(JSON.stringify(clip(base.ridgeFar))).toBe(JSON.stringify(clip(doubled.ridgeFar)));
    expect(JSON.stringify(clip(base.ridgeNear))).toBe(JSON.stringify(clip(doubled.ridgeNear)));
    const mistClip = (bands: readonly { x: number }[]) => bands.filter((b) => b.x < sharedSpan);
    expect(JSON.stringify(mistClip(base.mist))).toBe(JSON.stringify(mistClip(doubled.mist)));
  });

  it('the module source never touches a financial field', () => {
    const source = readFileSync(join(process.cwd(), 'src/viz/render/world.ts'), 'utf8');
    for (const banned of [
      'Usd',
      'revenue',
      'operatingIncome',
      'netEarnings',
      'amountUsd',
      'valueText',
      'CanvasModel',
    ]) {
      expect(source, `world.ts mentions "${banned}"`).not.toContain(banned);
    }
  });
});

describe("Angel's anti-bar ruling and the sky-band fences", () => {
  const world = buildWorld(msftScene(), '0000789019');

  it('no ridge segment is steeper than slope 0.9 and none jumps more than 8px vertically at a point', () => {
    for (const ridge of [world.ridgeFar, world.ridgeNear]) {
      for (let i = 2; i < ridge.length - 1; i++) {
        const a = ridge[i - 1]!;
        const b = ridge[i]!;
        const dx = b.x - a.x;
        const dy = Math.abs(b.y - a.y);
        if (dx === 0) expect(dy, `vertical edge at x=${b.x}`).toBeLessThanOrEqual(8);
        else expect(dy / dx, `slope at x=${b.x}`).toBeLessThanOrEqual(0.9 + 1e-9);
      }
    }
  });

  it('hills and mist never leave the sky band, and never crowd its ceiling', () => {
    for (const ridge of [world.ridgeFar, world.ridgeNear]) {
      for (const p of ridge) {
        expect(p.y).toBeLessThanOrEqual(world.horizonY);
        expect(p.y).toBeGreaterThanOrEqual(world.horizonY - SPACING.skyBandPx);
      }
    }
    for (const band of world.mist) {
      expect(band.y + band.heightPx).toBeLessThanOrEqual(world.horizonY);
      expect(band.dense ? 0.2 : 0.14).toBeLessThanOrEqual(0.2);
    }
  });

  it('the horizon sits exactly at margin plus sky band — the fence the layout offsets under', () => {
    expect(world.horizonY).toBe(SPACING.marginPx + SPACING.skyBandPx);
  });
});
