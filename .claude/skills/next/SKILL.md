---
name: next
description: Recommends which Streamline agent to launch next and what can safely run in parallel, based on the dependency graph in STATUS.md. Read-only — it never launches an agent, approves a plan, or writes to any file. Use at the start of a working session, after any agent returns a verdict, or whenever Angel asks what to work on, what is unblocked, what can run in parallel, or what is waiting on him.
allowed-tools: Read, Grep, Glob
---

# /next — sequencing recommender

## What this is

Angel picks the work; this tells him what is *eligible*. It answers three questions:
what can start now, what cannot and why, and what is waiting on a decision only he can make.

**It recommends. It does not launch.** Every agent it names still owes a Check-in A plan before
writing any code (`AGENT-PROTOCOL.md` §1). This skill exists to remove bookkeeping, not the
approval gate.

## Do not

- Launch an agent, or use the Agent tool. Naming an agent is the output; invoking it is Angel's call.
- Write, edit, or create any file — including `STATUS.md`. Archivist owns that.
- Answer an open decision, or treat a listed default as an answer. §3 of the protocol is explicit:
  anything on the open-decisions table is escalate-only, default or not.
- Re-derive state from git log or by reading `src/`. `STATUS.md` is the source. If it looks stale,
  say so rather than working around it.

## Procedure

1. Read `STATUS.md` (all sections) and `AGENT-PROTOCOL.md` §5.
   If `STATUS.md` and the protocol disagree, the protocol wins — flag the drift in the output.
2. For each agent in §1 of `STATUS.md`, classify:
   - **READY** — status is `not started` or `PARTIAL`, and every hard dep in §2 is `COMPLETE` (or
     `PARTIAL` with the needed piece landed), and no open decision in §4 blocks the *specific*
     work available.
   - **BLOCKED** — a hard dep is unmet, or an open decision holds all of its available work.
   - **DONE** — status is `COMPLETE` with no follow-on work.
3. Note the partial case explicitly. An agent can be READY for some work and BLOCKED on other
   work — Cartographer with D9 open is the standing example: the lake-area scale is launchable,
   the flow-speed scale is not. Say which, do not collapse it to one label.
4. Check the Wave 0.5 **SYNC** gate. If Ledger and Cartographer are both COMPLETE but the sync has
   not happened, that gate is the recommendation — not Wave 1.
5. Surface **Advocate ahead of any feature-bearing agent** (§3 of `STATUS.md`), not only at release.
6. Rank READY items by wave, then by how much downstream work each unblocks (the `Unblocks` column).
7. All agents' owned paths are disjoint, so any two READY agents are parallel-safe. Say so
   affirmatively rather than making Angel check.

## Output format

Keep it scannable. No preamble, no restating the protocol.

```
READY NOW
  • <Agent> — <the specific task, with the invariant or contract it serves>
    Depends on: <dep> ✓ (VERDICT <date>)   |   Depends on: nothing
    Note: <only if there is a real caveat>

  • <Agent> — <task>
    ...

  These are parallel-safe with each other (disjoint owned paths).

BLOCKED
  • <Agent> — waiting on <specific thing>, not <vague area>

NEEDS ANGEL
  • <D#> <decision> — blocks <the specific work, not the whole agent>

NEXT GATE
  • <the SYNC gate, or a release gate, if one is the real next step>
```

Close with one line: each item still needs its Check-in A plan approved before code.

## Judgment notes

**Name the task, not just the agent.** "Cartographer" is not a recommendation. "Cartographer —
lake area encoding, Invariant 3.3, currently a static ellipse" is.

**Blockers must be specific.** "Blocked on Ledger" is useless. "Blocked on Ledger's source
interface — Conduit needs the shape to build transport against, not the full normalization" tells
Angel exactly what to ask for.

**Two READY agents is usually the right answer.** More than three at once and Angel is
context-switching, which §7 warns costs more than model choice. If many are eligible, recommend
the two that unblock the most and say the rest are available.

**When nothing is READY**, the honest output is the gate or decision that is holding everything,
not a padded list. That is a useful answer, not a failure.
