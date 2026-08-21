# 0008 — Test ownership, and the approved dependency set

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     Keel's Workstream 0 plan surfaced two decisions Angel had to make before any code
             could be written: a gap in the ownership rules, and the project's full third-party
             dependency set (an escalation under AGENT-PROTOCOL.md §3).

             The ownership gap: §2 assigns `tests/` to Adversary and states that agents write only
             inside owned paths. Read literally, no agent could write a test for its own code. That
             collides with almost every agent's definition of done — Conduit's gate is "tests prove
             both controls cannot be bypassed", Ledger's requires a failing test proving
             reconciliation catches a broken sum — so as written, every agent would block on
             Adversary before it could report anything finished.

Options:     1. Keep §2 literal — all tests in `tests/`, only Adversary writes them.
                Tradeoff: one clean ownership line and Adversary sees all coverage. But it makes
                Adversary a bottleneck on every other agent's completion, and agents would report
                verdicts on work they had not themselves verified, which is precisely what the
                verdict format exists to prevent.
             2. Colocated tests belong to the source owner; `tests/` and `fixtures/` stay
                Adversary's.
                Tradeoff: two places tests can live, requiring the convention to be written down —
                but each agent can prove its own work, and Adversary keeps the independent check.

Decision:    Option 2. A test colocated with its source belongs to whoever owns that source.
             `tests/` and `fixtures/` remain entirely Adversary's, holding the standing adversarial
             set and the release gate. `tests/infra/` is Keel's shared harness.

             The distinction that matters: colocated tests are an agent checking its own work;
             Adversary is the check that does not report to the thing being checked. Both exist, and
             the second is not weakened by the first.

             **Dependency set approved in full** (all versions verified present on npm before
             approval, since the plan pinned exact versions and a hallucinated one would have failed
             the install):

             Runtime — `react` 19.2.8, `react-dom` 19.2.8, `zod` 4.4.3.
             Dev — `typescript` 7.0.2, `vite` 8.2.2, `@vitejs/plugin-react` 6.1.0, `vitest` 4.1.11,
             `jsdom` 30.0.1, `@testing-library/react` 16.3.2, `@testing-library/dom` 10.4.1,
             `@types/react` 19.2.18, `@types/react-dom` 19.2.4, `@types/node` 26.2.0,
             `prettier` 3.9.6.

             Two justifications worth preserving. Zod is not a convenience: Invariant 4.3 requires a
             runtime schema check at the pipeline boundary, and inferring the TypeScript type from
             the schema means the type and the check cannot silently diverge, which a hand-rolled
             validator cannot guarantee. Vitest is not a default: its fake timers are what make
             Conduit's 10 requests/second control testable without wall-clock waits.

             Explicitly not added, and why, so they are not re-proposed: `react-router` (a
             discriminated route union gives compile-time exhaustiveness over the five non-success
             states; a route table does not), `msw`/`nock` (an injected transport seam plus
             `node:http` covers it), any state library, `eslint` (deferred until a rule earns it),
             `canvas`/`node-canvas` (native build, and there is no Homebrew on this machine).

Consequence: AGENT-PROTOCOL.md §2 amended with the tests paragraph. Every agent may now write
             colocated tests, and no agent may treat `tests/` or `fixtures/` as its own.

             Flagged forward, not pre-approved: canvas rendering cannot be tested in jsdom, so
             Forge's render-correctness work will require browser mode and Playwright. That is a
             future dependency escalation and is not authorised by this record.
