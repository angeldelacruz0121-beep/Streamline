/**
 * The world model (decision 0038) — the film's dressing, computed. SCENERY, NEVER DATA.
 *
 * Everything here is a pure function of (scene extents, seed text). The seed is the
 * filer's CIK STRING and nothing else: the same company gets the same hills forever, and
 * no financial quantity can shape the scenery — `world.test.ts` proves both directions
 * (same seed → identical model; doubled filed numbers → identical tiles), and a source-scan
 * test asserts this file never touches a financial field.
 *
 * Angel's governing clause binds the whole module: the world exists to dress the
 * picture, and any conflict with legibility or determinism resolves against the world.
 *
 * ANTI-BAR LAW (Angel's ruling, 2026-08-30): nothing generated here may look like a bar
 * chart. Ridges are bounded-slope polylines — no vertical edge taller than 8px, no slope
 * steeper than 0.9, three to five vertices per 160px tile. Asserted in `world.test.ts`.
 */
import { SPACING, WORLD } from './placeholders';
import type { Pt, Scene } from './scene';

export interface MistBand {
  readonly x: number;
  readonly y: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly dense: boolean;
}

export interface WorldModel {
  readonly widthPx: number;
  readonly heightPx: number;
  /** The sky/terrain boundary. Content begins below it; text never sits above it. */
  readonly horizonY: number;
  /** Closed polygons (last two points on the horizon), far drawn before near. */
  readonly ridgeFar: readonly Pt[];
  readonly ridgeNear: readonly Pt[];
  readonly mist: readonly MistBand[];
}

/** FNV-1a over the seed text. Identity only — never a filed number. */
export function seedHash(seedText: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — the particle system's precedent for cheap deterministic streams. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One ridge, built tile by tile. EVERY TILE'S SHAPE IS A PURE FUNCTION OF
 * (seed, ridge id, tile index): anchors sit at tile boundaries with heights drawn
 * from a per-tile stream, and interior vertices interpolate between anchors with
 * bounded jitter. Content extent therefore chooses only HOW MANY tiles are visible —
 * it can never change what any tile looks like, which is the mechanical form of the
 * scenery-is-not-data theorem (`world.test.ts` doubles every filed number and asserts
 * the shared tiles are byte-identical).
 *
 * Slopes are bounded by construction: anchors 160px apart differ by at most the amp
 * band (~32px, slope 0.2), and interior jitter is ±8px over at least 32px of run.
 * The polygon closes to the horizon OUTSIDE the visible span, so the closing edges
 * also respect the slope law.
 */
function anchorHeight(seed: number, ridgeId: number, tileIndex: number, ampPx: number): number {
  const r = mulberry32(
    (seed ^ Math.imul(ridgeId + 1, 0x9e3779b9) ^ Math.imul(tileIndex + 1, 0x85ebca6b)) >>> 0,
  )();
  return WORLD.hillHeightMinPx + r * (ampPx - WORLD.hillHeightMinPx);
}

function buildRidge(
  seed: number,
  ridgeId: number,
  widthPx: number,
  horizonY: number,
  ampPx: number,
): readonly Pt[] {
  const runoutPx = ampPx * 2 + 8;
  const points: Pt[] = [{ x: -runoutPx, y: horizonY }];
  const tileCount = Math.ceil((widthPx + WORLD.overscanPx) / WORLD.hillTilePx) + 1;
  for (let t = 0; t < tileCount; t++) {
    const tileRand = mulberry32(
      (seed ^ Math.imul(ridgeId + 7, 0xc2b2ae35) ^ Math.imul(t + 1, 0x27d4eb2f)) >>> 0,
    );
    const fromY = horizonY - anchorHeight(seed, ridgeId, t, ampPx);
    const toY = horizonY - anchorHeight(seed, ridgeId, t + 1, ampPx);
    const interior = 2 + Math.floor(tileRand() * 3); // 2..4 interior + the closing anchor = 3..5
    for (let i = 0; i < interior; i++) {
      const frac = (i + 1) / (interior + 1);
      const jitter = (tileRand() - 0.5) * 16;
      points.push({
        x: t * WORLD.hillTilePx + frac * WORLD.hillTilePx,
        y: Math.min(horizonY - 2, fromY + (toY - fromY) * frac + jitter),
      });
    }
    points.push({ x: (t + 1) * WORLD.hillTilePx, y: toY });
  }
  points.push({ x: tileCount * WORLD.hillTilePx + runoutPx, y: horizonY });
  return points;
}

/**
 * Mist, one band per 640px window, each window's band a pure function of
 * (seed, window index) — the same purity rule as the ridge tiles, so content
 * extent chooses only how many windows are visible.
 */
const MIST_WINDOW_PX = 640;

function buildMist(seed: number, widthPx: number, horizonY: number): readonly MistBand[] {
  const bands: MistBand[] = [];
  const windows = Math.ceil(widthPx / MIST_WINDOW_PX);
  for (let i = 0; i < windows; i++) {
    const rand = mulberry32((seed ^ 0x5bd1e995 ^ Math.imul(i + 1, 0x165667b1)) >>> 0);
    const w = 240 + rand() * 320;
    bands.push({
      x: i * MIST_WINDOW_PX + rand() * (MIST_WINDOW_PX - 200),
      y: horizonY - 10 - rand() * (WORLD.hillClearancePx - 14),
      widthPx: w,
      heightPx: 6 + rand() * 8,
      dense: rand() < 0.4,
    });
  }
  return bands;
}

export function buildWorld(scene: Scene, seedText: string): WorldModel {
  const seed = seedHash(seedText);
  const widthPx = scene.contentWidthPx;
  const horizonY = SPACING.marginPx + SPACING.skyBandPx;
  return {
    widthPx,
    heightPx: scene.contentHeightPx,
    horizonY,
    ridgeFar: buildRidge(seed, 0, widthPx, horizonY, WORLD.hillHeightMaxPx),
    ridgeNear: buildRidge(seed, 1, widthPx, horizonY, WORLD.hillHeightMaxPx * 0.6),
    mist: buildMist(seed, widthPx, horizonY),
  };
}

/**
 * Memoized per (scene identity, seed) — the 0037 lesson: per-frame model rebuilding is
 * allocation churn the perf gate will catch. A relayout produces a new Scene object and
 * naturally invalidates.
 */
const worlds = new WeakMap<Scene, Map<string, WorldModel>>();

export function worldFor(scene: Scene, seedText: string): WorldModel {
  let bySeed = worlds.get(scene);
  if (bySeed === undefined) {
    bySeed = new Map();
    worlds.set(scene, bySeed);
  }
  let model = bySeed.get(seedText);
  if (model === undefined) {
    if (bySeed.size > 8) bySeed.clear();
    model = buildWorld(scene, seedText);
    bySeed.set(seedText, model);
  }
  return model;
}
