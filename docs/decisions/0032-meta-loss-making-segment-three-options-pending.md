# 0032 — Meta's loss-making segment: three options on the table, Angel researching

Date:        2026-08-23
Status:      PENDING — Angel is researching before ruling
Escalated by: Data Visualization Engineer

THE PROBLEM
-----------

Meta Platforms FY2025. Family of Apps earned $198,759M revenue and $102,469M operating income.
Reality Labs earned $2,207M revenue against $21,400M of disclosed costs, an operating loss of
$19,193M. Every figure is reported, tagged and verified twice against EDGAR — this is not a data
defect.

Two shapes have no defined geometry:
1. A constriction 9.7× wider than the river it cuts
2. A river ending below zero while the lake is positive

Invariant 3.4 and decision 0006 cover a negative CONSOLIDATED result (the drained basin); nothing
covers one segment being negative inside a profitable company.

TODAY'S BEHAVIOUR
-----------------

composeRiver raises `segment-operating-loss` and composeCanvas returns blocked for the WHOLE
FILER — Family of Apps, the trunk and the lake are all withheld because one river cannot be
drawn. Note the data layer returns the segments fine; it is the drawing layer that refuses.

THE KEY FINDING
----------------

The two undefined shapes are ONE number. Because river reconciliation runs at zero tolerance, the
amount by which a cost claim exceeds its river is identically the magnitude of that segment's
operating loss:

    21,400 − 2,207 = 19,193 = |−19,193|

One mechanism answers both questions.

OPTIONS
-------

**OPTION A** (the Viz Engineer's recommendation): close Reality Labs' river at the point its width
runs out (0024's terminus precedent), and carry the 19.193px the claim could not take as a
separate labelled constriction on the merged flow immediately after the confluence. Conservation
stays visible and exact on one constant.

What a reader concludes: "Family of Apps earned $102B, $19B of it covered Reality Labs, $83B
continued, $23B went to tax, $60B was kept."

Misreads to defend:
- Double-counting the two annotations ($21,400M and $19,193M)
- Reading the closed river as "Reality Labs was shut down"
- The weakest one — the loss pinch (19.193px) and the tax pinch (22.818px) are adjacent and
  similar in size, so a beginner may read the loss as a company-wide item like tax.

**OPTION B**: divert the shortfall into a second, segment-scale basin on the area constant. Most
metaphor-faithful, but puts two water bodies on one canvas encoding DIFFERENT financial measures
(segment operating income vs consolidated net earnings) at comparable sizes, inviting a
comparison that is not meaningful. Also re-opens Q1, since a second water body means a second
instance of the unpinned width-to-area relationship.

**OPTION C**: decline to draw the losing segment — today's behaviour. Adds no geometry and no
invariant clause, but a loss-making segment inside a profitable filer is normal in technology
(Reality Labs, Other Bets, Intel Foundry), so this declines a large share of the sector.

INVARIANT QUESTION
-------------------

The Viz Engineer judged that Invariant 3.4 should NOT be amended — every noun in it is
consolidated, and stretching it would drag segment losses onto the area channel by inheritance.
It proposed instead a new clause under 3.2, provisionally "A claim wider than its flow":

    A constriction never removes more width than arrives; the width channel saturates at the
    arriving width; the unrepresented part is stated in dollars and carried by an explicitly
    drawn element on the same constant; removed + unrepresented = widthPx(claim).

Plus one scope sentence in 3.4 stating that 3.4 governs the consolidated result and a negative
segment result is a 3.2 case. Both are shared-file edits for Angel to apply.

TWO RIDERS on Option A
-----------------------

The Viz Engineer says these are Angel's, not its own:

**(R1)** Reality Labs renders as a 2.207px hairline, far below the 12px river legibility floor —
confirm Angel accepts a segment carried almost entirely by its label.

**(R2)** The loss pinch and tax pinch are adjacent and close in size, and with colour unavailable
under 3.10/D15 the treatment-only distinction is the thinnest part of the proposal.

Awaiting: Angel's decision on which option, and confirmation of the two riders if Option A is
chosen.
