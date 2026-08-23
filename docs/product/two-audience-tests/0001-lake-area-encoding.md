# 0001 — Lake area encodes net earnings

Date:      2026-08-20 (amended same day — see Amendments)
Feature:   Lake surface area linearly proportional to consolidated net earnings; scale indicator
           displayed; basin plan area on the same constant when earnings are negative.
Owner:     Data Visualization Engineer (`src/viz/scales/`, `src/viz/encoding/`)
Governs:   Invariants 3.1, 3.3, 3.4, 3.6, 3.10, 3.11 · decisions 0006 (D13), 0007 (D16),
           0004 (vertical slice scope), 0010
Test data: Microsoft FY2026, accession 0001193125-26-323660, form 10-K, FY 2025-07-01 → 2026-06-30.
           Tagged facts as extracted by Financial Data Analyst (WS2), $M: total revenue 331,839 · segment operating
           income 155,237 (83,879 + 56,972 + 14,386) · non-operating income +10,697 · income taxes
           −32,185 · consolidated net income (`us-gaap:NetIncomeLoss`, `decimals="-6"`) **133,749**.
           Trunk residual 21,488. Net margin 40.31%.
Verdict:   **BUILD WITH CONDITIONS** — with one condition (C1) that this record cannot satisfy and
           escalates to Angel, and a scoped fail recorded honestly in §1.

D13 is answered and is not reopened here. What area encodes is settled. This record tests whether
the settled encoding is *read correctly by each audience*, which is a different question and is
still open.

---

## 1. Beginner, five seconds

**The sentence, once the lake is labeled:** *"The lake at the end is the money the company actually
kept."*

That sentence is available in five seconds and it is true. It costs one persistent word of label.
Unlabeled, a body of water at the end of rivers reads only as "the end," not as "profit," and the
five-second sentence cannot be written at all.

**Then the encoding fails, in the slice as scoped.** The sentence above is earned by the lake's
*position*, not by its *area*. Area is a comparative channel: it carries information only against a
referent. Decision 0004 excludes the company switcher and multi-year history from the vertical
slice, so in the slice there is exactly one lake, one period, and nothing on the canvas at the same
area constant to compare it to. A beginner does not measure a shape against a scale bar in five
seconds. The scale indicator required by 3.3 makes the encoding *verifiable*; it does not make it
*readable*.

So: in the vertical slice, the lake's area conveys nothing to a beginner. It is not wrong — it is
inert. It begins working the moment a second lake exists at the same constant (period two, or
company two), which is the generalisation phase, not this milestone.

This is recorded as a scoped fail rather than a kill because the encoding is correct, cheap, and
becomes load-bearing one milestone later. Building it now on the right constant is exactly what
0006's consequence note requires — "the area constant must be defined once, for both signs, rather
than settled for profit and retrofitted for loss." But it must not be *presented* in the slice as
though the beginner is learning something from the lake's size, because in the slice they are not.

**The referent the beginner will reach for anyway** is the water arriving. That is condition C1.

## 2. Beginner, misread

**Misread A — the conservation read.** A river-into-lake picture invites exactly one read above all
others: *this much flowed in, that much collected.* The picture cannot support it. Rivers encode
dollars as **width** — a constant in px/$. The lake encodes dollars as **area** — a constant in
px²/$. The ratio of those two constants has units of pixels, so relating them requires a reference
length carrying no financial meaning. This is the identical dimensional argument 0006 used to
dissolve the depth-versus-area question, applied to the river-versus-lake junction, where it is
unresolved.

Concretely: nothing in the invariants pins the lake's diameter against the trunk's width. Whoever
implements this picks that relationship, and whatever they pick, a beginner will read it as data.
Pick one number and Microsoft's lake looks small next to the arriving trunk — the beginner concludes
Microsoft barely makes money. Pick another and the lake dwarfs the trunk — they conclude almost
everything survives. Both readings are false and there is no appearance that is true, because the
comparison is not defined. A choice on that channel made by eye is a 3.6 breach: something that
looks like data and is arbitrary.

The real figures make the stakes concrete rather than abstract. **The true answer the beginner is
reaching for is 40.31%** — Microsoft keeps $133,749M of $331,839M in revenue. That single number is
the most valuable thing this picture could teach a beginner, it is the one they will try hardest to
read, and it is currently the one quantity in the composition that no encoding is responsible for
being right about.

**Defense: none exists yet.** This is C1 and it goes to Angel. It is the single most important
finding in this record, and it is worth catching now precisely because no code is written.

**Misread B — the balance-sheet read.** "The lake is Microsoft's money" — a stock reading of what is
one period's flow. 0006 already names this for the drained basin and defends it: period labeled on
the rim, and changing the period visibly re-fills or re-drains. The same defense is required on the
filled lake, not only the basin. The slice is single-period, so the label carries it alone; the
re-fill behavior arrives with periods. Condition C3.

**Misread C — "the lake is what shareholders got."** 0007's consequence note frames the trunk
constriction as "$21.5B of Microsoft's operating profit does not reach shareholders." That framing
is loose and must not reach the interface. Net income is not distributed to shareholders either; it
is retained or paid out, and the split is invisible in this picture. If the trunk's copy says money
"does not reach shareholders," the beginner concludes the lake *does* reach them. It does not.
Condition C4.

**Misread D — perceptual understatement.** Area is perceived with an exponent near 0.7, so a lake
twice as large reads as roughly 1.6× larger. Every magnitude comparison the beginner makes from
area is compressed. The temptation is a Stevens correction — killed, see `kill-list.md` K4. The
defense is the numeric label, not a distorted scale.

## 3. Analyst, thirty seconds

**On the area encoding specifically: nothing.** An analyst cannot decode an area to a dollar figure
and would not try. The lake's size gives them strictly less than the number does. Answering this
honestly is the point of the question.

**On the lake as a terminus: a real answer.** What an analyst gets that is faster than the filing is
the complete bridge from segment revenue to consolidated net income in one frame, with every step
clickable to its accession number, form type, fiscal period and XBRL tag. Microsoft's 10-K holds
those pieces in two places — the segment note and the income statement — and constructing the bridge
is a spreadsheet exercise. Streamline collapses it to one view with provenance intact. That is a
legitimate answer and it is not "it's prettier."

But note what carries it: the *composition* — rivers, constrictions, trunk, lake — not the area
encoding. Per the mandate, this is labeled rather than inflated. **Lake area is a beginner-facing
encoding.** The analyst is served at the lake by the numeric value and the provenance panel, which
means the number must be present as text at all times, in tabular numerals, not revealed on hover.
Forcing an analyst to read a magnitude through a lossy 0.7-exponent channel when the exact figure is
already in memory is the simplification the mandate exists to prevent. Condition C2.

## 4. Demo test

**Pass.** The lake is required by the metaphor's structure — the rivers need a terminus, and 0007
established that the terminus must be net earnings for the picture to conserve. The area-versus-
diameter choice inside that is a correctness decision taken against a stated psychophysical
argument, not a decision that makes anything look better; 0006 chose the option that makes a
marginally unprofitable company *stop* visually dominating a marginally profitable one, which is
strictly less dramatic. A feature that was argued into a less impressive shape is not a demo
feature.

---

## Conditions — binding on Data Visualization Engineer

**C1 — Escalated, not decided.** The relationship between the width constant (px/$) and the area
constant (px²/$) must be pinned by a stated rule with financial meaning, or the two encodings must
be explicitly and visibly separated so the conservation read is not invited. Data Visualization Engineer must not
resolve this by choosing a number that composes well. Until Angel answers, build the area constant
standalone and defer the trunk-to-lake junction geometry. See `open-questions.md` Q1.

**C2 — The net earnings figure renders as text, persistently, in tabular numerals, adjacent to the
lake.** Not on hover, not in a panel. The analyst path to this number does not route through area.

**C3 — The fiscal period label is attached to the lake, not only to the basin.** 0006 requires it on
the basin rim; the same misread applies to a filled lake and the defense must be symmetric.

**C4 — No copy anywhere states or implies that the lake is money shareholders received.** Permitted
framing: what the company kept for the period. Copy is Angel's call per protocol §3; this condition
constrains what may be proposed, not what is chosen.

**C5 — Test: the area constant is defined once, signed.** A −$133,749M basin and a +$133,749M lake
produce identical plan area from the same constant, verified by assertion, not by inspection. Per
0006's consequence note, this is required in the slice even though Microsoft cannot exercise it.

**C6 — The scale indicator states its value as a reference of known magnitude** (a shape of stated
dollar value), not as a linear bar. An area cannot be read against a length.

## Open questions

**Q1** — the width-to-area anchoring rule. Escalated. See `open-questions.md`.

**Not blocked by D12.** Decision 0004 fixes the slice's period as the subject filer's most recent
fiscal year. D12 governs the app's default once multiple periods exist, which 0004 excludes from
this milestone. This record therefore proceeds without guessing D12.

**Not blocked by D17.** Consolidated net income is directly reported and not a filer allocation, so
the binary `reported | derived` of 2.3 expresses it without strain. D17 blocks the *river
constriction* detail panels, not this one.

**Not blocked by D10.** Coverage scope does not touch this encoding.

---

## Amendments

**2026-08-20 — corrected figures.** Written first against net income of $133,700M, a rounded value
the filer does not tag. Financial Data Analyst's WS2 extraction and an independent check against the SEC
companyconcept API establish `us-gaap:NetIncomeLoss` = **133,749** ($M, `decimals="-6"`); 2.2 and
decision 0010 give no discretion. Every dependent figure re-derived, not substituted: the trunk
residual is **21,488**, and C5's signed-constant assertion now names 133,749.

Segment revenues arrived with the same extraction and are new to this record. They add the net
margin of **40.31%** to Misread A, which sharpens Q1 from a dimensional argument into a named
quantity the picture currently gets no credit for stating correctly.

No verdict reversed. The scoped beginner fail in §1 and the Q1 escalation both stand, and Q1 is
stronger than when it was written.
