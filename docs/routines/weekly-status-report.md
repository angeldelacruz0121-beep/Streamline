# Weekly Status Report — Routine

Runs every Monday at 07:00 as a Claude Code Desktop local routine, with the folder set to this
repository and the worktree toggle OFF so the report reads actual working state including
uncommitted changes.

To create it: open a Claude Code Desktop session in this repo and say "set up a weekly project
status report every Monday at 7am", then supply the prompt below. Or use Routines in the sidebar
→ New routine → Local.

`reports/` must exist before the first run.

---

## Routine prompt

Produce a weekly project status report for Streamline as a PDF.

Read, in this order:

- `STREAMLINE-INVARIANTS.md` — current invariants and the open decisions table
- `AGENT-PROTOCOL.md` — ownership map
- `docs/decisions/` — all records, noting any added in the last 7 days
- `docs/product/` — Product Analyst's two-audience tests and kill list
- `git log --since="last Monday" --stat`
- Test results and any performance harness output, including the full frame-time distribution
- Any open items or gaps recorded in verdicts
- `reports/` — read the most recent prior report and open with what changed since it

Write the report in the voice of a delivery lead reporting to the product owner. Corporate
register, prose over bullets, no praise, no filler.

Structure:

1. Executive summary with an overall RAG status and the reasoning behind it
2. Progress this period — what shipped, tied to the workstreams in the delivery plan
3. Decision register — resolved this week, and what remains open
4. Risk register — carried forward with any change in impact or likelihood, plus anything new
5. Blockers and decisions required from the product owner, with a deadline for each
6. Recommendation for the coming week

Rules:

- State status honestly. If nothing shipped, say so and say why.
- Never infer progress from commit volume. Commits are not verdicts.
- Where a source file is missing or empty, report the gap rather than filling it with
  assumption. An empty `docs/decisions/` means the protocol is not being followed and is
  reported as a finding, not omitted.
- Explicitly note any decision flagged as required in the last report that still has no answer,
  and state how many consecutive reports it has been outstanding. A decision unanswered across
  three reports is escalated in the executive summary.
- Report frame-time percentiles, never averages alone.
- Every claim traces to a file or a commit.

Save to `reports/Streamline_Status_YYYY-MM-DD.pdf`.

---

## Why this exists

The report can only read what is on disk. That makes it a forcing function: Technical Writer's decision
records, QA Engineer's test results and Performance Engineer's performance output stop being optional and become
the report's raw material. A thin report is itself the signal that the protocol is not being
followed.
