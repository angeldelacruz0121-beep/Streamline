# Streamline — Agent Protocol

Angel oversees. Agents execute.

## 1. The three check-ins

Agents do not report progress. Progress reports are noise. Agents check in at exactly three
moments.

**A — Plan, before writing code.** Correcting a plan costs one message; correcting a finished
implementation costs a day.

    PLAN — <agent>
    Task:        <one line>
    Files:       <exact paths, create/modify>
    Approach:    <3–5 sentences>
    Assumptions: <numbered; each one Angel could reject>
    Blocked by:  <open decisions, or none>
    Estimate:    <small / medium / large>

**B — Escalation, mid-work.** Fired the moment the agent hits a decision it is not authorized to
make. Work stops. The agent does not guess and continue.

    ESCALATION — <agent>
    Decision:  <the question, answerable in one sentence>
    Options:   <2–3 concrete options with the tradeoff of each>
    Recommend: <the agent's pick and why>
    Impact:    <what is blocked until answered>

**C — Verdict, on completion.** Not "done." A verdict against the definition of done, with
evidence.

    VERDICT — <agent>
    Status:      COMPLETE / PARTIAL / BLOCKED
    Files:       <paths changed, with line counts>
    DoD:         <each item, PASS/FAIL, with evidence>
    Invariants:  <which invariants this touches, how compliance was verified>
    Known gaps:  <honest list; "none" is rarely true>
    Next:        <what this unblocks>

*Specialized escalations.* An agent may define a named variant of Check-in B where its domain
needs a different set of fields — Atelier's `PROPOSAL` (see `atelier.md`) is one. A variant is
still a Check-in B: work stops, Angel decides, the agent does not proceed on its own
recommendation. It is not a fourth check-in.

## 2. File ownership

Agents write only inside owned paths. Cross-boundary changes are requested, not made.

| Agent | Owns |
|---|---|
| Ledger | `src/data/model/`, `src/data/normalize/`, `src/data/validate/` |
| Conduit | `server/`, `src/data/sec/`, `src/data/cache/` |
| Keel | `src/app/`, `src/state/`, `src/types/`, build and test config |
| Cartographer | `src/viz/encoding/`, `src/viz/scales/` |
| Forge | `src/viz/render/`, `src/viz/particles/`, perf harness |
| Atelier | `src/styles/`, `src/design/tokens/`, `src/components/primitives/` |
| Adversary | `tests/`, `fixtures/` — read-only elsewhere |
| Advocate | `docs/product/` — read-only elsewhere |
| Archivist | `docs/decisions/` — read-only elsewhere |

Shared files (`STREAMLINE-INVARIANTS.md`, `package.json`, CI config): proposal only, Angel
applies.

## 3. Escalation triggers — never decided alone

Anything on the open-decisions table.

Any taste call: color, motion character, typographic voice, copy tone. Agents implement taste;
they do not originate it. Atelier proposes, Angel approves.

Any tradeoff between accuracy and appearance. Always escalate, never resolve.

Any change requiring an invariant amendment.

Any new third-party dependency.

Any case where the honest answer is "the metaphor doesn't work here." That is a product finding
and goes straight to Angel.

## 4. Artifact rule

Every invocation ends in an artifact: a diff, a file, or a written verdict citing specific line
numbers. An agent that returns only an opinion has failed its invocation.

## 5. Sequencing

Ledger and Cartographer define the model and the scales first. Nothing downstream is real until
they agree on the shape of a company object and what its geometry means. Then Keel and Conduit
build to that contract in parallel. Then Forge and Atelier hold the line during implementation.
Then Adversary and Advocate gate release. Archivist runs continuously.

## 6. Angel's standing role

Angel sets vision, answers escalations, approves plans, and makes every taste and product call.
Angel does not review implementation detail unless a verdict reports PARTIAL or a known gap.
Agents earn autonomy by escalating honestly and lose it by guessing.

## 7. Token discipline

Quality is the constraint; efficiency is the objective under it. Never trade a correct result for
a cheaper one. Do trade a wasteful path for an equivalent one.

**Model assignment.** Four agents are pinned. The other five inherit the session default, so
Angel controls their cost at the session level rather than having it fixed in a file.

| Agent | Model | Reason |
|---|---|---|
| Ledger | opus (pinned) | Defines what "correct" means. XBRL segment ambiguity produces silent errors that propagate everywhere downstream. Low volume, high consequence — this is insurance, not speed. |
| Cartographer | opus (pinned) | Same reason. Scale math and the misreading test determine whether the picture is honest. |
| Archivist | haiku (pinned) | Transcription into a fixed template. No larger model produces a better record. |
| Forge | inherit | Measure-fix loop; works well at default. |
| Keel | inherit | Raise to opus manually for the type contract and initial architecture, then let it fall back. |
| Conduit | inherit | HTTP, caching, backoff. Low ambiguity. |
| Atelier | fable 5 (pinned) | Generative visual range pays off here. Bounded by the authority boundary in its agent file — proposes direction, never adopts it. |
| Adversary | inherit | Highest-volume task in the project — fixtures and tests. |
| Advocate | inherit | Judgment work but tiny output; raise manually when the call is genuinely close. |

Pinning an agent to opus makes it consume opus capacity regardless of the session setting, which
can exhaust a budget mid-session without warning. Only Ledger and Cartographer are worth that
risk. The other two pins carry no such cost: Archivist pins *down* to haiku, and Atelier's fable
pin draws on a separate capacity, not the opus budget.

**Escalate the model, not the guess.** If an agent iterates three times on one task without
converging, that is a signal the task needs a stronger model, not a fourth attempt. Stop and say
so in a verdict. Three failed cheap passes cost more than one clean expensive pass.

**Read narrowly.** Load only the paths you own plus the specific files named in the task. Never
read the repo to orient yourself. If you do not know which file matters, ask — one question is
cheaper than a survey.

**Plan approval is the largest saving.** Every implementation killed at Check-in A is a full
generation never paid for. Plans stay short: the format in §1, nothing more.

**Fixtures are static.** Adversary builds each fixture once and commits it. Fixtures are never
regenerated, only extended.

**Archivist batches.** Run at the end of a working session over the session's decisions, not after
each one. Same output, a fraction of the invocations.

**No restatement.** Do not summarize the invariants, recap the task, or narrate what you are about
to do. Verdicts cite line numbers instead of reproducing code.

**Context is the dominant cost, not model choice.** Every turn re-sends the whole session. A long
session pays for its entire history on every message, which compounds faster than any model
downgrade can offset. Clear context between unrelated tasks — finishing an encoding and moving to
ingestion is a hard reset, not a continuation. Prefer one agent per session. When an agent starts
forgetting earlier decisions, reset rather than re-explaining.

This is why the decision records matter: anything written to `docs/decisions/` survives a context
clear, and anything living only in conversation history does not.
