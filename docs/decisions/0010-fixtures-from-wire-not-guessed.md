# 0010 — Test fixtures are captured from live responses, never guessed

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     Conduit's Workstream 1 suite achieved 120 of 120 passing tests while five structural
             defects lay dormant in the schemas and the envelope parsing logic. The defects were
             invisible because the test fixtures had been hand-authored from the same assumptions
             the schemas encoded. A fixture written from a guess validates the guess, not the
             service. The defects only surfaced when Angel asked whether there was a live demo to
             run, and the very first real request failed immediately.

             The five defects, each proven to exist in the real wire format:
             (1) Submissions use `name`, not `entityName` — the schema was wrong.
             (2) `isXBRLNumeric` is nullable and null in 946 of 1001 rows — the schema was
                 optional-blind.
             (3) Filer `category` IS present in submissions, contradicting a code comment claiming
                 it was unavailable (it was available, just not exploited). The comment has been
                 corrected.
             (4) The archive index uses hyphenated keys `parent-dir` and `last-modified`. Because
                 the schema fields were optional, mismatches never failed — they simply never
                 matched, which is worse than failing.
             (5) Worst: only master.idx is pipe-delimited; form.idx and company.idx are
                 fixed-width-tabular. An 861 KB daily form index parsed to zero records and
                 returned kind "ok", the silent gap Invariant 2.2 exists to forbid.

             A fixture built from a guess validates the guess. A fixture built from the wire
             cannot agree with an incorrect schema.

Options:     1. Keep hand-authored fixtures; improve schema inference.
                Tradeoff: faster to write initially; will fail identically the next time a new
                EDGAR endpoint is added, because the testing apparatus has not actually seen the
                wire.
             2. Capture every fixture from a live response; test file-under-test against
                captured data.
                Tradeoff: slower to author initially, but the fixture proves the schema against
                reality, and a parser that produces zero results from a non-empty payload fails
                loudly rather than returning ok.

Decision:    Option 2, standing for every agent that touches an external service.

             **Fixture capture**: Every schema in src/data/sec/schemas.ts that receives an external
             envelope — submissions, archive index, daily index, company tickers, anything else SEC
             sends — is tested against a fixture captured from a live EDGAR response. The fixture
             is a real response, trimmed of fields not load-bearing to the schema or parsing logic,
             never recomposed from what the schema expects.

             Invariant 4.5 still holds: test fixtures carry no financial figures. Metadata — byte
             sizes, film numbers, row counts, identifiers, dates, file names — are real because
             they must be to test parsing; figures and amounts remain absent.

             **Parser error gate**: A parser or parser composition that receives a non-empty
             payload must distinguish success from silence. If a parse produces zero records from
             a non-empty input, the result is not kind "ok" — it is an error with a message
             naming the defect. This is what Invariant 2.2 exists to enforce: "no silent drops"
             is a statement about code paths, not about ideal cases. The form.idx defect cost
             this — a function that returned `{ records: [], malformedRows: 0 }` and kind "ok"
             dropped 861 KB and reported no loss.

             `FilingRecordSet` and every parser composition must distinguish the case where a
             non-empty input yields no records. The distinction is the function's job, not the
             caller's.

Consequence: Conduit's `src/data/sec/__fixtures__/microsoft.ts` and `shape-probes.ts` are
             re-sourced from live EDGAR responses, with hand-composition eliminated. The test
             suite in `schemas.test.ts` now asserts field names by name (e.g., "takes the filer
             name from submissions.name, not submissions.entityName") rather than by absence of
             complaint.

             This standing rule applies to every agent that integrates an external service:
             Ledger (if consuming an alternative data source), Cartographer (if pulling visual
             assets), Forge (if rendering depends on environment or browser APIs), Atelier (if
             using external design systems), Adversary (if targeting external accessibility
             services), and Advocate (if the audience is external). Every fixture is captured,
             never guessed.

             The fix closed a known gap that Conduit's 2026-08-20 verdict noted: "zero live EDGAR
             verification." The first live request now passes, and the five schema defects are
             proven to have existed and been corrected.

**Resolved, 2026-08-20.** Fixtures updated to captured form. All 120 tests still pass. Live
EDGAR request to data.sec.gov/submissions/CIK0000789019.json succeeds.
