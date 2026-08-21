# 0007 — D16: the trunk constriction, so the rivers reach the lake

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     Verifying the first slice's target data surfaced a structural gap that neither the
             invariants nor the status report had caught: the rivers do not reach the lake.

             Segment reporting stops at operating income. Invariant 1 and 3.3 say the lake is net
             earnings, and report §5.2 makes "a lake whose area is set by actual reported net
             income" part of the launch gate. For Microsoft FY2026 those are different numbers:
             segment operating income sums to $155,237M (verified: 83,879 + 56,972 + 14,386, tying
             exactly to the disclosed total), while consolidated net income is $133,700M. The
             $21,537M between them is tax and non-operating items — real, reported, and attributable
             to no individual segment.

             As specified, the visual did not conserve. Something had to carry that gap.

Options:     1. A final shared constriction after the confluence, carrying tax and non-operating
                items.
                Tradeoff: keeps the lake as net earnings and stays fully reported, but introduces a
                visual element the invariants did not describe.
             2. Redefine the lake as consolidated operating income.
                Tradeoff: rivers sum to it exactly and no new element is needed, but it amends both
                Invariant 1 and 3.3, and trades the number a beginner recognises — the bottom line —
                for one they do not.
             3. Allocate tax and non-operating items back across the segments pro rata.
                Tradeoff: every river would run to its own share of net income, but no filer
                discloses segment-level tax, so the split would be Streamline's invention.

Decision:    Option 1. The rivers merge into a trunk; the trunk passes through one final shared
             constriction before the lake. The lake remains consolidated net earnings.

             Option 3 was rejected under Ledger's charter — "if no defensible method exists for a
             cost category, the correct output is not disclosed, not an estimate" — and would have
             put invented geometry into the slice whose entire gate is that no figure is invented.

             The constriction is shared rather than per-segment precisely because the items are
             attributable to no segment; rendering it as a single trunk squeeze states that
             honestly. Where a filer's segment profit does not reconcile to consolidated operating
             income, the unallocated corporate remainder renders here too, explicitly, rather than
             being absorbed silently into the rivers.

Consequence: Invariant 1 and 3.2 amended to describe the trunk and the confluence; 3.3 amended to
             state that the lake encodes consolidated net earnings rather than the sum of segment
             operating income.

             The change strengthens the product rather than patching it: the trunk constriction
             teaches something both audiences want, that $21.5B of Microsoft's operating profit does
             not reach shareholders. It is fully reported, so it costs the slice nothing in
             traceability.

             Cartographer now owns a geometry the prototype has no equivalent of — a confluence and
             a shared constriction — which is new work, not a port from reference/prototype/.

             Opened as a consequence, not blocking the slice: Invariant 2.4 mandates a 0.5%
             reconciliation on revenue but has no profit-side sibling, while this metaphor now
             asserts one. Microsoft is clean. Apple leaves $42.6B unallocated between segment and
             consolidated operating income, and Oracle's segment profit measure excludes stock
             compensation and amortisation so the gap is definitional rather than an error.
             Recorded as D18, to be answered before company two.
