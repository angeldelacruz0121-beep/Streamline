# 0011 — Data Engineer Workstream 1: known gaps and forward notes

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     Data Engineer's Workstream 1 (EDGAR ingestion, 137 tests, live EDGAR verified) is COMPLETE.
             A vertical slice can be rendered. Six gaps and forward notes surfaced during this work,
             each understood, deferred, and recorded here so they are not rediscovered and re-argued.

Known gaps:

**1. Ingestion verified against one clean filer only.**
   Microsoft Corporation has zero amendments and zero late filings in 33 years of EDGAR history,
   so three test paths remain synthetic: incomplete-XBRL handling, amendment chains, and late-
   notification processing. Before Financial Data Analyst's ingestion is considered proven in the field, a second
   audit is needed against (a) a filer with a real 10-K/A amending a prior 10-K, and (b) a filer
   with an incomplete XBRL exhibit requiring fallback to non-XBRL source documents.
   **Blocks nothing.** The slice cannot exercise these paths, and the test suite covers them
   synthetically. The second filer becomes the generalisation-phase validation, after the three-
   company test mentioned in 0004's consequence note.

**2. Canvas rendering is untestable in jsdom; Performance Engineer will need Playwright.**
   Vitest's jsdom environment cannot test Canvas rendering. Performance Engineer's render-correctness work
   requires browser mode and Playwright, which is an unapproved future dependency escalation (not
   covered by 0008's dependency approval). When Performance Engineer needs to test rendering, this requires an
   Angel approval before Playwright is added.
   **Blocks nothing.** The slice uses only Performance Engineer's geometry algorithms; rendering is Data Visualization Engineer's
   next phase.

**3. Rate limiter is per-process; clustered Node needs escalation.**
   Data Engineer implements the 10 request/second limit as an in-memory counter per process. A second
   Node worker or process gets its own independent budget. Before Streamline runs as a cluster
   or behind a load balancer, the rate limiter must move to a shared store (Redis, etcd, or a
   coordinator service), which is a scaling escalation requiring Angel approval.
   **Blocks nothing.** The slice runs on one process.

**4. filerCategory is newly surfaced and unblocks Invariant 2.5 late-filing classification.**
   Decision 0005 (filings.ts line 49) noted that filer category was not available in the
   submissions index and marked late-filing classification as impossible. The category IS present
   (in the submissions document field `category`), and Data Engineer now surfaces it as part of
   `CompanySubmissions.filerCategory`. The comment in filings.ts has been corrected, and Invariant
   2.5's classification rule is no longer blocked by data availability. **Financial Data Analyst must be told
   explicitly** — this was a standing reason for a deferred design question, and the deferral is
   now lifted.
   **Unblocks Financial Data Analyst's Invariant 2.5 work.** Financial Data Analyst can now distinguish late filings once it
   implements the classification logic.

**5. 30fps performance floor is assumed, not measured.**
   Invariant 4.1 requires "interactive responsiveness at 30 fps minimum." The implementation will
   change substantially before final polish (especially once rendering moves from synthetic data to
   real geometries), so measurement was deliberately deferred. When Performance Engineer's rendering is complete,
   Performance Engineer and Angel will measure actual frame rates against the 30 fps assumption.
   **Blocks nothing.** This is a measurement task, not a gate on feature work.

**6. No visual encoding has been observed.**
   All geometry reasoning so far — lake area, basin depth, constriction widths — is theoretical.
   No human has yet opened the application and seen it render. Data Visualization Engineer's lake encoding is
   next; when it ships, Angel and someone outside the project should verify that the encoded
   geometry matches its intended reading. This is not a correctness issue (the math is sound), but
   a communication issue — the visual *should* read as intended, and that is not checkable without
   eyes. This is why Invariant 3.6 exists: "the visual should surprise no one." Measured against
   reality, not by reasoning.
   **Blocks nothing.** The slice will answer this question when its lake is rendered.

Decision:    All six gaps are accepted as expected and non-blocking. None forecloses a required
             path. Each is flagged here so future readers find them by searching, rather than
             re-discovering them through trial.

Consequence: Data Engineer's work is COMPLETE. Workstream 2 (segment extraction, Financial Data Analyst) is now
             unblocked, though it must start with a sync conversation with Data Visualization Engineer to agree
             on object shape (per AGENT-PROTOCOL.md §5 and STATUS.md §3).
             
             Gap 4 is an explicit unblock: Invariant 2.5's standing blocker no longer applies.
             Financial Data Analyst should confirm that filerCategory is what it needs for late-filing
             classification; if so, the feature becomes available immediately once Financial Data Analyst's
             segment extraction is integrated.
