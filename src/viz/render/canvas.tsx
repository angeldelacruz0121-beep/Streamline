/**
 * The mount. A canvas, a synchronous hover overlay, and a scroll container.
 *
 * Keel owns `src/app/`, so this component is exported rather than mounted here; the shell
 * imports it and passes a `CanvasModel`. It takes the model already composed, never raw
 * financial data, which is Invariant 4.3 held at the component boundary: there is no code
 * path by which an unvalidated figure reaches a pixel.
 *
 * WHY THE CONTAINER SCROLLS. Invariant 3.1 forbids a fit-to-viewport multiplier — that is
 * per-company rescaling, and `scales/legibility.ts` says so directly. A filer whose canvas
 * is wider than the viewport is panned, not shrunk. The overflow is also reported as a
 * scene note, so the reader is told rather than left to discover it.
 *
 * The inline styles here are structural only — position, overflow, pointer-events. Colour,
 * type and spacing are Atelier's and are not set here. ATELIER-REPLACE the overlay chrome.
 */
import { useEffect, useRef, type JSX } from 'react';
import type { CanvasModel } from '../encoding';
import { Renderer } from './renderer';
import { watchReducedMotion } from './reduced-motion';
import type { HitTarget } from './hit-test';

export interface StreamlineCanvasProps {
  readonly model: CanvasModel;
  readonly onHover?: (target: HitTarget | null) => void;
  readonly onSelect?: (target: HitTarget | null) => void;
  /** Test and harness hook. Never set in the application. */
  readonly reducedMotion?: boolean;
  readonly onReady?: (renderer: Renderer) => void;
}

export function StreamlineCanvas(props: StreamlineCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const { model, onHover, onSelect, reducedMotion, onReady } = props;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container === null || canvas === null) return;

    const viewport = {
      widthPx: container.clientWidth || 1440,
      heightPx: container.clientHeight || 900,
    };
    const renderer = new Renderer({
      canvas,
      model,
      viewport,
      overlay: overlayRef.current,
      ...(reducedMotion === undefined ? {} : { reducedMotion }),
      ...(onHover === undefined ? {} : { onHover }),
    });
    rendererRef.current = renderer;
    renderer.start();
    onReady?.(renderer);

    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            renderer.resize({
              widthPx: container.clientWidth,
              heightPx: container.clientHeight,
            });
          })
        : null;
    observer?.observe(container);

    const motion = watchReducedMotion((reduced) => {
      renderer.setReducedMotion(reduced);
    });

    // Panning moves the canvas under the pointer. Refreshing the cached origin here, and
    // not inside the pointer handler, is what keeps `getBoundingClientRect` — a forced
    // layout — off the input path entirely. Passive: this must never delay a scroll.
    const onScroll = (): void => {
      renderer.refreshCanvasRect();
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    const onVisibility = (): void => {
      // Thermal and battery discipline: a hidden tab does no work at all. rAF is already
      // throttled by the browser, but stopping outright means a backgrounded Streamline
      // costs nothing and cannot contribute to a thermal event.
      if (document.visibilityState === 'hidden') renderer.stop();
      else renderer.start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      motion.dispose();
      observer?.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [model, reducedMotion, onHover, onReady]);

  return (
    <div
      ref={containerRef}
      data-streamline-canvas=""
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto' }}
      onPointerMove={(event) => {
        // Synchronous. No `requestAnimationFrame`, no `setState`, no await. Invariant 4.1
        // fails a build the moment interaction is gated behind the render loop.
        rendererRef.current?.handlePointer(event.clientX, event.clientY, event.timeStamp);
      }}
      onPointerEnter={() => {
        // One rect read per hover session, not one per move.
        rendererRef.current?.refreshCanvasRect();
      }}
      onPointerLeave={() => {
        rendererRef.current?.handlePointer(-1, -1);
      }}
      onClick={(event) => {
        const target = rendererRef.current?.handlePointer(event.clientX, event.clientY) ?? null;
        onSelect?.(target);
      }}
    >
      <canvas ref={canvasRef} data-streamline-surface="" style={{ display: 'block' }} />
      <div
        ref={overlayRef}
        data-streamline-overlay=""
        data-visible="false"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}
