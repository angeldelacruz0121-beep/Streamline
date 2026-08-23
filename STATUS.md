# Streamline — Agent Status

Machine-readable state for `/next`. Maintained by **Technical Writer**, batched at end of working
session (`AGENT-PROTOCOL.md` §8). This file is *state*, not authority — the sequencing rules
themselves live in `AGENT-PROTOCOL.md` §6 and §9. If the two disagree, the protocol wins and this
file is wrong.

`/next` reads this file instead of re-deriving state from git history, which is the §8 principle
applied directly: anything that must survive a context clear lives in a file.

Last updated: 2026-08-23 · by: Technical Writer

---

## 0. Current milestone — the vertical slice

**Microsoft Corporation, FY2026, rendered end to end from EDGAR.** Adopted per
`docs/decisions/0004-vertical-slice-milestone.md`. No new feature surface until it lands.

Gate, and it is binary: **no figure displayed anywhere in the application is invented.**

⚠ **CORRECTION NOTICE (2026-08-21):** The consolidated net income and trunk residual figures
below were initially wrong and have been corrected. The discovery and process lesson are
recorded in `docs/decisions/0016-slice-figures-corrected-process-lesson.md`. The wire values
(Invariant 2.2) are authoritative. See amendments to decisions 0005 and 0007.

Verified target (checked against EDGAR directly, then re-verified adversarially — do not re-derive):

| Fact | Value |
|---|---|
| CIK | 0000789019 |
| Accession | 0001193125-26-323660 |
| Filed | 2026-07-29 · period end 2026-06-30 (FY2026 = 2025-07-01 → 2026-06-30) |
| SIC | 7372 — inside D7's 7370–7379 band |
| Segment axis | `us-gaap:StatementBusinessSegmentsAxis` |
| Members | `msft:` namespace, not `us-gaap:` — enumerate at parse time, cross-check `us-gaap:NumberOfReportableSegments` (3) |
| Measures per segment | revenue, cost of revenue, operating expenses, operating income |
| Segment operating income | $155,237M · consolidated net income $133,749M · trunk constriction carries the $21,488M |

Three constraints that shape implementation:

- **The convenience API cannot see segment data.** `companyfacts` / `companyconcept` return only
  non-dimensional facts. Segment extraction must parse the raw XBRL instance or FilingSummary
  R-files.
- **Note numbers are unstable** — Note 18 in FY2026/FY2025, Note 19 in FY2024. Key off the axis or
  FilingSummary role ID `995637`.
- **EDGAR returns HTTP 403 without a User-Agent.** Invariant 4.6 is empirically confirmed.

Workstream sequence (report §7, plus the scaffold it omitted):

| # | Workstream | Owner | State |
|---|---|---|---|
| 0 | Project scaffold | Software Architect | COMPLETE |
| 1 | EDGAR ingestion | Data Engineer | COMPLETE |
| 2 | Segment extraction | Financial Data Analyst | COMPLETE |
| 3 | Derivation methods | Financial Data Analyst | COMPLETE |
| 4 | Lake encoding | Data Visualization Engineer | COMPLETE |
| 5 | Constriction rendering | Data Visualization Engineer | COMPLETE |
| 6 | Performance harness | Performance Engineer | COMPLETE |
| 7 | Fixture and regression | QA Engineer | not started |

---

## 1. Agent state

`Status` is the last verdict received, not a guess at progress.
Valid: `not started` · `in progress` · `COMPLETE` · `PARTIAL` · `BLOCKED`

| Agent | Status | Date | Blocked by | Unblocks |
|---|---|---|---|---|
| Financial Data Analyst | COMPLETE | 2026-08-20 | — | Data Visualization Engineer (sync), QA Engineer, Data Engineer (new route task) |
| Data Visualization Engineer | COMPLETE | 2026-08-21 | — | Performance Engineer, QA Engineer |
| Software Architect | COMPLETE | 2026-08-20 | — | Performance Engineer, Art Director, QA Engineer |
| Data Engineer | COMPLETE | 2026-08-23 | — | QA Engineer (has new follow-on: GET /api/edgar/company/:cik/segments route); accession now supports 10-K/A |
| Performance Engineer | COMPLETE | 2026-08-21 | — | QA Engineer |
| Art Director | COMPLETE | 2026-08-21 | — | QA Engineer |
| QA Engineer | not started | — | anything shippable to test | release gate |
| Product Analyst | PARTIAL | 2026-08-20 | D10, D12 (Q3 first-run spec unwritten) | every feature-bearing agent |
| Technical Writer | continuous | — | never blocked | — |
| DevOps Engineer | not started | — | — | CI and deployment infrastructure |
| Reliability Engineer | not started | — | — | observability and runbooks |

---

## 2. Sequencing graph

Wave order from `AGENT-PROTOCOL.md` §5. `Hard deps` must be COMPLETE (or PARTIAL with the needed
piece landed) before the agent starts. `Soft deps` are better-together, not required.

| Wave | Agent | Hard deps | Soft deps | Notes |
|---|---|---|---|---|
| 0 | Financial Data Analyst | — | — | Defines the company object. Everything downstream is guesswork until this lands. |
| 0 | Data Visualization Engineer | — | Financial Data Analyst | Scales are pure functions of a financial quantity — definable before real data exists, but must agree with Financial Data Analyst's object shape at the sync point. |
| 0.5 | **SYNC** | Financial Data Analyst, Data Visualization Engineer | — | Not an agent. Angel confirms the object shape and the geometry meaning agree before Wave 1 starts. §6: "nothing downstream is real until they agree." |
| 1 | Software Architect | Financial Data Analyst | Data Visualization Engineer | Types contract between pipeline and viz. |
| 1 | Data Engineer | Financial Data Analyst | — | Needs Financial Data Analyst's source *interface*, not its full model. Can start once that interface is defined, even if normalization is unfinished. |
| 2 | Performance Engineer | Data Visualization Engineer, Software Architect | — | Consumes scales as gospel; never modifies geometry. |
| 2 | Art Director | — (tokens) / Software Architect (primitives) | — | Gated on Angel's taste approval, not on upstream code. See authority boundary in `art-director.md`. |
| 2 | DevOps Engineer | — | — | Establishes CI and deployment path early. Not deferred to the end. |
| 3 | Reliability Engineer | — | — | Stood up before anything is shown to a person outside the project. |
| 3 | QA Engineer | anything shippable | all | Fixtures can be *sourced* earlier; tests need a target. |
| — | Product Analyst | — | — | **Pre-gate AND release gate.** See §3 below. |
| — | Technical Writer | — | — | Continuous. Batched at session end. |

### Parallel safety

Every agent's owned paths in §2 of the protocol are **disjoint**, so no two agents can collide on
a file. Parallelism is therefore limited only by logical dependency, never by write conflicts.

The only genuinely shared files are `STREAMLINE-INVARIANTS.md`, `package.json`, and CI config —
all proposal-only, applied by Angel. An agent touching those is escalating, not writing.

---

## 3. Product Analyst is a pre-gate, not only a release gate

`AGENT-PROTOCOL.md` §6 lists Product Analyst in the final wave with QA Engineer. `product-analyst.md` says: *"Run
the test before build and record the result in `docs/product/`. A feature with no recorded test
does not get built."*

Both are correct; they describe different invocations. Product Analyst runs:

- **Before** any feature-bearing work — the two-audience test, recorded in `docs/product/`.
- **At release** — alongside QA Engineer, confirming what shipped still passes.

`/next` therefore surfaces Product Analyst ahead of any agent about to build a user-facing feature, not
only at the end. Recorded in `AGENT-PROTOCOL.md` §9.

---

## 4. Open decisions blocking work

From `STREAMLINE-INVARIANTS.md` §6. Only Angel answers these. A default existing does **not** mean
an agent may proceed on it — §3 of the protocol is explicit that anything on this table is
escalate-only.

| # | Decision | Blocks | Specific work held |
|---|---|---|---|
| D9 | Growth-to-speed mapping bounds | Data Visualization Engineer | Flow-speed encoding (Invariant 3.5). Excluded from the slice anyway — needs a validated prior-period comparison. |
| D10 | SIC ranges as a proxy for "tech" | Financial Data Analyst, Product Analyst | Coverage test edge cases; how the limit is communicated. Microsoft is SIC 7372, squarely in scope, so the slice is unaffected. |
| D12 | Default period on load (FY / quarter / TTM) | Product Analyst, Software Architect | Initial app state, routing defaults. Deferred by design; route held at #/company/:cik with no period segment (0023). (docs/decisions/0023-d12-deferred-by-design-route-held.md) |
| D15 | Which segment-hue set, once color becomes an encoding | Data Visualization Engineer, Art Director | Any use of color as an encoding. Not needed for the slice. Guard widened: one shared fill, saturation ≤10%, zero per-segment variation (0022). (docs/decisions/0022-d15-guard-widened-shared-fill-saturation.md) |
| D17 | Third provenance state — reported-and-tagged but filer-allocated | Financial Data Analyst, Product Analyst | The analyst detail panel. Slice geometry is unaffected; the figures are still reported and traceable. |
| D18 | Profit-side reconciliation rule | Financial Data Analyst, Data Visualization Engineer | Company two. Microsoft's segments sum to operating income exactly; Apple and Oracle do not. |
| Q2 | Trunk widening when residual is positive | Data Visualization Engineer, Performance Engineer | Encoding behavior for net income > segment operating income. Not exercised by the slice; Apple and Oracle surface it. (docs/decisions/0018-q2-trunk-positive-residual.md) |
| Q3 | First-run experience specification | Product Analyst | Unwritten; blocked by D10 and D12. Empty-state IA and company selection can proceed. (docs/decisions/0019-q3-first-run-experience.md) |
| Q4 | Net vs. decomposed rendering of trunk residual | Data Visualization Engineer | Tax expense hidden in netting: $32,185M true cost vs. $21,488M net. Angel's direction (0031): tax gets its own surface, not folded into pinch. Option 3 (annotated pinch) for slice; option 2 (decomposed) at company two. (docs/decisions/0020-q4-trunk-net-vs-decomposed.md) |

**Answered:** D1–D8, D11 (docs/decisions/0005-d11-filer-shaped-constrictions.md), D13 (docs/decisions/0006-d13-basin-area-encodes.md), D14, D16 (docs/decisions/0007-d16-trunk-constriction.md), Q1 (docs/decisions/0017-q1-river-lake-junction-geometry.md), 0028–0031, 0034, 0035 (docs/decisions/0035-the-lake-is-the-company-as-a-whole.md — the lake **is the company as a whole**; net earnings is its magnitude, not its meaning. Invariants §1 and 3.3 amended 2026-08-23; no geometry change, binding on copy and the analyst detail panel) — settled in `docs/decisions/` with full reasoning, and not revisited without amendment.

**PENDING:** 0032 (Meta loss-making segment geometry) — Angel researching before ruling. Three options on the table with rider conditions. (docs/decisions/0032-meta-loss-making-segment-three-options-pending.md)

**RECORDED, UNBUILT:** 0033 (visual direction: vertical orientation, evocative water not diagram), 0034 (clickable correction detail).

**STANDING CONSTRAINT** (0030): Technology sector only (SIC 3570–3579, 3674, 7370–7379). NO new companies added to the working set without Angel's explicit authorization. Microsoft is the target; other filers are regression checks only.

**Known gaps and open items (not blocking work, but visible on screen or in backlog):**
- Label-placement solver unbuilt (most visible flaw on current screen)
- voice.md unseeded (all copy slots open; design system waiting for voice direction)
- Terminus caption + overdraw shortfall placement (Art Director + Angel; copy phase)

**Current renderable state:** Six filers return renderable DATA from EDGAR pipeline (Microsoft, Apple, NVIDIA, HP, Autodesk, Meta). Meta's data layer is correct; drawing layer refuses to render pending 0032 decision.

**Open hand-offs (three):**
1. **QA Engineer:** fixtures/README.md wrongly assigns amendment case to Super Micro (no 10-K/A); HP has three real amendments of three different shapes. 15 of 19 captured envelopes no longer match current pipeline output because of other agents' fixes.
2. **Software Architect and Art Director:** the new `filing` block (0028's metadata) is available and unrendered.
3. **Financial Data Analyst:** the accession handed to ingestAnnualSegments can now be a 10-K/A (0028 implementation complete).

---

## 5. How to update this file

Technical Writer rewrites §1 and §4 when recording verdicts and escalation answers. §2 and §3 change only
when `AGENT-PROTOCOL.md` changes — they are a restatement of it, not an independent source.

When a verdict lands: set the agent's `Status` and `Date`, clear what it unblocked from other
agents' `Blocked by`, and update the `Last updated` line.
When Angel answers an open decision: strike it from §4 and note it in the relevant
`docs/decisions/` record.

---

## 6. Infrastructure notes

**Development server:** Vite runs on port 5180 (not 5173, which is a different project, Gridiron).
**EDGAR proxy:** Runs on port 8787 — verify dev tests target this port, not another instance.

**Test suite:** Data Engineer suite passes 1032; 83 files; typecheck and prettier clean (2026-08-23).
