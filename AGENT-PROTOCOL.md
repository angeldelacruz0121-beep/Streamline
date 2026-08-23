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
needs a different set of fields — Art Director's `PROPOSAL` (see `art-director.md`) is one. A variant is
still a Check-in B: work stops, Angel decides, the agent does not proceed on its own
recommendation. It is not a fourth check-in.

## 2. The team

| Role | Invoke as | What they do |
|---|---|---|
| Financial Data Analyst | `financial-analyst` | Every number is real, sourced, correctly labelled |
| Data Visualization Engineer | `viz-engineer` | The picture tells the truth the numbers tell |
| Data Engineer | `data-engineer` | Pulls filings from SEC EDGAR and caches them |
| Software Architect | `software-architect` | Structure that survives change |
| Performance Engineer | `performance-engineer` | Smooth, never choppy |
| Art Director | `art-director` | How it looks and how it moves |
| QA Engineer | `qa-engineer` | Breaks it before a user does |
| Product Analyst | `product-analyst` | Whether a feature earns its place |
| DevOps Engineer | `devops-engineer` | Ships it, and can undo a bad ship |
| Reliability Engineer | `reliability-engineer` | Says something is wrong before a user does |
| Technical Writer | `technical-writer` | Records why every decision was made |

## 3. File ownership

Agents write only inside owned paths. Cross-boundary changes are requested, not made.

| Agent | Owns |
|---|---|
| Financial Data Analyst | `src/data/model/`, `src/data/normalize/`, `src/data/validate/` |
| Data Engineer | `server/`, `src/data/sec/`, `src/data/cache/` |
| Software Architect | `src/app/`, `src/state/`, `src/types/`, build and test config |
| Data Visualization Engineer | `src/viz/encoding/`, `src/viz/scales/` |
| Performance Engineer | `src/viz/render/`, `src/viz/particles/`, perf harness |
| Art Director | `src/styles/`, `src/design/tokens/`, `src/components/primitives/` |
| QA Engineer | `tests/`, `fixtures/` — read-only elsewhere |
| Product Analyst | `docs/product/` — read-only elsewhere |
| Technical Writer | `docs/decisions/` — read-only elsewhere |
| DevOps Engineer | `.github/`, `infra/`, `scripts/`, deployment and CI config |
| Reliability Engineer | `src/observability/`, `server/monitoring/`, `docs/runbooks/` |

Shared files (`STREAMLINE-INVARIANTS.md`, `package.json`, CI config): proposal only, Angel
applies.

**Tests.** An agent writes the tests for its own code. A test file colocated with its source —
`src/data/sec/client.test.ts` beside `client.ts` — belongs to whoever owns that source. Without
this, no agent could satisfy its own definition of done, since most gates are stated as tests, and
every agent would block on QA Engineer before it could report anything finished. An agent that
cannot verify its own work does not produce a trustworthy verdict.

This does not weaken QA Engineer. `tests/` and `fixtures/` remain entirely its own, holding the
standing adversarial set and the release gate, and it still judges every agent's work
independently. Colocated tests are an agent checking its own work; QA Engineer is the check that does
not report to the thing being checked. `tests/infra/` is Software Architect's shared harness.

## 4. Escalation triggers — never decided alone

Anything on the open-decisions table.

Any taste call: color, motion character, typographic voice, copy tone. Agents implement taste;
they do not originate it. Art Director proposes, Angel approves.

Any tradeoff between accuracy and appearance. Always escalate, never resolve.

Any change requiring an invariant amendment.

Any new third-party dependency.

Any case where the honest answer is "the metaphor doesn't work here." That is a product finding
and goes straight to Angel.

**Any decision that would be expensive to reverse later, even if it falls
entirely within your owned paths and requires no product judgment.** Data
model shape, state architecture, ownership of geometry, storage format,
framework or platform choice, and anything else that becomes load bearing.
These do not feel like escalations — they feel like implementation — which
is exactly why they must be raised.

State it as an ESCALATION with an added line:

    Reversible: yes | costly | no

If costly or no, explain in plain language what it locks in and what would
have to change to undo it. Angel has strong domain knowledge in finance
and markets and none in software architecture. Write the consequence in
terms he can evaluate — "adding a second data source later would mean
rewriting the visualization layer" rather than "this couples the adapter
to the renderer." Never assume a decision is too technical to be worth his
time; assume instead that it has been explained badly.

## 5. Artifact rule

Every invocation ends in an artifact: a diff, a file, or a written verdict citing specific line
numbers. An agent that returns only an opinion has failed its invocation.

## 6. Sequencing

Financial Data Analyst and Data Visualization Engineer define the model and the scales first. Nothing downstream is real until
they agree on the shape of a company object and what its geometry means. Then Software Architect and Data Engineer
build to that contract in parallel. Then Performance Engineer and Art Director hold the line during implementation.
Then QA Engineer and Product Analyst gate release. Technical Writer runs continuously.

The DevOps Engineer establishes CI and the deployment path early rather
than at the end. The Reliability Engineer is stood up before anything is
shown to a person outside the project.

## 7. Angel's standing role

Angel sets vision, answers escalations, approves plans, and makes every taste and product call.
Angel does not review implementation detail unless a verdict reports PARTIAL or a known gap.
Agents earn autonomy by escalating honestly and lose it by guessing.

## 8. Token discipline

Quality is the constraint; efficiency is the objective under it. Never trade a correct result for
a cheaper one. Do trade a wasteful path for an equivalent one.

**Model assignment.** Four agents are pinned. The other seven inherit the session default, so
Angel controls their cost at the session level rather than having it fixed in a file.

| Agent | Model | Reason |
|---|---|---|
| Financial Data Analyst | opus (pinned) | Defines what "correct" means. XBRL segment ambiguity produces silent errors that propagate everywhere downstream. Low volume, high consequence — this is insurance, not speed. |
| Data Visualization Engineer | opus (pinned) | Same reason. Scale math and the misreading test determine whether the picture is honest. |
| Technical Writer | haiku (pinned) | Transcription into a fixed template. No larger model produces a better record. |
| Performance Engineer | inherit | Measure-fix loop; works well at default. |
| Software Architect | inherit | Raise to opus manually for the type contract and initial architecture, then let it fall back. |
| Data Engineer | inherit | HTTP, caching, backoff. Low ambiguity. |
| Art Director | fable 5 (pinned) | Generative visual range pays off here. Bounded by the authority boundary in its agent file — proposes direction, never adopts it. |
| QA Engineer | inherit | Highest-volume task in the project — fixtures and tests. |
| Product Analyst | inherit | Judgment work but tiny output; raise manually when the call is genuinely close. |
| DevOps Engineer | inherit | Configuration and pipeline work; well-trodden ground. |
| Reliability Engineer | inherit | Instrumentation and runbooks; raise manually when designing alert thresholds. |

Pinning an agent to opus makes it consume opus capacity regardless of the session setting, which
can exhaust a budget mid-session without warning. Only Financial Data Analyst and Data Visualization Engineer are worth that
risk. The other two pins carry no such cost: Technical Writer pins *down* to haiku, and Art Director's fable
pin draws on a separate capacity, not the opus budget.

**Escalate the model, not the guess.** If an agent iterates three times on one task without
converging, that is a signal the task needs a stronger model, not a fourth attempt. Stop and say
so in a verdict. Three failed cheap passes cost more than one clean expensive pass.

**Read narrowly.** Load only the paths you own plus the specific files named in the task. Never
read the repo to orient yourself. If you do not know which file matters, ask — one question is
cheaper than a survey.

**Plan approval is the largest saving.** Every implementation killed at Check-in A is a full
generation never paid for. Plans stay short: the format in §1, nothing more.

**Fixtures are static.** QA Engineer builds each fixture once and commits it. Fixtures are never
regenerated, only extended.

**Technical Writer batches.** Run at the end of a working session over the session's decisions, not after
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

## 9. Sequencing and the `/next` loop

`STATUS.md` holds the current state of §6 as data: each agent's last verdict, its unmet
dependencies, and which open decisions hold which specific work. Technical Writer maintains it on the
same batched cadence as decision records.

`/next` reads that file and recommends what is launchable now, what can run alongside it, and what
is waiting on Angel. **It recommends; Angel launches.** It cannot start an agent, approve a plan,
or answer an open decision — every agent it names still owes a Check-in A plan first. The gate in
§1 is the reason this protocol exists and automation does not get to route around it.

Two clarifications the graph depends on:

**Product Analyst is a pre-gate as well as a release gate.** §6 lists it in the final wave; `product-analyst.md`
requires the two-audience test *before* a feature is built. Both hold — it runs ahead of any
feature-bearing work and again at release. `/next` surfaces it in both positions.

**Parallelism is bounded by dependency, not by file conflict.** Every agent's owned paths in §3
are disjoint, so no two agents can collide on a file. The only shared files are proposal-only. So
the question is never "can these two run together safely" — it is only "does one need the other's
output first."
