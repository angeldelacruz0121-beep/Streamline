# 0017 — Q1: What pins the width constant against the area constant at the junction?

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     The river width constant is px per dollar of revenue or cost (Invariant 3.1). The
             lake area constant is px² per dollar of net earnings (D13 answer, 0006).

             These are incommensurable units: px/$ and px²/$ do not relate without a scaling
             rule. The trunk arrives at the lake with a width (the constant applied to residual
             dollars), and the lake needs an incoming "mouth" width. No invariant, no decision,
             and no encoding currently specifies how the trunk's width relates to the lake's shape
             and position.

             Data Visualization Engineer flagged this as an explicit unresolved value rather than guessing a
             plausible default. Blocking the junction geometry only — everything else in the
             slice is built and tested.

The quantity: Microsoft keeps $133,749M of $331,839M in revenue. Net margin = 40.31%. That is
             the single most valuable thing the picture could teach a beginner and the number they
             will try hardest to read off the trunk-to-lake junction. Right now no encoding is
             accountable for it being read correctly.

Options:     (Three considered; see docs/product/open-questions.md §Q1 for full detail)

             1. Explicitly refuse the comparison. The lake is a labeled readout, not a
                continuation of the flow, and is separated in layout so the conservation read is
                never invited.
             2. Pin by a stated identity — e.g., the lake's mouth width equals the trunk's
                arriving width. Fails dimensionally: with a fixed lake shape, area would then
                grow as the square of net earnings, breaking D13.
             3. Amend D13 along the line 0006 parked: every company gets a revenue-sized basin on
                one area constant, the lake fills part of it, and fill fraction reads as margin.
                Both the referent and the quantity become areas, so the comparison is defined.

Decision:    Option 1. The lake is a labeled readout, not a continuation of the flow. Spatially
             separated in layout so the conservation read is never invited. Implemented and shipped
             in the vertical slice.

Consequence: The junction geometry is complete and tested. Option 3 remains the in-principle
             post-slice target: every company gets a revenue-sized basin on one area constant,
             the lake fills part of it, and fill fraction reads as margin. That amendment is
             deferred to the second company (Apple). The 40.31% net margin is encoded in the
             lake geometry and labeling, not in the flow continuity.
