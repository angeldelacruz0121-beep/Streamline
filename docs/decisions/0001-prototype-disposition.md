# 0001 — Disposition of the pre-governance prototype

Date:        2026-08-20
Status:      accepted
Decided by:  Angel (delegated the call to Claude: "do whatever is best for the project")

Context:     Before STREAMLINE-INVARIANTS.md and AGENT-PROTOCOL.md existed, a throwaway canvas
             prototype was built at the repo root — hardcoded fictional company data, no types,
             no SEC source, flat `src/engine/*.js` layout. Its structure does not match
             AGENT-PROTOCOL.md §2's ownership table, and per §5, "nothing downstream is real
             until Financial Data Analyst and Data Visualization Engineer agree on the shape of a company object and what its
             geometry means." A call was needed on whether to build the real product on top of
             this code, discard it, or something else, before Financial Data Analyst/Data Visualization Engineer could start.

Options:     1. Rebuild in place — keep working in the existing src/, adapt it toward the
                invariants incrementally.
                Tradeoff: forces Financial Data Analyst/Data Visualization Engineer to refactor around fabricated data and a
                no-types codebase instead of defining a clean contract; violates Invariant 4.5
                (no fabricated data in any committed code path) for as long as data.js remains
                live in src/.
             2. Discard entirely — delete the prototype, start src/ from zero.
                Tradeoff: loses real, working solutions to hard problems (arc-length spline
                parameterization, particle pool recycling without visible loop points, an
                accumulation-buffer render approach with a documented 8-bit trail-decay fix)
                that Performance Engineer would otherwise have to re-derive from scratch.
             3. Reference, not foundation — move the prototype out of src/ into a top-level
                reference/ directory outside every path in the ownership table, documented for
                selective porting once the real contract exists.
                Tradeoff: some duplicate effort re-deriving the data/type layer around it, but
                keeps the hard geometric work available without letting stale, invariant-
                violating code block or bias Financial Data Analyst/Data Visualization Engineer's clean-slate definition.

Decision:    Option 3. Moved to `reference/prototype/`, full git history preserved via `git mv`
             (tracked as renames, not deletions+additions). `reference/prototype/README.md`
             names exactly which modules are worth porting (spline.js, flow.js's width/pinch/
             speed shape, particles.js's pool-sizing and recycling approach, render.js's
             accumulation-buffer technique) and why the rest is not salvageable as-is
             (fabricated data, static-ellipse lake with no area encoding, no drained-basin or
             growth-speed paths).

Consequence: `src/` starts empty. Financial Data Analyst's first task can define `src/data/model/` without any
             existing code to work around. Data Visualization Engineer's first task can define
             `src/viz/scales/` and is free to port spline.js/flow.js's mechanics once the real
             data contract exists, but is not obligated to — nothing in reference/ is binding.
             This forecloses "adapt the prototype incrementally" as a path; if that turns out to
             be wanted after all, it requires a new decision record, not a quiet reversal.
