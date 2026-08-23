# 0027 — Ambient-video idea for empty state, parked with full specification

Date:        2026-08-21
Status:      parked
Decided by:  Angel

Context:     Angel's concept: when the app is idle (no company selected, first-run state), the
             background could show a slow, ambient video — geometric shapes or financial data
             flowing gently, no readable text, seamless loop, muted. This creates a sense of
             motion and professionalism without distraction.

             The concept is valuable but must wait until Q3 (first-run experience) is specified
             and tested. It is blocked by D10 (SIC ranges as a proxy for "tech") and D12
             (default period), which inform the empty-state information architecture.

Decision:    Park the ambient-video idea. Do not build it yet. Record the full specification so
             it survives the session and can be retrieved when D10 and D12 are answered.

             **Full specification when built:**
             - **Where it fits:** Idle state only. Never during company viewing, never near the
               canvas. Invariants 3.6 and 3.11 protect the canvas from visual clutter.
             - **Visual spec:** Near rgb(18,19,29) (very dark, almost black), very slow motion
               (no sense of urgency), no readable objects or text, seamless loop, muted audio
               (if any), duration 8–15 seconds.
             - **No-asset alternative:** If video assets are not available or too heavy, the
               first-load experience can use a draw-in animation of real company geometry
               (rivers flowing in, lake forming) instead of ambient shapes.
             - **Build sequence:**
               1. D10 and D12 answered (SIC ranges, default period)
               2. Q3 first-run spec written and tested with two audiences
               3. Product Analyst approves two-audience test result
               4. Build the ambient video (Art Director) or no-asset fallback

Consequence: The idea is preserved and unblocked only by Q3, which itself is unblocked by D10
             and D12. It is not a critical path item for the vertical slice or the second company.
             When Q3 lands and Product Analyst approves the first-run experience, this
             specification becomes actionable.