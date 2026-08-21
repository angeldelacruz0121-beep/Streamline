# Streamline — Agent Status

Machine-readable state for `/next`. Maintained by **Archivist**, batched at end of working
session (`AGENT-PROTOCOL.md` §7). This file is *state*, not authority — the sequencing rules
themselves live in `AGENT-PROTOCOL.md` §5 and §8. If the two disagree, the protocol wins and this
file is wrong.

`/next` reads this file instead of re-deriving state from git history, which is the §7 principle
applied directly: anything that must survive a context clear lives in a file.

Last updated: 2026-08-20 · by: Angel

---

## 0. Current milestone — the vertical slice

**Microsoft Corporation, FY2026, rendered end to end from EDGAR.** Adopted per
`docs/decisions/0004-vertical-slice-milestone.md`. No new feature surface until it lands.

Gate, and it is binary: **no figure displayed anywhere in the application is invented.**

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
| Segment operating income | $155,237M · consolidated net income $133,700M · trunk constriction carries the $21,537M |

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
| 0 | Project scaffold | Keel | not started |
| 1 | EDGAR ingestion | Conduit | blocked by 0 |
| 2 | Segment extraction | Ledger | blocked by 1 |
| 3 | Derivation methods | Ledger | blocked by 2 |
| 4 | Lake encoding | Cartographer | blocked by 2 |
| 5 | Constriction rendering | Cartographer | blocked by 2 |
| 6 | Performance harness | Forge | gating — do not defer to the end |
| 7 | Fixture and regression | Adversary | gating — do not defer to the end |

---

## 1. Agent state

`Status` is the last verdict received, not a guess at progress.
Valid: `not started` · `in progress` · `COMPLETE` · `PARTIAL` · `BLOCKED`

| Agent | Status | Date | Blocked by | Unblocks |
|---|---|---|---|---|
| Ledger | not started | — | nothing | Keel, Conduit, Cartographer (sync), Adversary |
| Cartographer | not started | — | nothing (core work); D9/D11/D13 for specific encodings | Forge, Adversary |
| Keel | not started | — | Ledger contract; D12 | Forge, Atelier, Adversary |
| Conduit | not started | — | Ledger source interface | Adversary |
| Forge | not started | — | Cartographer scales, Keel types | Adversary |
| Atelier | not started | — | Keel primitives (for components); nothing for tokens | Adversary |
| Adversary | not started | — | anything shippable to test | release gate |
| Advocate | not started | — | nothing — runs BEFORE each feature | every feature-bearing agent |
| Archivist | continuous | — | never blocked | — |

---

## 2. Sequencing graph

Wave order from `AGENT-PROTOCOL.md` §5. `Hard deps` must be COMPLETE (or PARTIAL with the needed
piece landed) before the agent starts. `Soft deps` are better-together, not required.

| Wave | Agent | Hard deps | Soft deps | Notes |
|---|---|---|---|---|
| 0 | Ledger | — | — | Defines the company object. Everything downstream is guesswork until this lands. |
| 0 | Cartographer | — | Ledger | Scales are pure functions of a financial quantity — definable before real data exists, but must agree with Ledger's object shape at the sync point. |
| 0.5 | **SYNC** | Ledger, Cartographer | — | Not an agent. Angel confirms the object shape and the geometry meaning agree before Wave 1 starts. §5: "nothing downstream is real until they agree." |
| 1 | Keel | Ledger | Cartographer | Types contract between pipeline and viz. |
| 1 | Conduit | Ledger | — | Needs Ledger's source *interface*, not its full model. Can start once that interface is defined, even if normalization is unfinished. |
| 2 | Forge | Cartographer, Keel | — | Consumes scales as gospel; never modifies geometry. |
| 2 | Atelier | — (tokens) / Keel (primitives) | — | Gated on Angel's taste approval, not on upstream code. See authority boundary in `atelier.md`. |
| 3 | Adversary | anything shippable | all | Fixtures can be *sourced* earlier; tests need a target. |
| — | Advocate | — | — | **Pre-gate AND release gate.** See §3 below. |
| — | Archivist | — | — | Continuous. Batched at session end. |

### Parallel safety

Every agent's owned paths in §2 of the protocol are **disjoint**, so no two agents can collide on
a file. Parallelism is therefore limited only by logical dependency, never by write conflicts.

The only genuinely shared files are `STREAMLINE-INVARIANTS.md`, `package.json`, and CI config —
all proposal-only, applied by Angel. An agent touching those is escalating, not writing.

---

## 3. Advocate is a pre-gate, not only a release gate

`AGENT-PROTOCOL.md` §5 lists Advocate in the final wave with Adversary. `advocate.md` says: *"Run
the test before build and record the result in `docs/product/`. A feature with no recorded test
does not get built."*

Both are correct; they describe different invocations. Advocate runs:

- **Before** any feature-bearing work — the two-audience test, recorded in `docs/product/`.
- **At release** — alongside Adversary, confirming what shipped still passes.

`/next` therefore surfaces Advocate ahead of any agent about to build a user-facing feature, not
only at the end. Recorded in `AGENT-PROTOCOL.md` §8.

---

## 4. Open decisions blocking work

From `STREAMLINE-INVARIANTS.md` §6. Only Angel answers these. A default existing does **not** mean
an agent may proceed on it — §3 of the protocol is explicit that anything on this table is
escalate-only.

| # | Decision | Blocks | Specific work held |
|---|---|---|---|
| D9 | Growth-to-speed mapping bounds | Cartographer | Flow-speed encoding (Invariant 3.5). Excluded from the slice anyway — needs a validated prior-period comparison. |
| D10 | SIC ranges as a proxy for "tech" | Ledger, Advocate | Coverage test edge cases; how the limit is communicated. Microsoft is SIC 7372, squarely in scope, so the slice is unaffected. |
| D12 | Default period on load (FY / quarter / TTM) | Advocate, Keel | Initial app state, routing defaults. Slice renders one period, so a default is needed before the app has a second. |
| D15 | Which segment-hue set, once color becomes an encoding | Cartographer, Atelier | Any use of color as an encoding. Not needed for the slice. |
| D17 | Third provenance state — reported-and-tagged but filer-allocated | Ledger, Advocate | The analyst detail panel. Slice geometry is unaffected; the figures are still reported and traceable. |
| D18 | Profit-side reconciliation rule | Ledger, Cartographer | Company two. Microsoft's segments sum to operating income exactly; Apple and Oracle do not. |

**Answered:** D1–D8, D11, D13, D14, D16 — settled in Invariant §6 with amendment-log entries, and
not revisited without an amendment.

---

## 5. How to update this file

Archivist rewrites §1 and §4 when recording verdicts and escalation answers. §2 and §3 change only
when `AGENT-PROTOCOL.md` changes — they are a restatement of it, not an independent source.

When a verdict lands: set the agent's `Status` and `Date`, clear what it unblocked from other
agents' `Blocked by`, and update the `Last updated` line.
When Angel answers an open decision: strike it from §4 and note it in the relevant
`docs/decisions/` record.
