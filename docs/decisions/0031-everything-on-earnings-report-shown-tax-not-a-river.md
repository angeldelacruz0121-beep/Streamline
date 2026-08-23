# 0031 — Everything on the earnings report is shown; tax is not a river

Date:        2026-08-23
Status:      accepted in principle, unbuilt
Decided by:  Angel

Context:     How should tax and non-operating items be presented in the rendering? What is the
             scope of items that appear on the earnings report?

Decision:    Everything that appears on the actual earnings report should be displayed. But tax is
             not a flow of income, so it should NOT be drawn as a river. It needs its own
             treatment.

             Angel's statement: "some sort of feature where it says taxes and everything
             tax-related pops up on that."

Consequence: This bears on open question Q4 (docs/decisions/0020, whether the trunk shows one net
             pinch or decomposes). It does not fully answer Q4 — Q4 asks about the trunk
             constriction specifically — but it states Angel's direction: tax gets its own
             surface rather than being folded silently into a pinch.

             Nothing built. Interface work is deferred by Angel's instruction. The decision
             constrains the direction taken when the tax treatment is eventually designed.
