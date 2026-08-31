# 0037 — Water color: the saturation guard is amended, one genuinely blue shared hue

Date:        2026-08-29
Status:      accepted
Decided by:  Angel

Supersedes:  0022's saturation ceiling (and only that clause)
Activates:   the LOOK half of 0033 (the orientation half stays recorded, unbuilt)

Context:     0033 records Angel's verdict on the render: the water "doesn't look like a river
             at all." The palette was derived from photographic measurements (2-10% saturation)
             and is technically defensible and visually inert — 0033 names the tension between
             accurate water and evocative water and notes the brief chose accurate. On
             2026-08-29, while directing the product page build, Angel ruled for evocative:
             real water color inside the app.

             The escalation was put to him with the collision stated plainly: 0022 caps every
             emitted canvas color at 10% HSV saturation, and real river blue sits around
             30-60%. His ruling: "Amend the guard — real water color."

Decision:    The water ramp may be genuinely saturated. Everything else 0022 protects SURVIVES:

             - ONE shared fill for every river. Unchanged.
             - ZERO per-segment variation, no index-keyed appearance. Unchanged.
             - D15 stays OPEN: color as a segment encoding remains undecided, and no
               per-segment hue ships. The one-shared-hue rule is what keeps that door
               closed while the water itself becomes water-colored.
             - The accent remains forbidden on the canvas.
             - The guard tests are UPDATED to enforce the new ceiling, never deleted:
               saturation bound raised for the water family, identical-fill and no-index
               assertions kept verbatim.

             Method constraint, from the reference library's own finding: the LUMINANCE
             structure carries the water read (dark body, bright specular minority), so the
             four ramp steps keep their measured luminances (L≈29/66/104/201) and gain
             chroma. This also preserves the contrast contract by construction: text AA on
             the water body, textDim bed-only.

Consequence: tokens.css / tokens.ts / canvas-tokens.ts get a saturated blue ramp; the guard
             tests get the new ceiling; DESIGN.md gains an OVERRIDES row (the ramp leaves the
             measured 2-10% envelope, superseded values recorded); STREAMLINE-INVARIANTS.md §5
             is amended by Angel's ruling with a §7 log row. Angel tunes the exact values on
             sight, per his standing reservation in DESIGN.md.

Reversible:  yes — the superseded values are recorded in DESIGN.md's OVERRIDES table and this
             record; restoring them is a token change plus reverting the test ceilings.
