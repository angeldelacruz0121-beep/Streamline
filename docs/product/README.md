# docs/product — Product Analyst's record

Owned by Product Analyst. Read-only to every other agent.

Three things live here, and nothing else.

| Path | What it is |
|---|---|
| `two-audience-tests/` | One record per feature, written **before** the feature is built. A feature with no record here does not get built. |
| `kill-list.md` | Features and treatments considered and rejected, with the reason. Kept current. |
| `open-questions.md` | Product questions this directory cannot answer alone. Angel's morning queue. |

The first-run experience specification is not yet written. It is blocked — see `open-questions.md`.

---

## The test

Four questions, in this order, on every feature before it is built.

**1. Beginner, five seconds.** Write the sentence someone with no finance background would say out
loud after five seconds. If the sentence cannot be written, the feature does not serve them.

**2. Beginner, misread.** What would they incorrectly conclude, and what specifically defends
against it. A misread with no named defense is a fail, not a caveat.

**3. Analyst, thirty seconds.** What someone who reads 10-Ks gets here that they could not get
faster from the filing itself. "It's prettier" is not an answer. If there is no answer, the feature
serves one audience and is labeled as such rather than pretending to depth.

**4. Demo test.** Would this feature exist if nobody ever saw a demo of it. If no, it is killed.

A record ends in a verdict of **BUILD**, **BUILD WITH CONDITIONS**, or **KILL**. Conditions are
binding on the owning agent and are stated as things that can be tested, not as things that can be
felt.

Every test is run against real reported figures for a real filer, cited to an accession number. A
test that only works on an invented example is not a test — it is the feature describing itself, and
a test run against a *rounded* figure is not much better. Figures come from the tagged facts, per
Invariant 2.2 and decision 0010.

---

## Record template

    # NNNN — <feature>

    Date:      <YYYY-MM-DD>
    Feature:   <one line>
    Owner:     <agent who will build it>
    Governs:   <invariants and decision records the feature is bound by>
    Test data: <the real filer and figures it was tested against>
    Verdict:   BUILD / BUILD WITH CONDITIONS / KILL

    ## 1. Beginner, five seconds
    ## 2. Beginner, misread
    ## 3. Analyst, thirty seconds
    ## 4. Demo test
    ## Conditions   (numbered, testable, binding)
    ## Open questions   (what this record could not settle, and who settles it)

---

## Index

| # | Feature | Verdict | Date | Tested against |
|---|---|---|---|---|
| [0001](two-audience-tests/0001-lake-area-encoding.md) | Lake area encodes net earnings | BUILD WITH CONDITIONS | 2026-08-20, amended same day | MSFT FY2026, accession 0001193125-26-323660 |
| [0002](two-audience-tests/0002-trunk-constriction.md) | Trunk constriction | BUILD WITH CONDITIONS | 2026-08-20, amended same day | MSFT FY2026, accession 0001193125-26-323660 |

**A record is amended, never quietly corrected.** Both records above were written against a net
income of $133,700M and corrected to the tagged value of $133,749M once Financial Data Analyst's extraction landed.
Each carries an Amendments section stating what changed, what was re-derived, and whether any
conclusion moved. A test whose figures silently changed would be worth less than no test, because the next
reader could not tell which numbers had been checked.
