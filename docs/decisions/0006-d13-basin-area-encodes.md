# 0006 — D13: the basin's plan area carries the loss

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     D13 asked whether the drained basin's depth uses the lake's area scale or its own. The
             working default was "own scale, documented."

             The question as posed is dimensionally ill-formed. Invariant 3.3 fixes an area constant
             in px²/$; 3.4 requires depth linear in dollars, a constant in px/$. Their ratio has
             units of pixels, so relating them requires a reference length that carries no financial
             meaning. Every "same scale" proposal is really "own scale with the constant pinned by
             some rule," and the real question is which rule — and whether the basin's plan area
             should encode at all.

             Two further findings shaped the answer. First, a fixed-footprint basin makes the loss
             encoding overwhelm the profit encoding at small magnitudes: at a common scale a −$100M
             basin renders roughly 1,137× the plan area of a +$100M lake, so a marginally
             unprofitable company visually dominates a marginally profitable one purely from a
             constant. Second, area and length are perceived through different psychophysical
             exponents — roughly 0.7 for area against 1.0 for length — so any cross-sign
             calibration holds at exactly one magnitude and degrades in both directions, with a bias
             that overstates large losses. No choice of depth constant repairs this; the mismatch is
             in the exponents.

Options:     1. Fixed footprint, depth derived from the area constant through the footprint width
                and camera elevation.
                Tradeoff: formally single-scale and needs no amendment, but welds the financial
                scale to the camera angle — any camera change silently rescales losses — and still
                inherits the small-loss dominance problem.
             2. Own independent depth scale with its own indicator — the working default.
                Tradeoff: preserves loss-versus-loss comparison, but the constant is free, chosen
                because it looks right, which is what 3.1 and 3.6 exist to forbid. Two indicators
                side by side invite a cross-sign ratio that is arbitrary by construction.
             3. Basin plan area encodes on 3.3's area constant; depth stays linear but becomes a
                redundant channel.
                Tradeoff: dimensionally consistent and continuous through zero, but requires
                clarifying 3.4's shoreline clause, and equal magnitudes of either sign now produce
                equally sized shapes, so sign must be carried by other cues.

Decision:    Option 3. A −$10B basin and a +$10B lake occupy the same footprint and are read through
             the same perceptual channel. Depth remains linearly proportional to loss magnitude per
             3.4's letter, but reinforces the number rather than carrying it. No volumetric shading
             cue is permitted, since volume would grow as the square of the magnitude and over-read
             large losses.

             Invariant 3.4's "the shoreline stays in place" is clarified as a fixed reference
             plane, not a fixed size. That is the reading its own stated rationale supports — the
             sentence exists so a loss-maker stays comparable to a profit-maker at the same zoom,
             and a constant footprint defeats that comparability rather than serving it.

             Sign must be carried unmistakably by dry floor, rim treatment and label, and per 3.10
             never by color alone.

Consequence: A misreading no option escaped is now defended explicitly in 3.4: a permanent-looking
             hole in the ground invites "this company is $10B in the hole," a balance-sheet reading
             of what is one period's flow. The period is labeled on the rim, and changing the period
             must visibly re-fill or re-drain the basin so the state reads as belonging to that
             period.

             This decision constrains Cartographer's lake work even though the first slice cannot
             exercise it — Microsoft is profitable. The area constant must be defined once, for both
             signs, rather than settled for profit and retrofitted for loss.

             Noted for later, not decided: a more metaphor-faithful option exists in which every
             company gets a revenue-sized basin on the same constant, the lake fills part of it so
             fill fraction reads as margin, and a loss is a dry basin sunk below grade. It amends
             3.3 as well as 3.4 and is far larger than D13. Recorded here so it is not lost.
