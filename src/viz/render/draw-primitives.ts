/**
 * The narrow slice of Canvas 2D the renderer is allowed to touch.
 *
 * `Ctx2D` is a `Pick` of the real context rather than a hand-written interface, so it
 * cannot drift from the browser API and a real `CanvasRenderingContext2D` satisfies it by
 * construction. Every draw module takes `Ctx2D`, which is what makes the whole draw layer
 * testable under jsdom — where there is no canvas implementation at all — against a
 * recording double.
 *
 * No allocation in any of these helpers beyond what the context itself does. They are
 * called on every frame.
 */
import { TONES, css, type Tone } from './placeholders';
import type { Banks, Pt } from './scene';

export type Ctx2D = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'beginPath'
  | 'closePath'
  | 'moveTo'
  | 'lineTo'
  | 'arc'
  | 'rect'
  | 'fill'
  | 'stroke'
  | 'fillRect'
  | 'fillText'
  | 'measureText'
  | 'setTransform'
  | 'clearRect'
  | 'setLineDash'
  | 'clip'
  | 'createLinearGradient'
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineJoin'
  | 'lineCap'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'globalAlpha'
>;

/** Trace the closed silhouette of a flow: top bank forward, bottom bank back. */
export function traceBanks(ctx: Ctx2D, banks: Banks): void {
  const { top, bottom } = banks;
  if (top.length === 0) return;
  ctx.beginPath();
  const first = top[0] as Pt;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < top.length; i += 1) {
    const p = top[i] as Pt;
    ctx.lineTo(p.x, p.y);
  }
  for (let i = bottom.length - 1; i >= 0; i -= 1) {
    const p = bottom[i] as Pt;
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

export function tracePolygon(ctx: Ctx2D, points: readonly Pt[]): void {
  if (points.length === 0) return;
  ctx.beginPath();
  const first = points[0] as Pt;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i] as Pt;
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/**
 * The water body's shared depth treatment (decision 0037): bank sheen at the edges,
 * deeper tone in the middle. One gradient SHAPE for every flow — river, trunk and
 * lake all call this with their own cross-axis extent, and the stop list is a
 * constant, so no per-segment variation can ride in on it. The luminance range this
 * spends is the reference library's own prescription for water that reads as water
 * instead of as a flat shape.
 */
const waterGradients = new Map<string, CanvasGradient>();

export function waterFill(ctx: Ctx2D, crossTop: number, crossBottom: number): void {
  // Memoized per extent: a flow's cross extent changes only on relayout, and the perf
  // regression gate caught the cost of not caching — ten fresh gradient objects per frame
  // showed up as allocation churn (a 33ms outlier frame and a heap creep). The map is
  // tiny (one entry per flow extent) and cleared when a relayout floods it with new keys.
  const key = `${crossTop}|${crossBottom}`;
  let gradient = waterGradients.get(key);
  if (gradient === undefined) {
    if (waterGradients.size > 64) waterGradients.clear();
    gradient = ctx.createLinearGradient(0, crossTop, 0, crossBottom);
    gradient.addColorStop(0, css(TONES.waterEdgeSheen));
    gradient.addColorStop(0.5, css(TONES.water));
    gradient.addColorStop(1, css(TONES.waterEdgeSheen));
    waterGradients.set(key, gradient);
  }
  ctx.fillStyle = gradient;
  ctx.fill();
}

export function fillWith(ctx: Ctx2D, tone: Tone): void {
  ctx.fillStyle = css(tone);
  ctx.fill();
}

export function strokeWith(ctx: Ctx2D, tone: Tone, widthPx = 1): void {
  ctx.strokeStyle = css(tone);
  ctx.lineWidth = widthPx;
  ctx.stroke();
}

export interface TextOptions {
  readonly font: string;
  readonly tone: Tone;
  readonly align?: CanvasTextAlign;
  readonly baseline?: CanvasTextBaseline;
}

export function text(ctx: Ctx2D, value: string, at: Pt, options: TextOptions): void {
  ctx.font = options.font;
  ctx.fillStyle = css(options.tone);
  ctx.textAlign = options.align ?? 'left';
  ctx.textBaseline = options.baseline ?? 'alphabetic';
  ctx.fillText(value, at.x, at.y);
}

/** A hairline from a figure to the geometry it dimensions. */
export function leader(ctx: Ctx2D, from: Pt, to: Pt, tone: Tone): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  strokeWith(ctx, tone, 1);
}

export function line(ctx: Ctx2D, from: Pt, to: Pt, tone: Tone, widthPx = 1): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  strokeWith(ctx, tone, widthPx);
}
