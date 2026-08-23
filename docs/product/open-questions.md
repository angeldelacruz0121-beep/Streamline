# Open product questions

Questions this directory cannot answer alone. Angel's queue. Each names precisely what is blocked
and what proceeds regardless — nothing here stops all work.

Questions on the Invariants §6 open-decisions table (D9–D18) are not duplicated here. This file
holds product questions raised by the two-audience tests that the table does not cover.

---

## Q1 — What pins the width constant against the area constant?

**Status:** escalation, raised 2026-08-20 by test record 0001. Blocking the trunk-to-lake junction
geometry only.

    ESCALATION — Product Analyst
    Decision:  What rule fixes the lake's size relative to the arriving trunk's width, given that
               river width is px/$ and lake area is px²/$ and no invariant relates them?
    Options:   1. Explicitly refuse the comparison. The lake is a labeled readout, not a
                  continuation of the flow, and is separated in layout so the conservation read is
                  never invited. Honest and cheap; costs the metaphor its ending.
               2. Pin by a stated identity — e.g. the lake's mouth width equals the trunk's arriving
                  width. Fails dimensionally: with a fixed lake shape, area would then grow as the
                  square of net earnings, breaking 3.3. Recorded because it is the obvious proposal
                  and it does not work.
               3. Amend 3.3 along the line 0006 parked: every company gets a revenue-sized basin on
                  one area constant, the lake fills part of it, and fill fraction reads as margin.
                  Both the referent and the quantity become areas, so the comparison is defined and
                  the beginner's five-second read becomes correct rather than undefended. Largest
                  option; amends 3.3 and 3.4.
    Recommend: Option 3 in principle, option 1 for the vertical slice. Option 3 is the only one that
               makes the read a beginner will attempt anyway a true read, but it is an invariant
               amendment and larger than this milestone. Option 1 costs nothing now and forecloses
               nothing later.
    Impact:    Blocked: the geometry where the trunk meets the lake, and any claim that the picture
               conserves visually. Not blocked: the area constant itself (D13 is answered), the
               scale indicator, the rivers, the constrictions, the trunk constriction, and every
               provenance path. Data Visualization Engineer can build everything except the junction.

**The quantity at stake, from the tagged facts.** Microsoft keeps $133,749M of $331,839M in revenue
— a net margin of **40.31%**. That is the single most valuable thing this picture could teach a
beginner and the number they will try hardest to read off the trunk-to-lake junction. Right now no
encoding is accountable for it being read correctly, because the junction relating a px/$ channel to
a px²/$ channel is unpinned. Option 3 is the only one of the three that makes 40.31% a quantity the
picture states rather than one it accidentally implies.

**Why this is not a re-litigation of D13.** D13 answered what area encodes and settled the basin
against the lake. Q1 asks what relates *area* to *width* — a different pair, unaddressed by any
invariant, and the same dimensional argument 0006 used to dissolve the depth question.

---

## Q2 — What does the trunk do when the residual is positive?

**Status:** open, raised by test record 0002. Not blocking; Microsoft cannot exercise it.

Consolidated net income can exceed segment operating income — large interest income against a low
tax charge, an equity-method gain, an unallocated corporate credit. The trunk would need to *widen*.
"Constriction" has no widening behavior, and the beginner's five-second read of a river that gets
fatter with no tributary is "where did that water come from."

**Nearer than it looked.** Microsoft's residual is net negative, so the slice does not exercise this
at the net level. But the corrected extraction shows the *components* already carry opposite signs
in the very first filer: non-operating income **+10,697** against income taxes **−32,185**. Any
answer to Q4 that decomposes the trunk exercises the widening case immediately, on company one.

Needed before company two, alongside D18. Recorded so Data Visualization Engineer does not discover it mid-build.

---

## Q4 — Is one net trunk pinch an honest rendering of two opposite-signed components?

**Status:** escalation, raised 2026-08-20 by test record 0002 Misread D, after the real tagged facts
arrived. Blocking nothing yet; C3 is the minimum defense and is binding either way.

    ESCALATION — Product Analyst
    Decision:  Microsoft's $21,488M trunk residual is a net of +10,697 non-operating income and
               −32,185 income taxes. Drawn as one 13.84% pinch, the picture states that tax cost
               Microsoft $21.5B when it cost $32.2B. Does the trunk render net, or decomposed?
    Options:   1. Net pinch, itemized in the detail panel only (C3). Cheapest, matches D16's letter,
                  leaves the beginner with an understated tax figure they cannot detect.
               2. Decomposed: the trunk widens by the non-operating gain, then narrows by the tax.
                  Both quantities become true on the width channel and $32,185M takes its real rank
                  — second largest constriction in the picture, ahead of every disclosed operating
                  expense. Costs a widening behavior the encoding does not have (Q2), and a beginner
                  seeing a river gain water asks where it came from.
               3. Net pinch with the tax component annotated at the constriction rather than only in
                  the panel. Middle cost; states the number without inventing geometry, but puts two
                  different magnitudes at one visual element.
    Recommend: Option 3 for the slice, option 2 evaluated at company two. Option 2 is the honest
               encoding and I would not argue against it on principle; it drags in the widening case
               and should not be the thing that delays the first real render.
    Impact:    Blocked: nothing. C3 proceeds regardless. What is at stake is whether the picture's
               single largest hidden quantity stays hidden.

**This does not reopen D16.** D16 decided the residual is carried after the confluence as a shared
constriction rather than allocated to segments or absorbed into the lake's definition. Whether that
constriction draws net or decomposed sits underneath that answer, was not before Angel when D16 was
taken, and could not have been — it is only visible once the tagged components are in hand.

---

## Q3 — First-run experience is unwritten, and partly blocked

**Status:** Product Analyst's definition of done is unmet on this item. Raised 2026-08-20.

What a user sees before choosing a company is nobody else's job, and it is not yet specified. Two
open decisions sit directly in it:

- **D10** — SIC 3570–3579 / 7370–7379 as a proxy for "tech." First-run has to state the coverage
  limit without it reading as a defect, and the honest phrasing depends on whether the boundary is
  described as a sector or as an SIC range. These produce materially different copy.
- **D12** — default period on load. First-run shows a period before the user picks one.

**What is not blocked and can be written without either:** the empty state's information
architecture, the company-selection affordance, what the product says it does *not* do, and the
scale-indicator legend a first-time viewer meets before any company loads.

Per protocol §3 no default is guessed here. Flagging rather than proceeding.

---

**2026-08-20 — amended.** Q1 gained the net-margin figure and Q2 the opposite-signed-components
finding, both from Financial Data Analyst's WS2 extraction and the corrected net income of $133,749M (decision
0010). Q4 is new and exists only because the real components arrived. No question was closed by the
correction.
