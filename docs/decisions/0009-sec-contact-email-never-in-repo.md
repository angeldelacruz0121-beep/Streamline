# 0009 — The SEC contact email never enters the repository

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     Invariant 4.6 requires a descriptive User-Agent containing a real contact email on
             every EDGAR request, enforced in code rather than by convention. Conduit's Workstream 1
             plan proposed hardcoding Angel's personal address as a fail-closed constant, and
             correctly flagged the exposure question rather than proceeding quietly.

             Two facts established before deciding. The GitHub repository is **public**. And Angel's
             personal address is **not currently in it** — the commit history uses a
             hostname-derived local address (`angeldelacruzgomez@MacBook-Pro.local`), not his real
             one. Hardcoding would therefore have been a new and permanent exposure on a public
             repo, not a marginal addition to something already leaked. Git history is effectively
             unscrubbable once pushed, and public repositories are routinely harvested for
             addresses.

             Angel's instruction was direct: "I don't want to implement my email in anything right
             now."

             He also proposed https://www.sec.gov/search-filings as an alternative source. It is
             not an alternative — that page IS EDGAR's search front end, its own links pointing at
             `edgar/search/` and Full Text Search. Verified live: its backing endpoint returns HTTP
             403 without a User-Agent and 200 with one. The requirement is a property of SEC access,
             not of a particular URL, so Invariant 2.1 and 4.6 are both unchanged.

Options:     1. Hardcode the personal address as a constant.
                Tradeoff: zero configuration and impossible to forget, but publishes a personal
                address permanently to a public repo and its history.
             2. Hardcode a dedicated project address.
                Tradeoff: keeps the personal address private and stays zero-config, but requires
                creating and monitoring another mailbox, and still publishes an address.
             3. Require it from the environment, failing closed when absent.
                Tradeoff: the address never enters the repo in any form, and 4.6 stays enforced in
                code because a missing variable throws rather than degrading to a non-compliant
                request. Costs one local setup step before live data can be pulled.

Decision:    Option 3, and the variable is left **unset** for now.

             `SEC_CONTACT_EMAIL` is the only source — not a default with an override, since a
             default is a hardcoded address by another name. The User-Agent is composed at startup
             and throws if the variable is missing or not RFC-shaped, with a message naming the
             variable and why SEC requires it. `.env` and `.env.*` are gitignored; a `.env.example`
             ships the key with an empty value and no address.

             The entire test suite must pass with the variable unset. Conduit's design already
             delivers this — zero live EDGAR requests in tests, everything against a local
             `node:http` double — so nothing is blocked by leaving it empty.

Consequence: **Standing constraint for every agent, not just Conduit: no email address, personal or
             otherwise, is committed to this repository in any file, default, fixture, or comment.**

             Live EDGAR data cannot be pulled until Angel sets the variable locally. That is
             deliberate and is not a blocker for Workstreams 1 through 3, which are testable against
             the double. It becomes a real gate the first time the application must retrieve an
             actual filing, and the failure at that point is loud and self-explaining rather than a
             silent 403.

**Resolved, 2026-08-20.** Angel created a dedicated address for the project rather than using his
personal one — the outcome this record was written to make possible, and the one SEC's own guidance
models (its published sample is a role address, `AdminContact@<company>.com`, not an individual's).
It is set in a gitignored `.env`, mode 600, and appears in no tracked file.

Verified the same day: the first live request this project has made to SEC returned HTTP 200 and
the expected filing — `0001193125-26-323660`, Microsoft Corp, SIC 7372 — confirming the coverage
test in Invariant §1 against production rather than against a fixture. Known gap 5 in Conduit's
Workstream 1 verdict ("zero live EDGAR verification") is closed.

Two things a future reader should not have to rediscover. SEC's policy page phrases the header as
*"please declare your user agent"*, but it is enforced in practice — the same endpoint returns 403
without one and 200 with one, measured. And SEC publishes historical EDGAR access-log datasets with
partially anonymised IPs; whether User-Agent strings appear in them was **not** established. That
unresolved question is a further argument for the dedicated address over a personal one, and should
be treated as unknown rather than assumed private.

             Noted, not decided: full-text search is the natural path for finding a company by name
             rather than by CIK. Deliberately unimplemented in v1, since the vertical slice already
             knows its target accession. It becomes relevant when the company switcher is built,
             which report §6 places after the three-company generalisation phase.
