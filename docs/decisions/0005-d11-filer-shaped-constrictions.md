# 0005 — D11: constrictions are filer-shaped and reported

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     D11 asked which cost categories render as constrictions and in what fixed order along
             the river. The working default was COGS → R&D → S&M → other opex. Research against
             SEC EDGAR established that this default is not sourceable at segment level for any
             filer examined.

             Microsoft's FY2026 10-K discloses four measures per reportable segment — revenue, cost
             of revenue, operating expenses, operating income — but collapses R&D, sales and
             marketing, and G&A into a single undifferentiated operating expenses line. Two of the
             default's four categories therefore do not exist per segment.

             The taxonomy is filer-specific by design. ASU 2023-07 requires disclosure of
             significant segment expenses regularly provided to the chief operating decision maker,
             but lets each filer choose its categories. Seven technology filers surveyed produced
             seven different shapes: Microsoft (cost of revenue + operating expenses); Apple (cost
             of sales + selling and marketing, with all R&D and G&A held in corporate and
             explicitly not allocated); Alphabet (a natural-expense split orthogonal to the
             functional one); Oracle and Intuit (one combined expense line); IBM (cost + other);
             Adobe (revenue and gross margin only — the CODM does not review segment operating
             expense at all); Salesforce (a single operating segment).

Options:     1. Single reported constriction per river — total cost = segment revenue minus segment
                operating income.
                Tradeoff: zero derived geometry and near-universal applicability, but discards real
                reported data (Microsoft's two disclosed cost lines would go unrendered) and tells
                a beginner that costs exist without explaining why Intelligent Cloud converts
                revenue to profit differently than Productivity — the insight the product exists to
                deliver.
             2. Filer-shaped reported constrictions — render exactly what the filer discloses.
                Tradeoff: every constriction traces to an XBRL tag, but the count varies between
                companies so silhouettes are not directly comparable filer to filer.
             3. Four fixed derived categories — keep the default, allocate what is not disclosed.
                Tradeoff: visually uniform and pedagogically clean, but most of the geometry becomes
                Streamline's invention rather than the company's.

Decision:    Option 2. Each river carries exactly the categories its filer discloses for that
             segment. Microsoft renders as two constrictions — cost of revenue, then operating
             expenses — each with an XBRL tag and source reference. Varying constriction count is
             labeled as information about disclosure depth, following the precedent Invariant 3.8
             sets for single-segment filers.

             Option 3 was rejected on evidence rather than taste. The only sourceable allocation
             basis is revenue share, which forces every segment to an identical margin — refuted by
             Microsoft's own disclosed segment gross margins of 82%, 58% and 57%, computed from data
             in the same table. It would also erase precisely what Invariant 1 promises the visual
             conveys, that "a river that stays wide signals efficiency." The alternatives fail too:
             segment headcount is not disclosed anywhere in EDGAR, and relative gross margin
             requires the segment cost of revenue that would be the figure under derivation.
             Financial Data Analyst's charter is dispositive — "if no defensible method exists for a cost category,
             the correct output is not disclosed, not an estimate."

             Invariants 3.1 and 3.2 make the width itself the quantitative claim, so a
             derived-styled constriction is still a wrong number drawn to scale. Styling cannot
             defend it.

Consequence: Invariant 3.2 amended to permit a variable, filer-determined constriction set. Financial Data Analyst
             needs a per-filer extraction rule set and a documented category-mapping table. Adobe
             is now a known decline case — segment revenue and gross margin only, with no segment
             operating income — and is the first live test of Data Visualization Engineer's clause that Streamline
             should decline to render a company whose shape breaks the metaphor, rather than invent
             a second constriction.

             Surfaced but not resolved here: even Microsoft's reported segment costs are Microsoft's
             own internal allocations, stated in Note 18 as "based on a relative revenue
             methodology" for cost of revenue and "relative gross margin" for operating expenses.
             They are reported and XBRL-tagged, yet not directly measured. Invariant 2.3's binary
             `reported | derived` cannot express this. Opened as D18's sibling, D17.

---

## Amendments

**2026-08-20 — Segment gross margin figures corrected.**

Original figures: Productivity 81%, Intelligent Cloud 62%, More Personal Computing 54%.

Correct figures (from wire extraction, fixture at src/data/normalize/__fixtures__/msft-fy2026.ts):
Productivity 82.13%, Intelligent Cloud 58.00%, More Personal Computing 56.56%.

Differences:
- Intelligent Cloud: −4.13 percentage points (62% vs 58%)
- More Personal Computing: +2.56 percentage points (54% vs 56.56%)
- Productivity: +1.13 percentage points (81% vs 82.13%)

**Argument survives.** The decision's reasoning — that a uniform-margin allocation basis is
refuted by the actual diversity of disclosed segment margins — is unaffected. The corrected
margins (82%, 58%, 57% rounded) show the same diversity as the original figures did. The
refutation of the revenue-share allocation basis is just as strong.

See 0016-slice-figures-corrected-process-lesson.md for context on the correction.
