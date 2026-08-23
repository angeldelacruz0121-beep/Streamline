# 0015 — A4: Test fixture is a trimmed verbatim excerpt of the real instance

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     Financial Data Analyst's WS2 plan includes extraction tests. The question is what fixture to use:
             (1) a trimmed excerpt of the real Microsoft instance, carrying real reported figures
             and real segment structure, or (2) no fixture and hit the wire in tests, or (3) a
             hand-authored fixture composed from what the parser expects.

             Decision 0010 (docs/decisions/0010-fixtures-from-wire-not-guessed.md) settled that
             for Data Engineer's external-service parsers: every fixture is captured from a live
             response, never guessed. Financial Data Analyst's extraction is downstream of that; the question
             is whether the same rule applies to extraction logic.

Options:     1. No fixture; hit the wire every time. Tradeoff: the test is a live integration
                test, which is slow and fragile, but proves extraction against the real instance.
             2. The full 50 MB uncompressed instance. Tradeoff: unquestionable truth, but bloats
                the test suite and slows test runs.
             3. A trimmed excerpt from the real instance, carrying real reported figures and
                structure, but excluding fields not load-bearing to the extraction logic.
                Tradeoff: smaller than the full instance, proves the parser against real data
                (per 0010's standing rule), but requires manual trimming so it is a human decision
                point where someone could make an error.

Decision:    Option 3. The fixture in src/data/normalize/__fixtures__/msft-fy2026.ts is a
             trimmed verbatim excerpt from the real Microsoft FY2026 instance, per decision 0010.
             It carries real reported figures and real segment structure. The trimming removes
             fields not relevant to extraction or provenance logging, but every segment fact and
             every cost line is real and traceable to the XBRL source.

             The full instance path (accession 0001193125-26-323660, period end 2026-06-30) is
             documented in the fixture's header comment, so it can be re-captured if needed.

             This satisfies both 0010 (fixtures are not guessed) and Financial Data Analyst's charter (every
             extracted figure is sourceable, never estimated).

Consequence: Financial Data Analyst's extraction tests validate real extraction paths against real data. A test
             that passes with the Microsoft fixture will see immediately if the parser fails on a
             real instance's structure. The alternative fixtures — the full wire blob or a
             hand-authored guess — are rejected on evidence (0010) and on Invariant 2.2.

             The fixture was authored by Financial Data Analyst reading the wire and trimming, not by a human
             guessing what the XML looks like. The trimming decision is explicit in the file and
             auditable.
