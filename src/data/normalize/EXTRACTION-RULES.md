# Segment extraction — the named rules

Every decision this pipeline makes about what a segment is, what it is called, and which figures
belong to it is one of the rules below. Each is named, implemented in one place, and tested on its
own. The names appear in the code, so a reader who finds a rule here can find the function, and a
reader who finds the function can find the reasoning.

Three facts about EDGAR shape all of it.

**The convenience APIs cannot see segment data.** `companyfacts` and `companyconcept` return
non-dimensional facts only — not sparse, absent. Segment figures come from the XBRL instance
document in the filing archive. See `src/data/sec/ENDPOINTS.md`.

**Note numbers are not identifiers.** Microsoft's segment note is Note 18 in FY2026 and FY2025 and
Note 19 in FY2024. Nothing here keys off a note number. Lookup is by axis, by disclosure role id, or
by the filer's own presentation linkbase.

**Members are the filer's, not the taxonomy's.** Microsoft's segments are `msft:IntelligentCloudMember`
and friends, in Microsoft's own namespace. There is no list of members anywhere in this project.

---

## Reading the document

### `resolve-names-by-namespace-uri-v1` — `xbrl-instance.ts`
Element and attribute names are resolved to `{namespace URI, local name}` using the prefix
declarations on the instance root. Nothing matches on a written prefix. The instance namespace is
usually the default namespace, so `context` is unprefixed while facts are not, and a filer may bind
`us-gaap` to any prefix it chooses. Tested against an instance that prefixes the instance namespace
and rebinds `us-gaap` to `gaap`.

### `never-coerce-a-tagged-value-v1` — `xbrl-instance.ts`
`parseTagValue` and `parseAttributeValue` are off. A tagged amount arrives as the string the filer
wrote, and this project decides what it means. `decimals` is kept as reported and drives every
tolerance downstream, so nothing is ever compared more finely than the filer reported it.

### `deduplicate-consistent-facts-v1` — `xbrl-instance.ts`
Inline filings repeat a fact wherever it appears on the page; Microsoft's FY2026 instance carries
`NetIncomeLoss` four times in the same context. Identical repeats collapse to one and are counted.
Two facts with the same tag, context and unit but **different values** are never resolved by
choosing: both are dropped and the disagreement is recorded as a conflict.

### `inf-decimals-is-exact-not-unknown-v1` — `xbrl-instance.ts`
`decimals="INF"` is a precision claim — the amount is exact — not the absence of one. It is the
finest precision there is, so it wins every merge. Reading it as "unknown" refused ServiceNow
(`CommonStockSharesOutstanding` 1,047,278,000 at `INF` beside 1,047,000,000 at `-6`) and IBM
(`TreasuryStockCommonShares` 1,353,666,394 at `INF` beside 1,354,000,000 at `-6`), and let a coarser
twin overwrite an exact fact when the two agreed. A missing or unparseable attribute stays unknown.

### `rounding-is-not-contradiction-v1` — `xbrl-instance.ts`
Two facts of the same tag, context and unit are consistent when the finer one, **rounded to the
precision the coarser one claims, is the coarser one**. The finer fact is kept and the merge is
counted in `precisionMerged`.

The test is rounding, not a tolerance subtraction, because subtraction fails on the boundary that
matters: IBM tags its effective tax rate as `0.14` at `decimals="2"` and `0.135` at `decimals="3"`,
0.135 rounds to 0.14, and yet `|0.14 − 0.135|` is 0.0050000000000000044 in binary floating point —
4.34e-18 outside the ±0.005 envelope, which discarded IBM's entire 10-K. Rounding both sides to the
coarser precision compares whole units and has no such edge.

### `conflict-blocks-the-figure-not-the-filing-v1` — `ingest.ts`
A real contradiction drops both facts, so neither can render. It refuses only the figures that
needed one of them, named, with the disagreeing values quoted; a contradiction in a concept this
view never reads becomes a `fact-conflict-dropped` note. A cover-page share count must not discard a
10-K.

### `non-empty-input-must-yield-facts-v1` — `xbrl-instance.ts`, `taxonomy-presentation.ts`
A parse that produces nothing from a non-empty document returns `unreadable`, never an empty
success. This is decision 0010's parser error gate, which exists because an 861 KB daily index once
parsed to zero records and reported `ok`.

---

## Finding the segments

### `resolve-axis-by-localname-in-usgaap-namespace-v1` — `segment-contexts.ts`
The business-segments axis is matched on namespace URI plus local name
`StatementBusinessSegmentsAxis`, where the namespace matches `fasb.org/us-gaap/<year>`. The taxonomy
year changes every release and the prefix is the filer's choice, so matching the written QName would
break on either.

### `enumerate-members-from-contexts-v1` — `segment-contexts.ts`
Every context carrying that axis contributes its member. The member set is whatever the document
contains. Nothing is hardcoded and no namespace is assumed.

### `single-axis-context-only-v1` and `allowed-companion-dimensions-v1` — `segment-contexts.ts`
A context counts as a segment total only if the segment axis is its only dimension, or its other
dimensions are within `ALLOWED_COMPANION_AXES` (currently `ConsolidationItemsAxis` alone). A context
also sliced by geography, product or timing is a *part* of a segment; counting it as the segment
would double-count. Such contexts go to `unclassified` and `ingest.ts` refuses rather than dropping
them silently.

### `enumerate-members-from-clean-contexts-v1` — `segment-contexts.ts`, `ingest.ts`
Contexts on the segment axis are sorted into three kinds, for the requested period only.

| Kind | Test | What happens |
|---|---|---|
| Clean | Segment axis alone, or with an allowed companion | The segment's total. Member enumerated |
| Sliced | Segment axis plus an axis this project will not interpret | Reported in a `segment-slices-not-drawn` note. Never enumerated, never merged, never added to any total |
| Orphan | A member that appears only in slices, never with a total | `segment-identity-unresolved`, naming the member and the axes |

The rule exists because almost every large filer that discloses revenue by product does it on the
same axis as its segments. Refusing the filing because *some* context is sliced discarded Meta,
Alphabet, Cisco, HP, Snowflake, Jack Henry, Diebold, IBM and NVIDIA — every one of which tags a
complete, clean total for every segment it reports, and whose own
`us-gaap:NumberOfReportableSegments` agrees with that clean set wherever they tag it.

Both sets are restricted to the requested period, so a prior-year product cut cannot refuse the
current year. The enumerated clean revenues still run through the 0.5% reconciliation unchanged:
outside tolerance is a `reconciliation-break`, never a partial render. Adobe is the filer this
refuses — `adbe:DigitalMediaAndDigitalExperienceMember` is a combined-segments subtotal that appears
only under `srt:MajorCustomersAxis` and never carries a total, and guessing what a filer meant by a
combined subtotal is not a thing this project does.

### `read-a-member-from-every-clean-context-v1` — `segment-contexts.ts`, `ingest.ts`
A member keeps *every* clean context it has for the period, and its figures are looked up across all
of them. Filers split one segment's disclosures over several contexts: Cisco puts goodwill movements
on the segment axis alone and revenue, cost of sales and gross profit on the same axis plus
`ConsolidationItemsAxis`. Reading only the first context in document order found HP's figures by
luck and lost Cisco's entirely.

Where two clean contexts carry the same concept with different values, nothing is chosen — the
filing is saying two things about one segment measure, and the caller refuses, quoting both.

### `companion-axis-allowlist-by-axis-and-member-v1` — `segment-contexts.ts`
The allowlist is tested on **both** the axis and its member.

*The axis.* `ConsolidationItemsAxis` lives in `srt` — `http://fasb.org/srt/YYYY` — not in `us-gaap`.
Gating the allowlist on `isUsGaapNamespace` made it unreachable code: documented, tested for intent,
and unable to fire. Every one of Apple's five segment contexts carries exactly that axis, and Apple
was refused by a list written to admit it. Older filings put the same axis in the us-gaap namespace,
so both namespaces are accepted.

*The member.* `us-gaap:OperatingSegmentsMember` means "this is the segment's own total" and is
accepted. `MaterialReconcilingItemsMember`, `IntersegmentEliminationMember`,
`CorporateNonSegmentMember` and `ConsolidationEliminationsMember` mean the opposite — they are what
reconciles the segments to the consolidated statement — and go to `reconciling`, never to a river.
Accepting the axis without the member test would draw eliminations as segments and count them twice
against consolidated revenue. Any other member of that axis goes to `unclassified` and is refused.

### `reconciling-items-are-rendered-not-rivers-v1` — `ingest.ts`
The amounts on those reconciling contexts are read and handed to the reconciliation as explicit
`unallocated` figures (Invariant 2.4: rendered, never silently dropped). Each carries the filer's own
sign, and `increases` means "added to the segment total on the way to consolidated revenue", so an
elimination tagged negative reduces it without this project flipping a sign.

### `segment-count-crosscheck-v1` — `segment-contexts.ts`
The enumerated member count is compared to the filer's own `us-gaap:NumberOfReportableSegments`.

| Filer's count | Result |
|---|---|
| Agrees | Renders |
| Disagrees | `segment-identity-unresolved` — no render, both numbers stated |
| Absent | Renders with a `segment-count-unverified` note |

An absent count and a disagreeing count are different facts and must not look alike.

### `segment-order-from-rendered-report-v1` — `ingest.ts`
Segments come out in the column order of the filer's own rendered schedule, falling back to revenue
descending. Context iteration order is neither reproducible nor meaningful.

---

## Naming the segments

### `label-from-linkbase-v1` — `segment-labels.ts`, `taxonomy-presentation.ts`
The display name is the filer's `terseLabel` from the label linkbase as rendered into
`MetaLinks.json`, falling back to the standard label with `[Member]` and friends stripped.

### `labels-and-order-from-rendered-report-v1` — `segment-labels.ts`
EDGAR's rendered reports anchor each concept as
`Show.showAR( this, 'defref_<tag>', window );">Label</a>`, and each dimensioned column as
`defref_<axis>=<member>`. This is read for names and for presentation order. **No figure is ever
read from a rendered report.**

### `decode-entities-in-linkbase-labels-v1` — `taxonomy-presentation.ts`
`MetaLinks.json` carries labels with HTML entities unresolved, as the filer wrote them into its
linkbase: NVIDIA's segment is `Compute &amp;amp; Networking`. They are decoded when the index is
read. Undecoded, the label reaches a reader as literal `&amp;amp;`, and the cross-check against the
filer's own rendered schedule — which is decoded — compares "compute amp networking" against
"compute networking" and reports a naming conflict where the filer used one name twice. NVIDIA was
refused on exactly that.

### `rendered-heading-may-compound-members-v1` — `segment-labels.ts`
A rendered column heading names the *context*, not the member: where the context carries more than
one dimension the SEC renderer prints every member's label joined by a pipe, so Apple's Americas
column is headed `Americas | Operating segments`. The cross-check is satisfied when any part of the
heading is the member's label.

### `label-from-member-local-name-v1` — `segment-labels.ts`
Last resort: split the member's local name on case boundaries and drop `Member`. The result is
recorded with `labelSource: 'member-local-name'` so a fallback name is visible as one.

### Cross-check
Where the linkbase and the rendered schedule both name a member and disagree, the filing returns
`segment-identity-unresolved`. Naming a river wrongly is a wrong figure with a confident caption.

---

## Choosing the measures

### `resolve-segment-schedule-by-axis-v1` — `segment-facts.ts`
The schedule carrying segment figures is the disclosure role presenting **both** the segment axis
**and** a classified revenue concept. The revenue half is load-bearing: intersecting the axis with
any monetary concept also matches Microsoft's goodwill-by-segment schedule, which carries the same
axis and no revenue.

This rule **enumerates candidates**; it no longer decides. Zero candidates is still a refusal.
Several are handed to `prefer-role-presenting-operating-profit-v1` below, which is a separate step
so enumeration and selection can be tested apart.

### `prefer-role-presenting-operating-profit-v1` — `segment-facts.ts`
Where several roles present the segment axis beside a revenue concept, the segment schedule is the
one that **also presents the measure the rivers end at**, `us-gaap:OperatingIncomeLoss`. A filer
that discloses revenue by product on the segment axis produces a disaggregation-of-revenue role that
looks identical to its segment note to the enumerator — Meta and Alphabet file two such roles,
Diebold two, IBM three — and that note carries revenue only. The test is therefore structural, on
what the filer disclosed, not on a note title, an ordering or a role id.

| Candidates presenting operating profit | Result |
|---|---|
| Exactly one | That role is the segment schedule |
| Several | Refused, naming them. No fallback to document order — that is the ordering luck `read-a-member-from-every-clean-context-v1` exists to remove |
| None | Refused, naming every candidate. The revenue-only role is not taken and no profit measure is derived for it |

Qualification is on the role *presenting* the concept in the filer's presentation linkbase, not on
facts existing for it on every member. A role that presents operating income whose members do not
carry it wins selection and then refuses at the endpoint, which keeps "the schedule could not be
identified" and "the schedule was identified and the figures are not there" as two distinguishable
failures — and diagnosability is most of what the adversarial corpus is for.

Selection runs before reconciliation and is never revisited by it. If the chosen role's revenues
miss consolidated revenue by more than Invariant 2.4 allows, that is a `reconciliation-break`
reported as one, never a silent re-pick of the other role.

Both call sites in `ingest.ts` — the figures and the rendered report read for labels and ordering —
go through this one selector, so they cannot disagree about which role is the schedule.

### `measures-from-segment-detail-presentation-v1` — `segment-facts.ts`
The monetary concepts the filer presents in that role **are** its segment measure set. This is D11's
"filer-shaped, no fixed category set" made concrete: Microsoft discloses cost of revenue and one
operating-expenses line, Apple declines to allocate R&D at all, and neither is normalised toward the
other. Concepts presented in other roles — goodwill, unearned revenue — are not measures here.

Exactly one concept must classify as revenue (`SEGMENT_REVENUE_CONCEPTS`). At most one may classify
as the operating profit the river ends at (`SEGMENT_OPERATING_PROFIT_CONCEPTS`, which is
`OperatingIncomeLoss` and nothing else). Everything else in the role is a disclosed cost, in the
filer's order. Zero or several revenue concepts, or several profit concepts, is refused.

### `below-the-line-is-never-a-river-cost-v1` — `segment-facts.ts`
A concept in `BELOW_THE_LINE_CONCEPTS` — income tax, interest, other non-operating items, net income
— is removed from the cost set before anything is drawn, and can never be the measure a river ends
at. ASU 2023-07 is why: it lets a single-segment filer tag its whole income statement to its one
segment, and Autodesk does exactly that, tagging `IncomeTaxExpenseBenefit` ($479M),
`InterestIncomeExpenseNonoperatingNet` ($25M) and `NetIncomeLoss` ($1,124M) on the segment axis
beside its operating costs. Read naively that draws a river constricting for the company's tax bill,
which Invariant 1 and D16 forbid: those items are attributable to no segment and belong to the trunk.

### `river-ends-at-operating-income-v1` — `ingest.ts`
A river ends at the operating profit the filer tagged on the segment axis. Where a filer with
**exactly one** reportable segment tags none there, the endpoint is
`single-segment-operating-income-from-consolidated-v1` below. A multi-segment filer that tags no
segment operating income is refused: splitting a consolidated total across several rivers would be
an invented allocation.

### `consolidated-operating-income-from-income-statement-v1` — `ingest.ts`
The trunk's consolidated operating income is read from `us-gaap:OperatingIncomeLoss` on the
undimensioned required context, and from nothing else. It used to be read on whatever concept the
*segment schedule* used for profit, which for a filer whose schedule ends at net income put
consolidated net income into a field named consolidated operating income: Autodesk FY2026 displayed
$1,124M where the filing's `OperatingIncomeLoss` is $1,578M. The label and the figure must come from
the same concept.

---

## Making it add up

### `revenue-reconciliation-0.5pct-v1` — `validate/reconciliation.ts`
Invariant 2.4. Segment revenues must reach consolidated revenue within 0.5% of consolidated revenue.
Outside tolerance the company does not render; it returns `reconciliation-break` carrying both
totals, the difference and the ratio. Any unallocated corporate or elimination amount the filer
discloses is carried on the object and rendered, never absorbed.

### `segment-bridge-v1` — `validate/reconciliation.ts`
Per segment: revenue less disclosed costs, less reported profit. Zero means the filer's disclosed
categories account for the whole reduction. It is never folded into a constriction, because a
constriction's width is a quantitative claim (Invariant 3.1) and widening one to close an arithmetic
gap is drawing an invented number to scale.

### `segment-bridge-must-close-v1` — `ingest.ts`
Non-zero, outside the slack the filer's own `decimals` imply, **refuses the filing**. It was a
warning on a company that rendered anyway until 2026-08-23, and that was the wrong trade: the extra
or missing amount does not vanish, it is drawn — a subtotal such as gross profit tagged beside the
cost of revenue it already contains becomes a constriction whose width is money the segment never
spent. A wrong width is silent, and Invariant 3.1 is the claim it breaks. A refusal a reader can see
beats a warning a reader will not read; decision 0016 is the standing lesson about exactly this.

**The filing is refused, not the segment.** `RenderableCompany.segments` has no refused state, so
dropping one segment would either shrink the revenue sum until Invariant 2.4's check fails anyway
or — for a small segment — pass that check and draw a picture in which a real segment silently does
not exist.

The refusal names the segment, its revenue, every disclosed cost with its concept QName and amount,
the reported operating income, the size of the gap and which direction it runs, so the failure is
legible without opening the filing. It reuses the `segment-identity-unresolved` state — adding a
seventh view arm is a contract change, not an extraction rule — and therefore leads with *the
arithmetic did not close*, so it cannot be misread as the segments being unidentifiable.

Tolerance is the existing per-figure rounding slack. Nothing here touches the profit side of the
trunk, which is D18 and stays open.

**Consequence for the model:** on a rendered company `bridge.closes` is now always `true` and
`bridge.residual` always `null`. The pair is kept because it is the assertion itself — a reader is
entitled to see that the arithmetic was checked, not to take it on trust.

### `trunk-constriction-v1` — `validate/reconciliation.ts`, D16
Segment operating income less consolidated net earnings is the trunk residual. Reported items that
explain it are attached as components, each with the direction its concept implies. Whatever they
fail to account for stays visible as `unexplained`, and `fullyExplained` is judged against the
rounding slack the filer's own `decimals` implies — not an arbitrary epsilon.

**No tolerance rule is applied on the profit side.** Invariant 2.4 mandates one on revenue only, and
D18 — whether a profit-side rule is needed and what it should be — is open. This pipeline reports the
profit arithmetic exactly and refuses nothing on it.

### `prefer-aggregate-nonoperating-over-parts-v1` — `ingest.ts`
A trunk bridge concept that is a component of another is not read when that aggregate is present.
`NonoperatingIncomeExpense` outranks `InterestIncomeExpenseNonoperatingNet`, which outranks
`OtherNonoperatingIncomeExpense` and `InvestmentIncomeInterest`. Autodesk FY2026 is the worked case:
it tags interest and other income net at $25M and other non-operating income at $7M, where the $7M is
part of the $25M. Reading both left $7M unexplained on a trunk that otherwise closes to the dollar —
1,578 − 479 + 25 = 1,124.

### `bridge-components-must-explain-not-worsen-v1` — `ingest.ts`
Only aggregate-level bridge concepts are considered, and the set is judged once, whole: it is used
only if it leaves less of the gap unexplained than claiming nothing would. A filer that tags both an
aggregate and its parts would otherwise be counted twice, and a double-counted trunk narrows the
flow by money the company never lost. When the set fails, it is discarded entirely and the gap is
shown as unexplained, with a note.

The test is over the whole set on purpose. Judging item by item is unsound — Microsoft's
non-operating income widens the gap on its own and only makes sense alongside the tax charge, so a
per-item rule would discard a correct item.

---

## Derivations

Four methods exist, in `model/derivations.ts`, and none of them allocates a cost.

| Method | What it does |
|---|---|
| `sum-of-reported-figures-v1` | Adds disjoint reported amounts in one unit and period |
| `difference-of-reported-figures-v1` | Subtracts one reported amount from another |
| `reported-bridge-remainder-v1` | What a set of reported items fails to explain about a gap |
| `single-segment-operating-income-from-consolidated-v1` | Attributes consolidated operating income to a filer's only reportable segment |

`single-segment-operating-income-from-consolidated-v1` is the one that makes an inference rather than
doing arithmetic, so it is the one with a gate. It applies only where the axis enumerates exactly one
member and the filer tags no operating profit there, and only where the segment's own disclosed costs
carry its reported revenue to the consolidated figure within the rounding slack the filer's `decimals`
imply — Autodesk's do, exactly: 7,206 − 5,628 = 1,578. If the bridge does not tie, the figure is
refused rather than attributed. The result is labelled **derived** even though its value is a tagged
fact: the number is the filer's, the attribution to the segment is this project's inference, and
Invariant 2.3 is about which of those a reader is looking at.

Each carries its assumption in plain language, and that sentence is copied onto every figure it
produces so a detail panel can state it. Every derived figure carries the source refs of every input.

**There is no cost-allocation method, deliberately.** Microsoft discloses all four segment measures,
so nothing needed allocating. The first filer that does not disclose a cost category gets
"not disclosed" — not an estimate — unless Angel approves a named method for it.
