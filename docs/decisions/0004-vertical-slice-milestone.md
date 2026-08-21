# 0004 — The vertical slice is the first milestone

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     The status report of 20 August 2026 rated the project AMBER with the headline finding
             that "the prototype renders convincingly but is driven entirely by fabricated data. No
             component of the system has yet been exercised against a real SEC filing." Its §10.1
             carried three recommendations at Immediate priority, of which this is the first. The
             question was whether to extend the prototype's feature surface or to prove the pipeline
             end to end on one real filer.

Options:     1. Extend the prototype — add the lake area encoding, constrictions, and a company
                switcher against the existing fabricated dataset.
                Tradeoff: presents as fast progress, but every addition rests on assumptions no
                filing has tested. Segment extraction, scale legibility at real proportions,
                reconciliation tolerance and cost attribution all remain guesses, and each becomes
                more expensive to correct the more is built on it.
             2. Vertical slice — one real company from EDGAR through to a responsive lake, adding
                no new feature surface until that works.
                Tradeoff: slower to look impressive; the value is the assumptions it destroys
                rather than the feature it produces.

Decision:    Option 2. The binding condition is quoted from report §5.2 and is deliberately binary:

               "No figure displayed anywhere in the application is invented."

             Definition of launched: a person other than Angel can open the application, see the
             subject filer's most recent fiscal year as rivers feeding a lake whose area is set by
             actual reported net income, observe each river visibly constricting at its cost
             points, click any river or constriction to see the reported figure with its accession
             number, form type, fiscal period and XBRL tag, and verify every figure against the
             Form 10-K in under two minutes.

             Scope exclusions carried from report §6, each with its earliest sensible point: company
             switcher (after three-company generalisation), multi-year history (after a break-marker
             fixture exists), flow-speed growth encoding (after the single-period slice is stable),
             negative-earnings basin (generalisation phase, company two — the subject filer is
             profitable and cannot exercise it), sectors beyond technology (post-launch, one at a
             time), mobile layout (after encodings are frozen).

             A generalisation phase follows immediately: an unprofitable technology filer to
             exercise the drained basin, and a single-segment filer to exercise the sparse case. If
             the system survives three companies the foundation is sound; if it does not, the defect
             surfaces at three rather than at thirty.

Consequence: Advocate now has an explicit list to enforce, and any proposal from the exclusion list
             is refused by reference to this record rather than re-argued. Forecloses feature work
             until the slice is complete.

             A gap in the report is corrected here: its §7 workstream table begins at EDGAR
             ingestion, but the repository has no project to ingest into — no package.json, no
             TypeScript configuration, no test runner. Conduit's gate requires tests, so a Keel
             scaffold workstream precedes it. See 0007's consequence note.
