/**
 * Pointer hit testing, built once per layout and queried synchronously in the event
 * handler.
 *
 * This file exists because of the second half of Invariant 4.1: "Hard fail — any
 * interaction gated behind the render loop." Hit testing that walked the scene graph
 * inside a frame callback would make hover latency a function of frame time, which is
 * exactly the coupling 4.1 forbids. So the index is a flat array of closed polygons and
 * rectangles built at layout time, and a query is a handful of point-in-polygon tests
 * with no allocation and no canvas access.
 *
 * At the reference load — 12 flows, roughly 60 vertices each — a query is a few hundred
 * floating-point comparisons. The measured cost is in the harness; the design point is
 * that it does not depend on what the renderer is doing.
 */
import { pointInPolygon } from './silhouette';
import type { Pt, Scene } from './scene';
import type { Usd } from '../scales';

export type HitKind = 'river' | 'constriction' | 'trunk-constriction' | 'lake';

export interface HitTarget {
  readonly id: string;
  readonly kind: HitKind;
  readonly label: string;
  /** The reported figure this element states, for the tooltip. Never a derived one. */
  readonly valueUsd: Usd;
  readonly valueText: string;
}

interface IndexedRect {
  readonly target: HitTarget;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface IndexedPolygon {
  readonly target: HitTarget;
  readonly points: readonly Pt[];
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface HitIndex {
  /** Tested first: a constriction sits on top of the river it pinches. */
  readonly rects: readonly IndexedRect[];
  readonly polygons: readonly IndexedPolygon[];
}

function bounds(points: readonly Pt[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function lanePolygon(top: readonly Pt[], bottom: readonly Pt[]): Pt[] {
  const points: Pt[] = [];
  for (const p of top) points.push(p);
  for (let i = bottom.length - 1; i >= 0; i -= 1) points.push(bottom[i] as Pt);
  return points;
}

/** Widens a constriction's grab area so a 21px pinch is still clickable. */
const GRAB_PAD_PX = 6;

export function buildHitIndex(scene: Scene): HitIndex {
  const rects: IndexedRect[] = [];
  const polygons: IndexedPolygon[] = [];

  const pushConstriction = (
    id: string,
    label: string,
    kind: HitKind,
    enterX: number,
    exitX: number,
    centreY: number,
    widthBeforePx: number,
    valueUsd: Usd,
    valueText: string,
  ): void => {
    rects.push({
      target: { id, kind, label, valueUsd, valueText },
      minX: enterX - GRAB_PAD_PX,
      maxX: exitX + GRAB_PAD_PX,
      minY: centreY - widthBeforePx / 2 - GRAB_PAD_PX,
      maxY: centreY + widthBeforePx / 2 + GRAB_PAD_PX,
    });
  };

  for (const lane of scene.rivers) {
    for (const c of lane.constrictions) {
      pushConstriction(
        c.id,
        c.label,
        'constriction',
        c.enterX,
        c.exitX,
        c.centreY,
        c.widthBeforePx,
        c.annotation.valueUsd,
        c.annotation.text,
      );
    }
  }
  const tc = scene.trunk.constriction;
  pushConstriction(
    tc.id,
    tc.label,
    'trunk-constriction',
    tc.enterX,
    tc.exitX,
    tc.centreY,
    tc.widthBeforePx,
    tc.annotation.valueUsd,
    tc.annotation.text,
  );

  for (const lane of scene.rivers) {
    const points = lanePolygon(lane.banks.top, lane.banks.bottom);
    polygons.push({
      target: {
        id: lane.id,
        kind: 'river',
        label: lane.label,
        valueUsd: lane.revenueUsd,
        valueText: lane.headText,
      },
      points,
      ...bounds(points),
    });
  }

  const lake = scene.lakeRegion.lake;
  if (lake.outline.length > 0) {
    polygons.push({
      target: {
        id: 'lake',
        kind: 'lake',
        label: `${lake.periodLabel} net earnings`,
        valueUsd: lake.netEarningsUsd,
        valueText: lake.readoutText,
      },
      points: lake.outline,
      ...bounds(lake.outline),
    });
  }

  return { rects, polygons };
}

/** Synchronous, allocation-free, independent of the render loop. */
export function hitTest(index: HitIndex, x: number, y: number): HitTarget | null {
  for (const rect of index.rects) {
    if (x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY) return rect.target;
  }
  for (const poly of index.polygons) {
    if (x < poly.minX || x > poly.maxX || y < poly.minY || y > poly.maxY) continue;
    if (pointInPolygon({ x, y }, poly.points)) return poly.target;
  }
  return null;
}
