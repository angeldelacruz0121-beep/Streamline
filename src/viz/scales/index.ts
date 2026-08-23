/**
 * The scale surface. Everything that turns a financial quantity into a geometric one
 * lives behind this barrel, and every scale in `SCALE_MANIFEST` is linear, fixed, and
 * cross-company stable.
 *
 * Not here, deliberately:
 *   - flow speed (Invariant 3.5) — open decision D9, escalate-only
 *   - any colour scale (section 5, Invariant 3.10) — open decision D15, escalate-only
 *   - any relationship between the width constant and the area constant — open question
 *     Q1, escalate-only, see the seam note in `area.ts` and `encoding/lake.ts`
 */
export type { ScaleManifestEntry } from './manifest';
export * from './units';
export * from './width';
export * from './area';
export * from './depth';
export * from './indicator';
export * from './legibility';

import { AREA_SCALE } from './area';
import { DEPTH_SCALE } from './depth';
import type { ScaleManifestEntry } from './manifest';
import { WIDTH_SCALE } from './width';

/** Every scale Streamline currently ships. The on-screen legend renders from this. */
export const SCALE_MANIFEST: readonly ScaleManifestEntry[] = [WIDTH_SCALE, AREA_SCALE, DEPTH_SCALE];
