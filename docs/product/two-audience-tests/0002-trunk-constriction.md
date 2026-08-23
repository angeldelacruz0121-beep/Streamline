# 0002 — Trunk constriction

Date:      2026-08-20 (amended same day — see Amendments)
Feature:   The rivers merge into a trunk; the trunk passes through one shared constriction carrying
           tax, non-operating items and any unallocated corporate remainder, before the lake.
Owner:     Data Visualization Engineer (`src/viz/encoding/`, `src/viz/scales/`)
Governs:   Invariants 1, 3.1, 3.2, 3.6, 3.7, 3.9, 3.10, 3.11 · decisions 0007 (D16), 0005 (D11),
           0004, 0010
Test data: Microsoft FY2026, accession 0001193125-26-323660, form 10-K, FY 2025-07-01 → 2026-06-30.
           Tagged facts as extracted by Financial Data Analyst (WS2), $M:

               segment            revenue   cost of rev   operating exp   operating income
               P&BP               139,996        25,017          31,100             83,879
               Intelligent Cloud  137,791        57,876          22,943             56,972
               More Personal Cmp   54,052        23,481          16,185             14,386
               total              331,839       106,374          70,228            155,237

               nonoperating income (expense)   +10,697
               provision for income taxes      −32,185
               net income (us-gaap:NetIncomeLoss, decimals="-6")   133,749

           Trunk residual = 155,237 − 133,749 = **21,488**. Bridge closes with $0 unexplained.
Verdict:   **BUILD WITH CONDITIONS.** Passes both audiences on the real figures. The analyst pass
           is thin in the slice and is conditioned on C3, which the corrected data promoted from a
           nicety to load-bearing.

---

## The question that was asked first: does $21,488M read as a real quantity or as decoration?

**As a real quantity, and the filing's own numbers settle it rather than an opinion.**

The residual is 13.84% of the trunk's arriving width (21,488 / 155,237). As a *ratio* that is the
shallowest narrowing anywhere on the canvas — the first constriction on each river cuts 17.87%,
42.00% and 43.44% respectively, before operating expenses take more. A ratio reading makes the trunk
pinch look like an afterthought.

The ratio reading is the wrong one, and Invariant 3.1 is why. On a single linear width scale the
pixels removed at a constriction are exactly proportional to the dollars removed, regardless of how
wide the thing being pinched is. So the correct comparison is absolute — and absolutely, the trunk
constriction is an ordinary member of the set, not an outlier at the bottom of it:

| # | Constriction | $M removed = px removed |
|---:|---|---:|
| 1 | Intelligent Cloud — cost of revenue | 57,876 |
| 2 | P&BP — operating expenses | 31,100 |
| 3 | P&BP — cost of revenue | 25,017 |
| 4 | More Personal Computing — cost of revenue | 23,481 |
| 5 | Intelligent Cloud — operating expenses | 22,943 |
| **6** | **Trunk — tax and non-operating items (net)** | **21,488** |
| 7 | More Personal Computing — operating expenses | 16,185 |

Sixth of seven, within 6.4% of the fifth and 8.5% of the fourth, and 1.33× the seventh. And the
headline comparison survives the correction:

> **The trunk constriction removes 1.494× the entire operating income of Microsoft's smallest
> reportable segment** ($21,488M against $14,386M).

At the confluence More Personal Computing contributes 9.27% of trunk width. The trunk constriction
removes 13.84%. **The bite is wider than the whole river that segment brought in.** That is not
decoration under any rendering that honors 3.2's shared-scale requirement.

Legibility follows from the same constraint and is comfortable:

| Trunk width | Removed | Per side | MPC river at confluence |
|---:|---:|---:|---:|
| 58px | 8.03px | 4.01px | 5.37px |
| 100px | 13.84px | 6.92px | 9.27px |
| 129.5px | 17.93px | 8.96px | 12.00px |
| 200px | 27.68px | 13.84px | 18.53px |

Read the table from the right-hand column. Any scale at which the smallest segment is legible at all
already puts the trunk constriction well above the threshold where a narrowing reads as a step
rather than a taper. **The binding legibility constraint in this picture is the third river, not the
trunk constriction.** The residual can only read as decoration if the scale is broken — which is to
say, if 3.1 or 3.2 has been violated somewhere upstream. Condition C1 turns that into a test.

**The layout constraint this implies, now that real revenues exist.** The picture spans 331,839 at
the three river sources down to 14,386 at More Personal Computing's confluence — a **23.07:1 linear
width range**, with the narrow end needing to stay legible. At MPC = 12px the combined source width
is 276.8px and the trunk is 129.5px. That is Data Visualization Engineer's real sizing envelope, and it comes from
the filing rather than from a mock. Invariant 3.9's dominant-segment case does not bite here: the
largest segment is 42.2% of revenue, well under 80%.

**The honest caveat.** Human perception of a constriction tracks the ratio more closely than the
absolute, per Weber. A 13.84% pinch on a wide trunk is perceptually less salient than a 43% pinch on
a narrower river even when comparable pixels are removed. The defense is *not* to enlarge the pinch —
that is forbidden by 3.2, is an accuracy-versus-appearance trade requiring escalation under protocol
§3, and is killed at `kill-list.md` K1. The defense is annotation: condition C2.

## 1. Beginner, five seconds

**The sentence:** *"They all join into one river, and then one last cut takes a big piece out right
before the end."*

Available in five seconds from geometry alone, before any label is read, and true. The confluence is
the strongest structural moment in the picture and the pinch sits immediately after it, at the point
of maximum attention.

What they do *not* learn in five seconds is what the cut is. That takes the label, and the label is
the whole risk — see below.

## 2. Beginner, misread

**Misread A — "that's another cost, like the others."** This is the likely one and it is the
expensive one. If the trunk constriction is drawn in the same visual language as the river cost
constrictions, a beginner folds tax into the operating story and concludes Microsoft's *operations*
are less efficient than they are. Invariant 1's promise — "a river that stays wide signals
efficiency" — is directly damaged by a non-operating item wearing an operating costume.

**Defense:** position alone is not enough. The trunk constriction sits after the confluence, but a
beginner does not know that "after the confluence" means "not attributable to any segment." It must
differ in *kind*, not only in place — a different constriction treatment, differentiated by more
than color per 3.10. Condition C4.

**Misread B — "that money was wasted."** A cut in a flow reads as loss. Tax is a claim, not waste.
Non-operating items are not failures of the business. Plain-language labeling is the only defense,
and the label must name the thing rather than editorialize it. "Tax and other items outside the
business segments" is available to a beginner; "tax and non-operating items" is not.

Labeling copy is Angel's call under protocol §3. This record constrains what may be proposed:
plain-language, naming, non-editorializing, and never implying waste. Condition C5.

**Misread C — the shareholder framing.** 0007's consequence note says the trunk teaches that
"$21.5B of Microsoft's operating profit does not reach shareholders." Do not ship that sentence. Net
income does not reach shareholders either — it is retained or distributed, and this picture shows
neither. The framing makes the lake mean something false. Carried as condition C4 on record 0001.

**Misread D — the netting misread.** *Found only when the real tagged facts arrived; it was invisible
at the residual level.* The $21,488M is a **net of two figures with opposite signs**: non-operating
income of **+10,697** and a tax provision of **−32,185**. Drawn as a single 13.84% pinch, the picture
states that tax cost Microsoft $21.5B. It cost $32.2B. The trunk understates the tax charge by a
third, and it does so by silently offsetting it against investment income that a beginner has no way
to know is in there.

The magnitude matters: **$32,185M would rank second of all constrictions in the picture**, behind
only Intelligent Cloud's cost of revenue and ahead of every operating expense line Microsoft
discloses. Netting it away hides the second-largest single claim on the company's earnings.

This is not a 3.1 breach — the net pinch is dimensionally correct and the lake still reconciles. It
is a 3.11 misreading failure: a plausible wrong conclusion with no defense currently specified.
Whether the fix is itemization in the panel only (C3) or a change to what is *drawn* is not a call
this record can make, because D16 answered "one final shared constriction" and the question of net
versus decomposed rendering sits underneath that answer rather than inside it. Raised as
`open-questions.md` **Q4**. C3 is binding regardless and is the minimum defense.

**Misread E — sign.** The residual is net negative for Microsoft, so the trunk narrows. The encoding
has no defined behavior when a residual is net positive and the trunk should *widen*. Microsoft does
not exercise it at the net level, but Misread D shows the *components* already have opposite signs
in the very first filer, so this is nearer than it looked. `open-questions.md` Q2; not blocking.

## 3. Analyst, thirty seconds

**In the slice: a real answer, but a thin one.** Microsoft's segment note already reconciles segment
operating income toward consolidated results, so the analyst can get the number. What they get
faster here is the *proportion* without arithmetic: that the residual outweighs an entire reportable
segment's operating income, and where it ranks among everything that reduced revenue — sixth of
seven, between Intelligent Cloud's operating expenses and More Personal Computing's. The filing
gives numbers; the encoding gives rank and ratio at a glance. That is a genuine 30-second gain and
it is not "prettier." It is not a large one.

**The large answer arrives at company two and should be named now so it is not lost.** 0007 puts the
unallocated corporate remainder in this same constriction. That makes trunk-constriction size across
filers a **disclosure-quality signal**: Microsoft's trunk carries tax and non-operating items only,
because its segments tie to consolidated operating income exactly and Financial Data Analyst's bridge closes with $0
unexplained. Apple's would carry those *plus* $42.6B the filer declines to allocate. An analyst
comparing the two sees instantly that Apple's segment disclosure explains far less of the company
than Microsoft's does. That is not fast to obtain from filings and it is exactly the analyst value
the product is claiming. It requires the company switcher, which 0004 excludes from this milestone.

**The condition the analyst pass depends on.** If the trunk constriction is one opaque lump labeled
"tax and other," the analyst gets nothing at all — one netted number that conceals its two
components. The detail panel must **itemize**. Condition C3, now load-bearing rather than
incremental.

## 4. Demo test

**Pass, and it is the strongest pass available.** This feature was not imagined; it was *forced*.
0007 records that verifying real figures surfaced a gap where the rivers did not reach the lake, and
that without the trunk constriction the visual does not conserve. It adds an element, a label and an
explanation to the picture — it makes the demo longer and harder, not shorter and cleaner. The
alternative that demos better (redefine the lake as operating income; rivers sum exactly, no new
element needed) was considered and rejected. A feature that survived a comparison against a
better-demoing alternative on correctness grounds is the opposite of a demo feature.

---

## Conditions — binding on Data Visualization Engineer

**C1 — Test: one width scale, asserted.** A single px/$ constant governs river widths, every river
constriction, the trunk, and the trunk constriction. Assert that the trunk's arriving width equals
the sum of the three segment widths at the confluence (83,879 + 56,972 + 14,386 = 155,237), and that
the removed width at the trunk constriction equals the removed width of a river constriction of the
same dollar value to within a pixel. This is the test that makes the "decoration" answer falsifiable
rather than asserted.

**C2 — The removed quantity is annotated, not merely rendered.** The dollar figure appears against
the constriction, and the removed width itself is dimensioned. Perception discounts a wide-trunk
pinch by ratio; annotation restores the magnitude without touching the geometry. Presentation of the
annotation is Art Director's and Angel's; its presence is not optional.

**C3 — The detail panel itemizes the residual into its signed components.** For Microsoft FY2026
that is exactly two lines — non-operating income (expense) **+10,697** and provision for income
taxes **−32,185** — plus, for other filers, any unallocated corporate remainder, each with accession
number, form type, fiscal period and XBRL tag per 2.2. Signs are shown. A single −21,488 total fails
the analyst test and leaves Misread D undefended.

**C4 — The trunk constriction is visually distinct in kind from river cost constrictions,** by a cue
that is not color alone per 3.10, and is labeled as applying to the whole company rather than to any
segment.

**C5 — Plain-language label.** Names the components; does not editorialize; does not imply waste;
does not use "does not reach shareholders." Final wording is Angel's.

**C6 — Test: the residual reconciles, on unrounded tagged values.** 155,237 − 21,488 = 133,749,
asserted against `us-gaap:NetIncomeLoss` as tagged, not against a rounded variant the filer does not
publish. The full bridge also asserts: 155,237 + 10,697 − 32,185 = 133,749, unexplained = 0.

**C7 — Test: the trunk conserves under "More."** 3.7 requires lake area to be identical whether
hidden segments are expanded or collapsed. The same must hold for trunk width and the trunk
constriction. Microsoft has three segments and cannot exercise the cap; the assertion is written
now and exercised at generalisation.

## Open questions

**Q4** — net versus decomposed trunk rendering, raised by Misread D. Escalated.
**Q2** — trunk behavior when a residual is net positive. Not blocking.

**Not blocked by D17.** Tax and non-operating items are consolidated reported figures, not filer
allocations. D17's third provenance state is required for the *river* constrictions — Microsoft's
segment cost of revenue is allocated on "a relative revenue methodology" per 0005 — and for this
constriction's panel only if an unallocated corporate remainder proves to need it at company two.

**Not blocked by D12 or D10.** Same reasoning as record 0001.

---

## Amendments

**2026-08-20 — corrected figures.** Written first against net income of $133,700M, a rounded value
the filer does not tag. Financial Data Analyst's WS2 extraction and an independent check against the SEC
companyconcept API establish `us-gaap:NetIncomeLoss` = **133,749** ($M, `decimals="-6"`); 2.2 and
decision 0010 give no discretion. Residual corrected 21,537 → **21,488**, and every derived figure
re-derived rather than substituted: 13.87% → **13.84%** of trunk width; 1.50× → **1.494×** the
smallest segment's operating income; the legibility table recomputed.

Segment revenues, cost of revenue and operating expenses were previously unavailable and are now
carried above as tagged facts. They corrected a second error: the first-constriction ratios had been
inferred as 19% / 38% / 46% from gross margins of 81% / 62% / 54% quoted in decision 0005. The real
tagged values give margins of **82.13% / 58.00% / 56.56%** and cuts of **17.87% / 42.00% / 43.44%**.
The 0005 figures are wrong for Intelligent Cloud by 4 points and More Personal Computing by 2.6, and
that discrepancy is flagged to Technical Writer and Financial Data Analyst — this record no longer depends on them.

No verdict reversed. Two conclusions strengthened by the real data (the constriction ranking replaced
a weaker "smallest pinch on the canvas" framing; the 23.07:1 layout envelope is new), and one new
finding added that the residual alone could not reveal (Misread D, the netting of +10,697 against
−32,185).
