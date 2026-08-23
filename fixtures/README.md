# Adversarial corpus

Owned by **QA Engineer** (`AGENT-PROTOCOL.md` §3). Read-only to everyone else.

Every file here is a **verbatim capture from the wire**, taken through the proxy on 8787 so the
User-Agent and the 10/s budget held (Invariant 4.6). Nothing is hand-authored, nothing is edited
after capture. Decision `0010-fixtures-from-wire-not-guessed.md` is the reason: a fixture built
from a guess validates the guess.

Fixtures are **static** — built once, committed, never regenerated, only extended
(`AGENT-PROTOCOL.md` §8). `capture/capture.ts` refuses to overwrite an existing file for exactly
this reason: re-capturing would silently replace a recorded refusal with a later one and destroy
the evidence a finding was filed against.

```
capture/capture.ts    the script that produced everything below; run by hand, never in CI
envelopes/            GET /api/edgar/company/:cik/segments, as the proxy sent it
envelopes/MANIFEST.json  generated: sha256, byte count, envelope kind, view kind per filer
verified/             independent reads of the SAME filing from a SECOND EDGAR path
```

## What this corpus can and cannot prove

`envelopes/` is the **output** of the pipeline. It proves what the product does. It cannot prove
the product is right — a test written only against it would confirm the pipeline agrees with
itself, which is the failure mode this whole role exists to prevent.

`verified/` is the answer to that. Each file is a capture of `companyconcept` for the same
accession the view rendered, which is a different EDGAR endpoint from the XBRL instance the
segments route parses. Two readings of one filing. Where they disagree, the wire wins
(decision `0016`). Approved by Angel as assumption 2 of the A2 plan, with two conditions, both
held: figures are read from the wire directly and never copied out of pipeline output, and each
card states which path it was read from.

## Filer index

Captured 2026-08-22/23. SIC read from the EDGAR submissions record at capture time.
Band = Invariant §1 / D7: SIC 3570–3579 or 7370–7379.

| Ticker | CIK | SIC | Band | Envelope | View arm | Chosen to attack |
|---|---|---|---|---|---|---|
| ADSK | 0000769397 | 7372 | in | view | **renderable** | non-December fiscal year end |
| U | 0001810806 | 7372 | in | view | no-segment-disclosure | negative net earnings |
| SMCI | 0001375365 | 3571 | in | view | no-segment-disclosure | restatement / amendment |
| NOW | 0001373715 | 7372 | in | view | segment-identity-unresolved | single segment |
| SNOW | 0001640147 | 7372 | in | view | segment-identity-unresolved | single segment + loss |
| META | 0001326801 | 7370 | in | view | segment-identity-unresolved | dominant segment |
| GOOGL | 0001652044 | 7370 | in | view | segment-identity-unresolved | dominant segment |
| IBM | 0000051143 | 3570 | in | view | segment-identity-unresolved | segment reclassification |
| ADBE | 0000796343 | 7372 | in | view | segment-identity-unresolved | 52/53-week, non-December |
| CSCO | 0000858877 | 3576 | in | view | segment-identity-unresolved | 52/53-week, non-December |
| AAPL | 0000320193 | 3571 | in | view | segment-identity-unresolved | companion axis, unallocated opex |
| HPQ | 0000047217 | 3570 | in | view | segment-identity-unresolved | twelve-plus segments |
| VYX | 0000070866 | 3578 | in | view | segment-identity-unresolved | twelve-plus segments |
| JKHY | 0000779152 | 7373 | in | view | segment-identity-unresolved | twelve-plus segments |
| DBD | 0000028823 | 3578 | in | view | segment-identity-unresolved | twelve-plus segments |
| SAP | 0001000184 | 7372 | in | **not-found (404)** | — | non-USD reporting currency |
| DOX | 0001062579 | 7371 | in | **not-found (404)** | — | non-USD reporting currency |
| UBER | 0001543151 | 7389 | out | view | out-of-coverage | negative net earnings |
| NVDA | 0001045810 | 3674 | out | view | out-of-coverage | out-of-coverage state |

Microsoft (CIK 0000789019) and Exxon (CIK 0000034088) are **not duplicated here**. Software
Architect captured both at `src/app/sources/fixtures/`, loaded via `tests/infra/company-fixtures.ts`.
Protocol §8 says extend, not duplicate.

## The headline

**Seventeen of the nineteen filers are inside the coverage band. One renders.**

Twelve return `segment-identity-unresolved`, two return `no-segment-disclosure`, two 404 before a
company is built. Counting Microsoft, two of eighteen in-coverage filers render.

The vertical slice is real and Microsoft is genuinely correct. Microsoft is also, on this
evidence, unusual in exactly the way that matters: it tags segment facts on the business-segments
axis with no companion axis at all, and that is what almost nothing else does.

## Standing-set coverage after A2

| Case | Fixture | Reachable? |
|---|---|---|
| Negative net earnings | U, UBER | **No** — U discloses no segments; UBER is out of band |
| Single-segment filer | NOW, SNOW, ADSK | Partly — ADSK renders; NOW and SNOW are refused |
| Segment at 95% of revenue | META, GOOGL | **No** — both refused on companion axes |
| Twelve-plus segments | HPQ, VYX, JKHY, DBD | **No** — all refused; and see the open question below |
| Mid-history reclassification | IBM | **No** — refused on duplicate facts |
| Non-December FYE | ADSK, ADBE, CSCO | Partly — ADSK renders |
| 52/53-week filer | ADBE, CSCO | **No** — both refused |
| Non-USD currency | SAP, DOX | **No** — 404; no foreign private issuer can reach the model |
| Restatement | SMCI | **No** — discloses no segments |
| Amended filing | SMCI | Not yet probed — needs the `/series/10-K` scan (A3) |
| 0.5% reconciliation break | — | Not yet reachable; only ADSK gets far enough to reconcile |
| Ambiguous XBRL tagging | NOW, IBM, and the ten companion-axis filers | **Yes** — this is most of the corpus |
| Out-of-coverage | NVDA, UBER, XOM | **Yes** |

Twelve-plus segments is unresolved for a second reason: no filer in the band was found to have
that many reportable segments, and none of the four candidates got far enough to enumerate. Per
approved assumption 4, nothing is fabricated and the case stays open as an unsigned gap.

## Extending

Add a row to `CORPUS` in `capture/capture.ts`, run `node fixtures/capture/capture.ts --only=<slug>`
with the proxy up, commit the new file and the regenerated manifest. Do not re-capture existing
rows. If a filer's arm changes, that is a finding to argue, not an expectation to edit.
