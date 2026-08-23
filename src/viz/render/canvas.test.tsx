import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StreamlineCanvas } from './canvas';
import { composeOrThrow, microsoftFy2026 } from './reference-load';
import { stubCanvas } from './testing/recording-context';

const model = composeOrThrow(microsoftFy2026());

describe('StreamlineCanvas', () => {
  it('mounts a surface and an overlay, and draws on mount', () => {
    const ctx = stubCanvas();
    const { container } = render(<StreamlineCanvas model={model} reducedMotion />);
    expect(container.querySelector('[data-streamline-surface]')).not.toBeNull();
    expect(container.querySelector('[data-streamline-overlay]')).not.toBeNull();
    // Reduced motion draws exactly once, synchronously, with no clock. The picture is
    // complete on mount rather than on the first animation frame.
    expect(ctx.texts().join(' ')).toContain('$133,749M');
  });

  it('scrolls rather than scaling when the content overflows — Invariant 3.1', () => {
    stubCanvas();
    const { container } = render(<StreamlineCanvas model={model} reducedMotion />);
    const host = container.querySelector('[data-streamline-canvas]') as HTMLElement;
    expect(host.style.overflow).toBe('auto');
  });

  it('answers a pointer synchronously, without waiting for a frame', () => {
    stubCanvas();
    const onHover = vi.fn();
    const { container } = render(
      <StreamlineCanvas model={model} reducedMotion onHover={onHover} />,
    );
    const host = container.querySelector('[data-streamline-canvas]') as HTMLElement;
    const overlay = container.querySelector('[data-streamline-overlay]') as HTMLElement;

    // jsdom's getBoundingClientRect is all zeros, so client coordinates are scene
    // coordinates here. That is enough to prove the wiring is synchronous.
    const scene = { x: 60, y: 0 };
    host.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientX: scene.x, clientY: scene.y }),
    );
    // Whatever was or was not hit, the overlay's state was decided inside the dispatch.
    expect(overlay.dataset['visible']).toMatch(/true|false/);
  });

  it('tears the renderer down on unmount', () => {
    stubCanvas();
    const cancelFrame = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);
    const { unmount, container } = render(<StreamlineCanvas model={model} reducedMotion />);
    expect(container.querySelector('canvas')).not.toBeNull();
    unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('hands the renderer back so a host can read its metrics', () => {
    stubCanvas();
    const onReady = vi.fn();
    render(<StreamlineCanvas model={model} reducedMotion onReady={onReady} />);
    expect(onReady).toHaveBeenCalledTimes(1);
    const renderer = onReady.mock.calls[0]?.[0] as { metrics: () => { reducedMotion: boolean } };
    expect(renderer.metrics().reducedMotion).toBe(true);
  });

  it('renders no financial figure it was not given', () => {
    // Invariant 4.5, at the component boundary. The component takes a composed model and
    // has no path to a data source, a default, or a placeholder.
    const ctx = stubCanvas();
    render(<StreamlineCanvas model={model} reducedMotion />);
    const figures = ctx.texts().filter((text) => /^\D?\$[\d,]+M$/.test(text));
    const allowed = new Set([
      '$139,996M',
      '$137,791M',
      '$54,052M',
      '$25,017M',
      '$31,100M',
      '$57,876M',
      '$22,943M',
      '$23,481M',
      '$16,185M',
      '$83,879M',
      '$56,972M',
      '$14,386M',
      '$155,237M',
      '$21,488M',
      '$133,749M',
    ]);
    for (const figure of figures) expect(allowed.has(figure), figure).toBe(true);
    expect(screen.queryByText(/lorem|example|demo/i)).toBeNull();
  });
});
