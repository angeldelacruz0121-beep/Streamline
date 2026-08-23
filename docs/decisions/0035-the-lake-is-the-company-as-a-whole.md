# 0035 — The lake is the company as a whole

Date:        2026-08-23
Status:      adopted — invariants amended
From:        Angel

WHAT WAS MISSING
----------------

Every description of the product — Invariant 1, Invariant 3.3, the README — defined the lake by
its quantity: "the lake is net earnings," "lake surface area is linearly proportional to net
earnings." Correct, and incomplete. None of them said what the lake *is*.

Angel's correction: **the lake represents the company as a whole.** The rivers are the parts of
the business; the lake is the single body they all feed, and it is the only element on the canvas
that stands for the entire filer rather than a piece of it. Net earnings is the lake's magnitude,
not its meaning.

WHY IT MATTERS RATHER THAN BEING A WORDING PREFERENCE
-----------------------------------------------------

The metaphor only closes if the lake is the whole company. Without that, the picture is a set of
rivers ending in a pool of one particular accounting figure, and a beginner has no reason to read
the canvas as being *about a company* at all — which is the five-second story Invariant 1 promises.

It also supplies the missing *why* behind rules already in force:

- **3.7** requires lake area to be identical whether hidden segments are drawn or collapsed. The
  reason is that the lake is whole-company by definition, so a display decision cannot change it.
  That test previously read as an arbitrary constraint; it is now derived.
- **3.3** insists on consolidated net earnings rather than the sum of segment operating income.
  Consolidated *is* the whole-company figure — the same principle, stated in accounting terms.
- **3.4** rules that a drained basin must not read as a stock. Sharper now: it is the company in
  one period, not the company's standing.

CONSEQUENCE
-----------

- No geometry, scale or pipeline change. The encoding was already correct; the definition behind
  it was under-stated.
- `STREAMLINE-INVARIANTS.md` §1 gains the definition; §3.3 is restated to lead with it and derive
  the consolidated-figure rule from it. Amendment log updated.
- `README.md` opening restated to match.
- Binding on copy: Copy voice is unseeded (`STATUS.md`), so no copy slot has to be rewritten — but
  every lake-adjacent slot written from here reads the lake as the company. Product Analyst and
  Art Director own that at the point copy is seeded.
- Binding on the analyst detail panel: the lake's panel is the whole-company panel, not a
  net-income line item. Not built yet; captured here so it is designed that way the first time.

WHAT WAS NOT DONE
-----------------

No code was touched. `src/viz/encoding/lake.ts` and its tests already implement the encoding this
decision describes, and re-titling identifiers to say "company" would be churn against a correct
implementation. If the naming is revisited it should be as part of the label and copy work, not
as a stray rename.
