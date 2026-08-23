# Streamline

**A company's annual earnings, drawn as water.**

Each reportable business segment is a river whose width is its revenue. Every cost that filer
actually discloses for that segment cuts a notch into it. The rivers merge into a single trunk,
one final shared constriction carries tax and non-operating items, and what survives collects as
the lake.

**The lake is the company as a whole** — the one element on the canvas that stands for the entire
filer rather than a piece of it. The rivers are the parts of the business; the lake is the company
those parts add up to. The quantity it carries is consolidated net earnings, but net earnings is
its magnitude, not its meaning. A loss renders as a drained basin, not as an absence of revenue.

The binding promise, and the gate every release is measured against:

> **No figure displayed anywhere in the application is invented.**

Every number on screen traces to a tagged fact in a filing on SEC EDGAR. Where the data cannot
support a render, the application refuses in a designed state and says why — it never approximates,
never fills a template, and never draws a shape it cannot source.

Two audiences, served at once: a beginner reads the shape in five seconds; an analyst clicks
through to the reported figures and their source. The quality bar is a Bloomberg terminal, not an
infographic.

---

## Scope

Deliberately narrow, and the narrowness is enforced, not incidental:

| | |
|---|---|
| **Sector** | Technology only — SIC 3570–3579, 3674, 7370–7379. Anything outside renders an explicit out-of-coverage state. |
| **Filings** | Annual reports (10-K, and 10-K/A amendments) only. Quarterly was considered and rejected — annual filings carry far more segment detail. |
| **Working set** | Microsoft is the target. Other filers exist as regression checks. No company is added without explicit authorization. |
| **Milestone** | Microsoft FY2026 (CIK `0000789019`, accession `0001193125-26-323660`) rendered end to end from EDGAR. No new feature surface until it lands. |

Recorded in `docs/decisions/0029`, `0030`, and `0004`.

---

## Current state

The vertical slice is built through the renderer; QA, CI and observability are not yet stood up.

**Working:** EDGAR transport with rate limiting and an on-disk cache · segment extraction from the
raw XBRL instance · derivation and reconciliation · the encoding layer (river width, filer-shaped
constrictions, trunk, lake area, drained basin) · canvas renderer with a measured performance
harness · design tokens and primitives · the app shell, with every failure mode as a designed
surface rather than a caught exception.

**Verified:** 1032 tests across 83 files pass; `typecheck` and `format:check` are clean
(2026-08-23).

**Six filers return renderable data** from the live pipeline: Microsoft, Apple, NVIDIA, HP,
Autodesk, Meta. Meta's data layer is correct but the drawing layer deliberately refuses to render
it — its loss-making segment has no approved geometry yet (`docs/decisions/0032`, pending).

**Not started:** QA fixture regression suite, CI and deployment, observability and runbooks.

**Known gaps, visible or in backlog:**

- The label-placement solver is unbuilt — the most visible flaw on the current screen.
- Copy voice is unseeded, so every copy slot is still open.
- 15 of the 19 captured fixture envelopes no longer match current pipeline output.
- The visual direction Angel asked for — vertical orientation, water that reads as water rather
  than as a diagram — is recorded (`docs/decisions/0033`) and unbuilt.

`STATUS.md` is the live, authoritative version of this section.

---

## Running it

**Requirements:** Node ≥ 24. No global tooling; everything is a local dependency.

### 1. Install

```bash
npm install
```

### 2. Set a contact address

SEC EDGAR returns HTTP 403 to any request without a descriptive `User-Agent` containing a real
contact email. There is no default and no fallback — with this unset, constructing the EDGAR client
throws and the proxy refuses to start.

```bash
cp .env.example .env
```

Then fill in `SEC_CONTACT_EMAIL` with a monitored address. `.env` is gitignored; no address is ever
committed (`docs/decisions/0009`).

### 3. Start the EDGAR proxy

```bash
npm run server
```

Listens on `http://127.0.0.1:8787`. It is the only process that talks to sec.gov: the browser
cannot, because a custom `User-Agent` triggers a CORS preflight EDGAR does not answer, and a page
cannot hold one process-wide rate budget. Responses cache to `.cache/edgar`; derived segment views
cache separately to `.cache/segments`, so retiring a derived view never costs a re-download of a
10 MB instance.

### 4. Start the app

```bash
npm run dev -- --port 5180
```

Vite proxies `/api/edgar` to `127.0.0.1:8787`. Then open a filer by CIK:

```
http://localhost:5180/#/company/0000789019
```

> **On the port.** `vite.config.ts` pins no port, so plain `npm run dev` takes Vite's default 5173
> — which collides with a different project on this machine. `STATUS.md` §6 specifies 5180, hence
> the flag above. The flag and the doc are the only things holding that convention; the config
> does not.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (pass `-- --port 5180`) |
| `npm run server` | EDGAR proxy on 8787 |
| `npm run build` | Production build to `dist/`, with sourcemaps |
| `npm run preview` | Serve the built output |
| `npm test` | Full Vitest suite, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` over both the app and the Node projects |
| `npm run format` / `format:check` | Prettier write / verify |

The performance gate runs under Playwright from `src/viz/render/perf/` and is not wired into
`npm test`.

---

## The proxy API

Nine named resources plus a health check, GET only. There is no URL parameter that names an upstream path — each route
names one resource, so a caller cannot aim the proxy at arbitrary EDGAR URLs.

```
GET /api/edgar/health
GET /api/edgar/ticker/:ticker
GET /api/edgar/company/:cik/submissions
GET /api/edgar/company/:cik/facts
GET /api/edgar/company/:cik/concept/:taxonomy/:tag
GET /api/edgar/company/:cik/series/:form
GET /api/edgar/company/:cik/segments        # runs the full extraction pipeline; 10-K only
GET /api/edgar/filing/:cik/:accession/index
GET /api/edgar/filing/:cik/:accession/document/:file
GET /api/edgar/daily/:date
```

`/segments` is the heavy one: it returns a validated `CompanyView`, not a raw EDGAR payload.
`CompanyView` is a union of one success arm and five refusals — `out-of-coverage`,
`segment-identity-unresolved`, `reconciliation-break`, `incomplete-filing`, `no-segment-disclosure`
— each of which has a surface in the UI. Adding an arm without a surface is a compile error, not a
blank screen.

Two constraints worth knowing before touching the pipeline: EDGAR's convenience API
(`companyfacts` / `companyconcept`) **cannot see segment data** at all — it returns only
non-dimensional facts, so segments come from parsing the raw XBRL instance. And note numbers are
unstable across years, so extraction keys off the segment axis, never off a note number.

---

## Layout

```
src/
  app/            shell, routing surfaces, the HTTP source
  data/
    sec/          EDGAR client, transport, rate limit, backoff, schemas, endpoints
    normalize/    XBRL instance parsing, segment contexts, facts, labels, fiscal periods
    model/        the company object, figures, periods, source refs, derivations
    validate/     schema, coverage, reconciliation
    cache/        TTL policy keyed to the filing calendar
  viz/
    scales/       dollars → geometry (width, area, depth) — the quantitative claim
    encoding/     river, trunk, lake, segment cap, composition
    render/       canvas renderer, layout, hit-testing, degradation, perf harness
    particles/    flow field and density
  design/tokens/  the design system's tokens, guarded by tests
  state/          route, company store, canvas adapter
  types/          branded types, boundaries, exhaustiveness
server/           the EDGAR proxy, its file cache and extraction fingerprint
tests/            adversarial suites and shared test infrastructure
fixtures/         wire-captured corpus (envelopes + independent verifications)
docs/decisions/   every decision, with its reasoning and alternatives
reference/        the retired canvas prototype — reference only, never the foundation
```

Type sits next to the code it types; tests sit next to the code they test.

---

## How work is governed

This project is built by a team of named agents under a written protocol, not ad hoc.

| File | Role |
|---|---|
| `STREAMLINE-INVARIANTS.md` | **The constitution.** Product definition, data truth rules, encoding rules, engineering rules, aesthetic, open decisions. Only Angel amends it. |
| `AGENT-PROTOCOL.md` | **The law.** Three check-ins (plan → escalate → verdict), file ownership, escalation triggers, sequencing, token discipline. |
| `STATUS.md` | **The state.** What is complete, what is blocked, what is waiting on a ruling. State only — where it disagrees with the protocol, the protocol wins. |
| `DESIGN.md` | The binding visual brief, derived from measured references. |
| `docs/decisions/` | Numbered decision records — the reasoning, not just the outcome. |
| `.claude/agents/` | The eleven agent definitions and their owned paths. |

Start a session with `/next`, which reads `STATUS.md` and reports what is unblocked, what can run
in parallel, and what is waiting on a human ruling. It recommends only.

Every agent's owned paths are disjoint, so parallelism is limited by logical dependency, never by
write conflicts. The genuinely shared files — the invariants, `package.json`, CI config — are
proposal-only: an agent touching them is escalating, not writing.

Nothing is guessed. Taste calls, accuracy-versus-appearance tradeoffs, and anything on the open
decisions table escalate rather than resolve themselves.

### The standing lesson

`docs/decisions/0016` records the one that cost the most: displayed figures were once wrong because
a summary said "do not re-derive" and was believed. **Read the filing itself.** Never trust a
summary, and never trust the application's own output as evidence that the application is right —
that is why `fixtures/verified/` reads the same filing from a second, independent EDGAR path.

---

## License

Private. Not licensed for distribution.
