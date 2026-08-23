# 0022 — D15: Guard widened to one shared fill, saturation ≤10%, zero per-segment variation

Date:        2026-08-21
Status:      accepted
Decided by:  Angel

Context:     The original D15 strict reading required R=G=B across all water-ramp fills — one
             channel to drive all three. This was intended to ensure no color-encoding sneaks in
             during segment fill assignment.

             During implementation, a neighboring identical-fill test arose: when two segments
             share the operating income and produce zero width (or minimal width), they should
             visually merge. The strict R=G=B rule created friction with this test, since
             identical adjacent fills need saturation precision that the strict rule did not allow.

             **Invariant 3.2 note:** The sum-conservation reading of residual width has been
             settled. The observation "removed width + unrepresented width = widthPx(residual)"
             is a reading of the existing Invariant 3.2, not an amendment to it. This satisfies
             3.2 and unblocked the loss-filer fix (Data Visualization Engineer confirmed
             composeCanvas is now total). No change to the invariant itself is needed.

Options:     1. Keep strict R=G=B, accept the visual discontinuity in zero-width merges.
             2. Relax the rule to permit saturation variance, opening the door to color-encoding
                creep.
             3. Widen the guard to specify one shared fill, saturation ≤10%, and zero per-segment
                variation. The neighboring identical-fill test becomes the real D15 guard.

Decision:    Option 3. The guard is now: one shared fill (all segments use the same fill value),
             saturation ≤10% (desaturated enough that no quantity can be visually confused with
             segment hue when color encoding is added later), and zero per-segment variation
             (no fills are tuned per-segment or per-company). This protects the invariant
             (no hidden color encoding) while allowing the identical-fill test to work correctly.

             The neighbouring identical-fill test is the real enforcement mechanism: if adjacent
             segment fills are identical, they visually merge; if they diverge, the divergence
             comes from width or other non-fill encodings, never from fill tuning.

Consequence: Water ramp values are provisional inside the measured envelope (from /taste
             reference data), with Angel tuning on sight. The method is protected: one shared
             fill, saturation check enforced, per-segment variation forbidden in code review.
             This opens the door to adding color as a segment encoding later (D15 opened) without
             rewriting the fill logic.