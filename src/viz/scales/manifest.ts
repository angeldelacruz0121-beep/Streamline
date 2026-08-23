/**
 * Every scale in this directory is self-describing.
 *
 * Cartographer's mandate: "Each exports its domain, range, and a one-line statement of
 * meaning." A manifest entry makes that mechanical rather than aspirational — a test
 * asserts every exported scale has one, and the on-screen scale indicator renders from
 * these strings rather than from a second copy of the same sentences that can drift.
 */
export interface ScaleManifestEntry {
  /** Stable id, used by the indicator and by tests. */
  readonly id: string;
  /** One line. What a reader is entitled to conclude from this channel. */
  readonly meaning: string;
  /** The financial quantity and its admissible range. */
  readonly domain: string;
  /** The geometric quantity produced. */
  readonly range: string;
  /** The constant, stated so it can be checked by hand against the picture. */
  readonly constant: string;
  /**
   * Every scale here is linear (Invariants 3.1, 3.3). The field exists so that a
   * non-linear scale could not be added without visibly declaring itself, and so the
   * test that forbids one has something to assert on.
   */
  readonly linear: true;
  /** Invariant 3.11. What a reader would wrongly conclude, and what stops them. */
  readonly misreading: {
    readonly wrongConclusion: string;
    readonly defense: string;
  };
}
