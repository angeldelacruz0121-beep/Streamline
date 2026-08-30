/**
 * A recording Canvas 2D double.
 *
 * jsdom implements no canvas at all, so `getContext('2d')` returns null there. Rather
 * than add a native canvas dependency — which would be a §3 escalation for a test
 * convenience — the draw layer is written against `Ctx2D`, a `Pick` of the real context,
 * and this double records every call against it.
 *
 * That turns out to be a better test than pixels would be. "Geometry is identical across
 * every degradation level" is a claim about coordinates, and comparing coordinates
 * directly says so; comparing rendered images would say it only indirectly and would
 * break on an antialiasing change that means nothing.
 *
 * Not a test file — Vitest collects `*.test.ts` only. Same precedent as
 * `src/data/sec/testing/edgar-double.ts`.
 */
import type { Ctx2D } from '../draw-primitives';

export interface RecordedCall {
  readonly op: string;
  readonly args: readonly (number | string)[];
  /** Fill style in force when the call was made. */
  readonly fillStyle: string;
  readonly strokeStyle: string;
  readonly lineWidth: number;
  readonly font: string;
}

export class RecordingContext {
  readonly calls: RecordedCall[] = [];
  fillStyle: string | CanvasGradient | CanvasPattern = '#000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000';
  lineWidth = 1;
  lineJoin: CanvasLineJoin = 'miter';
  lineCap: CanvasLineCap = 'butt';
  font = '10px sans-serif';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  globalAlpha = 1;

  /**
   * The gradient double. Two deliberate choices keep the guards honest:
   * `toString()` lists STOPS ONLY — no coordinates — so two flows with the same
   * treatment but different geometry record the identical fill string and the
   * one-shared-fill guard keeps meaning "same treatment"; and `colours()` below
   * explodes the stop list so the saturation and hue bounds see every stop
   * colour instead of an opaque "[object CanvasGradient]".
   */
  createLinearGradient(_x0: number, _y0: number, _x1: number, _y1: number): CanvasGradient {
    const stops: string[] = [];
    const gradient = {
      addColorStop(offset: number, color: string): void {
        stops.push(`${offset}:${color}`);
      },
      toString(): string {
        return `linear-gradient(${stops.join('|')})`;
      },
    };
    return gradient as unknown as CanvasGradient;
  }

  private record(op: string, ...args: (number | string)[]): void {
    this.calls.push({
      op,
      args,
      fillStyle: String(this.fillStyle),
      strokeStyle: String(this.strokeStyle),
      lineWidth: this.lineWidth,
      font: this.font,
    });
  }

  save(): void {
    this.record('save');
  }
  restore(): void {
    this.record('restore');
  }
  beginPath(): void {
    this.record('beginPath');
  }
  closePath(): void {
    this.record('closePath');
  }
  moveTo(x: number, y: number): void {
    this.record('moveTo', x, y);
  }
  lineTo(x: number, y: number): void {
    this.record('lineTo', x, y);
  }
  arc(x: number, y: number, r: number, a: number, b: number): void {
    this.record('arc', x, y, r, a, b);
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.record('rect', x, y, w, h);
  }
  fill(): void {
    this.record('fill');
  }
  stroke(): void {
    this.record('stroke');
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.record('fillRect', x, y, w, h);
  }
  fillText(value: string, x: number, y: number): void {
    this.record('fillText', value, x, y);
  }
  measureText(value: string): TextMetrics {
    // Deterministic 6px-per-character metric. Word wrap must be reproducible in a test.
    return { width: value.length * 6 } as TextMetrics;
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.record('setTransform', a, b, c, d, e, f);
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    this.record('clearRect', x, y, w, h);
  }
  setLineDash(segments: number[]): void {
    this.record('setLineDash', segments.join(','));
  }
  clip(): void {
    this.record('clip');
  }

  as(): Ctx2D {
    return this as unknown as Ctx2D;
  }

  texts(): string[] {
    return this.calls.filter((call) => call.op === 'fillText').map((call) => String(call.args[0]));
  }

  ops(name: string): RecordedCall[] {
    return this.calls.filter((call) => call.op === name);
  }

  /**
   * Every distinct coordinate the draw pass touched, rounded to 1e-6. This is the
   * geometry signature: two renders with the same signature drew the same shapes,
   * whatever they did with fills and strokes on top.
   */
  coordinates(): Set<string> {
    const key = (x: number, y: number): string => `${x.toFixed(6)},${y.toFixed(6)}`;
    const set = new Set<string>();
    for (const call of this.calls) {
      const [a, b] = call.args;
      switch (call.op) {
        case 'moveTo':
        case 'lineTo':
        case 'arc':
        case 'rect':
        case 'fillRect':
          set.add(key(a as number, b as number));
          break;
        case 'fillText':
          set.add(key(call.args[1] as number, call.args[2] as number));
          break;
        default:
          break;
      }
    }
    return set;
  }

  /** Colours actually used. Used to prove no hue reaches the canvas while D15 is open. */
  colours(): Set<string> {
    const set = new Set<string>();
    const add = (style: string): void => {
      if (style.startsWith('linear-gradient(')) {
        // Explode a gradient into its stop colours so per-stop bounds apply.
        for (const match of style.matchAll(/rgba?\([^)]*\)/g)) set.add(match[0]);
      } else {
        set.add(style);
      }
    };
    for (const call of this.calls) {
      add(call.fillStyle);
      add(call.strokeStyle);
    }
    return set;
  }
}

/** Patches `HTMLCanvasElement.prototype.getContext` for a jsdom suite. */
export function stubCanvas(): RecordingContext {
  const recorder = new RecordingContext();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (id: string) => unknown;
  };
  proto.getContext = () => recorder;
  return recorder;
}
