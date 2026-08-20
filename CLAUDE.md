## Streamline — working rules

Before any task, read `STREAMLINE-INVARIANTS.md` and `AGENT-PROTOCOL.md`.

Start a working session with `/next` rather than picking an agent from memory — it reads
`STATUS.md` and reports what is unblocked, what runs in parallel, and what is waiting on Angel.
It recommends only; every agent it names still owes a Check-in A plan before writing code.

Delegate to the agent that owns the affected paths. Never write outside your owned paths;
request cross-boundary changes instead of making them.

Follow the three-check-in protocol: plan before code, escalate mid-work rather than guessing,
verdict against the definition of done on completion.

Never guess on an open decision, a taste call, or an accuracy-versus-appearance tradeoff.
Escalate to Angel.

Every invocation ends in an artifact — a diff, a file, or a written verdict citing line numbers.

Read only your owned paths plus files named in the task. Do not survey the repo to orient
yourself. Do not restate the invariants or recap the task before working.

If you iterate three times on one task without converging, stop and report that the task needs a
stronger model rather than attempting a fourth pass.
