/**
 * The renderer's public surface.
 *
 * `reference-load.ts` is deliberately absent. It holds Microsoft's real FY2026 figures for
 * the performance harness, and although nothing in it is invented (Invariant 4.5), a perf
 * fixture has no business being reachable from the application shell. `no-encoding-leak.test.ts`
 * asserts this file never re-exports it.
 */
export * from './scene';
export * from './layout';
export * from './silhouette';
export * from './format';
export * from './placeholders';
export * from './draw-primitives';
export * from './draw-river';
export * from './draw-trunk';
export * from './draw-junction-seam';
export * from './draw-scene';
export * from './hit-test';
export * from './degradation';
export * from './rate-lock';
export * from './reduced-motion';
export * from './renderer';
export { StreamlineCanvas, type StreamlineCanvasProps } from './canvas';
