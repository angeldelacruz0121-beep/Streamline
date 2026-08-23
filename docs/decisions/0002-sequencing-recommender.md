# 0002 — Sequencing is recommended, not automated

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     With nine agents and a wave-based sequence in AGENT-PROTOCOL.md §5, Angel was
             tracking in his head which verdict unblocked which agent and which agents could
             safely run alongside each other. That bookkeeping is error-prone, and getting it
             wrong is expensive in the exact way §5 warns about — starting a downstream agent
             before its contract exists produces work that gets thrown away. Angel asked whether
             the sequence should be automated rather than invoking one agent at a time, giving
             the example of Data Visualization Engineer doing work that strengthens what Financial Data Analyst is building.

Options:     1. Full pipeline automation — a verdict auto-triggers the next agent's plan, which
                auto-triggers the next, with no approval between.
                Tradeoff: fastest, but deletes the Check-in A gate that AGENT-PROTOCOL.md §1
                exists to enforce. A wrong assumption in Financial Data Analyst's model — the highest-consequence
                place in the project, which is why it is pinned to opus — would propagate through
                Software Architect, Data Engineer, and Performance Engineer before Angel ever saw it. The protocol's own stated
                economics ("correcting a plan costs one message; correcting a finished
                implementation costs a day") argue directly against this.
             2. Auto-launch pre-approved batches — Angel approves several plans in one sitting,
                the tooling fires them together.
                Tradeoff: keeps the gate but couples launch to approval, so a plan approved in
                the morning still launches after later context has made it stale.
             3. Recommend, Angel launches — tooling tracks state and reports what is unblocked,
                what is parallel-safe, and what awaits a decision. Angel approves and launches
                each agent individually.
                Tradeoff: one extra human step per agent, which is the point.

Decision:    Option 3. `STATUS.md` holds the dependency graph and current agent state as data;
             a read-only `/next` skill reads it and reports READY NOW / BLOCKED / NEEDS ANGEL.
             `/next` has no Agent tool and no write access — it cannot launch an agent, approve a
             plan, or answer an open decision. AGENT-PROTOCOL.md gains §8 describing the loop.

             Angel's parallel-work example is served without touching the gate: parallelism was
             never limited by file conflicts (every agent's owned paths in §2 are disjoint), only
             by logical dependency. Surfacing that distinction is most of the value.

Consequence: Angel remains in the loop on every agent launch — the cost is one approval per
             agent, deliberately. `STATUS.md` becomes load-bearing: if Technical Writer does not keep it
             current, `/next` recommends against stale state, which is worse than no
             recommendation. Mitigated by making `/next` flag drift when STATUS.md and the
             protocol disagree, and by the protocol remaining authority over STATUS.md's state.

             Forecloses verdict-triggered chaining. If throughput later matters more than the
             gate, that is a new decision record superseding this one — not a quiet change to
             the skill.

             Two pre-existing inconsistencies were found and fixed while encoding the graph:
             Product Analyst was listed only as a release gate in §5 but its own file requires it before
             every feature (now recorded in §8 as both), and §7's pinned-agent counts were stale
             after Art Director was pinned to fable 5.
