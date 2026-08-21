# 0003 — Quality outranks framerate above a locked floor

Date:        2026-08-20
Status:      accepted (supersedes the degradation order in 0000-era Invariant 4.1)
Decided by:  Angel

Context:     Invariant 4.1 was twice wrong in the same day. It first read "60fps sustained," which
             an average can satisfy while still hitching. It was then rewritten to a percentile
             standard that hardened an illustrative "50fps" into a benchmark and kept the original
             degradation order — particle density reduced first, framerate protected. Angel
             corrected both: 50fps was an example, not a number, and the underlying preference is
             the opposite of what was written. He would accept a lower framerate to buy a cleaner,
             more polished picture, provided the choppiness is not noticeable and the app does not
             feel slow.

             That statement contains two distinct constraints that the invariant was collapsing
             into one metric: perceived smoothness (frame pacing and a rate floor) and perceived
             speed (input responsiveness). They fail independently — a locked 30fps render still
             feels immediate if input is not gated on the frame, and a 60fps render feels broken
             if it is.

Options:     1. Rate wins — hold 60fps, thin the visuals to get there. The existing rule.
                Tradeoff: protects responsiveness on weak hardware, but ships a visibly thinner
                product on exactly the machines most users have. Contradicts Angel's stated
                preference.
             2. Quality wins — lock to a lower clean divisor and keep render quality.
                Tradeoff: less headroom for hitches, and requires input handling to be genuinely
                decoupled from the render loop or the app will feel slow at 30fps.
             3. Per-feature escalation — no standing rule; Forge escalates each costly effect.
                Tradeoff: maximum control, but Forge stalls on every expensive visual and Angel
                answers the same question repeatedly.

Decision:    Option 2, with an explicit floor. Framerate is a floor to defend, not a target to
             maximize. Preferred locked rate 60fps, floor 30fps, always a clean divisor of display
             refresh — never floating, since uneven pacing reads worse than a lower steady rate.
             Degradation steps the locked rate down first and keeps render quality (AA, blur and
             bloom quality, particle density, DPR); visual density is reduced only when the 30fps
             floor cannot hold. Geometry accuracy is not on the ladder at any level.

             Interaction responsiveness is split out as its own standard: hover and click feedback
             under 100ms, measured independently of render rate, with any interaction gated behind
             the render loop a hard fail.

             Forge is explicitly instructed not to bank framerate above the floor. Headroom belongs
             to the picture; comfortable 60fps with a picture that could be richer is a finding to
             report, not a result to protect.

Consequence: Forge's harness must measure two things, not one, and must express pacing against the
             locked interval rather than a target FPS. Input handling has to be architecturally
             decoupled from the render loop — this is now a correctness requirement, not an
             optimization, and Keel's state model has to accommodate it.

             The 30fps floor is assumed, not measured. It is defensible for continuous fluid
             motion, which is what Streamline renders, but it has not been validated on the
             reference machine. If Forge's harness shows 30 reads as choppy for this specific
             motion, that is a finding that reopens this record rather than something Forge
             works around.

             Forecloses "we hit 60, ship it" as a performance argument. Also forecloses average
             FPS as a reportable metric anywhere in the project.
