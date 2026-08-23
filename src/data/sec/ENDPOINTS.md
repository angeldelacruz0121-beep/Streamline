# EDGAR endpoints — what each is for, and what each cannot do

Every URL this project fetches is built in `endpoints.ts`. Nothing else constructs one, and
`transport.ts` is the only module that issues a request. This file records *why* each endpoint is
used, so the next agent picks the right one instead of re-deriving the map from EDGAR's docs.

All of it is unauthenticated public data (Invariant 2.1). No credential is sent, and none is
needed. Two rules govern every call: a descriptive `User-Agent` carrying a real contact email, and
a hard ceiling of 10 requests per second for the whole process (Invariant 4.6). EDGAR answers
**403** to a request without a `User-Agent` — verified against the live service, not inferred.

---

## The endpoints in use

### `https://www.sec.gov/files/company_tickers.json`
**Used for:** ticker → CIK. **Why:** it is one small file covering every listed filer, so one
fetch a week answers every lookup, and a stale mapping self-corrects on the next miss. The
alternative — a search request per lookup — spends rate budget on a question that barely changes.

### `https://data.sec.gov/submissions/CIK##########.json`
**Used for:** the filing index of one company — form types, accession numbers, filing dates,
period of report, acceptance timestamps, XBRL flags. **Why:** it is the only endpoint that lists
what a company filed and when, which is what amendment chains, late-filing notifications and
period-gap detection are read from.

**Field names, verified live 2026-08-20.** The filer's name is `name`. There is **no `entityName`
on this endpoint** — that spelling belongs to companyfacts and companyconcept, and requiring it
here made every live submissions fetch fail as `schema-mismatch` while a hand-written fixture kept
the suite green. The client still exposes the value as `CompanySubmissions.entityName` so one
adapter field means the same thing whichever endpoint it came from. `cik` arrives as a zero-padded
string here and as a bare number on the xbrl APIs.

**`category` is here.** The submissions document carries the filer category verbatim, e.g.
`"Large accelerated filer"`, surfaced as `CompanySubmissions.filerCategory`. That is the input a
filing deadline depends on, so whether a filing is *late* is now answerable — by Ledger, under
Invariant 2.5. This layer passes the category through and still refuses to classify.

**`filings.recent.isXBRLNumeric` is nullable and mostly null** — 946 of 1001 rows on the live
Microsoft index. Columns observed: accessionNumber, filingDate, reportDate, acceptanceDateTime,
act, form, fileNumber, filmNumber, items, core_type, size, isXBRL, isInlineXBRL, isXBRLNumeric,
primaryDocument, primaryDocDescription.

**Caveat that produces a silent gap if ignored:** `filings.recent` holds roughly the most recent
thousand filings. Older history lives in `filings.files[]` overflow documents, which are *not*
fetched by default. `CompanySubmissions.historyTruncated` says so explicitly, and
`getFilingSeries(..., { includeHistory: true })` fetches them at one request per file.

### `https://data.sec.gov/submissions/CIK##########-submissions-###.json`
**Used for:** the older slices named by `filings.files[].name`. **Why:** the only way to see a
filer's full history. Served as the bare columnar object, not wrapped like the main document.

### `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json`
**Used for:** every XBRL fact a company has reported, in one document. **Why:** for consolidated,
entity-level figures it is one request instead of one per filing.

Envelope, verified live 2026-08-20: `{ cik: number, entityName: string, facts: { <taxonomy>:
{ <Tag>: { label, description, units: { <unit>: [{ end, val, accn, fy, fp, form, filed }] } } } } }`.
Taxonomies observed for Microsoft: `dei` and `us-gaap`, 562 us-gaap tags. Conduit does not parse
any of it — the shape is recorded here so Ledger's own boundary is written against an observed
payload rather than an assumed one. Note the endpoint disagrees with submissions about the filer's
own name: `MICROSOFT CORPORATION` here, `MICROSOFT CORP` there.

> **Hard limitation. Read this before designing anything on top of it.**
> The companyfacts and companyconcept APIs return **non-dimensional facts only**. Per-segment
> values are absent from them entirely — not sparse, not inconsistent: absent. Any segment work
> must go to the raw XBRL instance or the FilingSummary R-files in the filing archive.

### `https://data.sec.gov/api/xbrl/companyconcept/CIK##########/<taxonomy>/<Tag>.json`
**Used for:** one concept across every period. **Why:** a targeted refresh or a spot check without
pulling the whole facts document, which for a large filer is megabytes (Microsoft's companyfacts is
4.9 MB, measured 2026-08-20). Same non-dimensional limitation as companyfacts.

Envelope, verified live: `{ cik, taxonomy, tag, label, description, entityName, units }`, with the
same `{ end, val, accn, fy, fp, form, filed }` fact rows.

### `https://www.sec.gov/Archives/edgar/data/<cik>/<accession>/index.json`
**Used for:** the machine-readable listing of one accession. **Why:** it is how this layer finds
the XBRL instance document, `FilingSummary.xml`, `MetaLinks.json` and the rendered `R*.htm` files
— and how it reports, by name, which of those are missing. An accession without an instance
document is returned as `incomplete-xbrl`, never as an empty result.

**Key names, verified live 2026-08-20.** Hyphenated, not camelCase: `directory['parent-dir']` and
`item[]['last-modified']`. `item[].size` is a **decimal string**, and `""` for entries EDGAR does
not size. `item[].type` is an icon file name such as `text.gif`, **not** a form type — nothing
reads it. This endpoint serves JSON under `content-type: text/html`.

**Timing caveat:** EDGAR generates the rendered artifacts *after* acceptance. A listing fetched
minutes after a filing is genuinely incomplete rather than authoritative, which is why the TTL for
this resource stays short for a settling day.

### `https://www.sec.gov/Archives/edgar/data/<cik>/<accession>/<file>`
**Used for:** the documents themselves — the XBRL instance (where dimensional, segment-bearing
contexts live), `FilingSummary.xml`, the R-files, the primary document. **Why:** this is the only
source of segment data, per the limitation above.

Returned as text with its content type and **not parsed**. What the contents mean is Ledger's.

### `https://www.sec.gov/Archives/edgar/daily-index/<YYYY>/QTR<n>/<kind>.<YYYYMMDD>.idx`
**Used for:** everything filed on one day, across all filers. **Why:** refresh scheduling. Polling
every tracked company's submissions document daily costs one request per company; reading the
daily index costs one request total and names exactly which companies filed. Filings appear on
known dates — schedule against them rather than polling.

**Three renderings of the same day, in three different formats.** Verified live against
2026-08-19 on 2026-08-20. This is not cosmetic: treating them alike parsed an 861 KB file into
zero records and reported success.

| `kind` | Format | Columns |
|---|---|---|
| `master` | pipe-delimited | `CIK\|Company Name\|Form Type\|Date Filed\|File Name` |
| `form` | fixed width | form type in columns `[0, 17)`, then company name, CIK, date, file name |
| `company` | fixed width | company name in columns `[0, 62)`, then form type, CIK, date, file name |

**`master` is the default**, because it is the only one whose fields are unambiguously separated.
The other two are supported and tested — `form.idx` truncates a form type to fit its 17-column
field (`SEC STAFF ACTIO`), and `company.idx` carries names up to 60 characters against its
62-column field, so the widths are load-bearing and both boundary cases are pinned in the fixtures.

Dates in the body are `YYYYMMDD` and are normalised to ISO `YYYY-MM-DD` on the way out, so one date
format leaves this layer. A row's own filing date can differ from the index date — a filing
disseminated on the 19th may carry the 17th — and that is kept, not corrected.

A file whose body rows all fail to parse returns `schema-mismatch`. A day on which nothing was
filed returns an empty `ok`. Those are different facts and must not look alike (Invariant 2.2).

---

## Composed reads — `GET /api/edgar/company/:cik/segments`

The eight other proxy routes are one endpoint each. The segments route is the exception: it is the
only place in this project that composes several, because per-segment figures exist at exactly one
of them. Order, and why each call is unavoidable:

| # | Endpoint | Why this one |
|---|---|---|
| 1 | `submissions/CIK##########.json` | Names the filer (SIC, category, tickers) and is the only list of its filings, so it is also how the current 10-K's accession is found. Re-read per request — see below. |
| 2 | *(none — derived)* | The filing series, amendment chains and NT notifications are computed from 1 in `filings.ts`. No second request. |
| 2a | `Archives/.../<amendment>/index.json` | **Only when the period has a 10-K/A.** Does the correction carry an XBRL instance at all? |
| 2b | `Archives/.../<amendment>/FilingSummary.xml` | **Only when the period has a 10-K/A.** EDGAR's index of the rendered reports inside that correction, read for one thing: whether any of them is a financial statement. See "Which filing is read" below. |
| 3 | `Archives/.../<accession>/index.json` | What that accession actually contains. There is no other way to learn the instance document's file name, which is filer-specific (`msft-20260630_htm.xml`). |
| 4 | `Archives/.../<accession>/<instance>_htm.xml` | **The only source of dimensional facts.** `companyfacts` and `companyconcept` carry non-dimensional values only, so neither can answer "revenue for Intelligent Cloud". This is the ~10.9MB document, and decision 0014 keeps it server-side. |
| 5 | `Archives/.../<accession>/MetaLinks.json` | The filer's own labels and presentation. Without it a segment is a member QName, not a name, and naming it from the tag would invent a disclosure the filer did not make. |
| 6 | `Archives/.../<accession>/R###.htm` | The rendered segment schedule, read for label wording and ordering only. Skipped when 5 does not point at one. |

Four or five requests per cold company; zero on a warm repeat. 3 through 6 are accessioned bytes and
are cached immutably, so the recurring cost is 1 alone — and that one is usually a cache hit inside
its own lifetime.

**Which filing is read — original or correction.** A filer that finds a mistake files a `10-K/A`
against the same period, and from 2026-08-23 the correction is what Streamline reads: it carries the
numbers the filer stands behind. The rule is "the newest filing for the period that actually carries
a financial-statement exhibit", and the qualifier is not caution, it is the shape of real filings.
HP's FY2019 correction (`0001206774-20-000632`) renders exactly one report and it is the cover page;
its base taxonomy is `dei` only. Reading it as authoritative would blank a year that is currently
right. HP's FY2022 correction (`0000047217-23-000075`) renders 145, seven of them statements, and it
must supersede. The submissions flags cannot tell those apart — cover-page tagging has been mandatory
since 2019, so both are `isInlineXBRL: 1` — which is why 2a and 2b exist. A correction that is passed
over is reported in the response, never dropped. If 2a or 2b cannot be read, the route refuses rather
than serving the superseded original. Rule and reasoning in `authoritative.ts`.

**What this costs.** Nothing for a period with no correction, which is every filer in the corpus
today: 2a and 2b are not issued at all. A period with a correction costs those two once, against
accessioned bytes that are then cached forever.

**Why 1 is re-read on every request.** The built view is cached against the accession it came from
and never expires, which is only safe because the route asks *which accession is current* again each
time. That question is answered by the submissions index on its own lifetime (1h during acceptance
hours), so a newly filed 10-K appears when EDGAR says it exists rather than when a derived cache
happens to expire. Concurrent requests coalesce so a burst still asks once. Full reasoning in
`../cache/TTL-POLICY.md`.

---

## Known, documented, deliberately not implemented in v1

### Full-text search — `https://efts.sec.gov/LATEST/search-index?q=...`
This is the backend behind <https://www.sec.gov/search-filings> and EDGAR full text search. That
page *is* EDGAR, so using it later changes nothing about Invariant 2.1.

**It is the intended path for company lookup when the company switcher is built.** A user types a
company name, not a CIK, and `company_tickers.json` only matches on ticker and exact registered
title. When that feature is specified, this is the endpoint to add — a resource kind in
`errors.ts`, a URL builder here, a TTL entry (query results are not documents; roughly an hour),
and a route in the proxy. It is unimplemented now because nothing in the current scope needs it,
not because it was overlooked.

### XBRL frames — `https://data.sec.gov/api/xbrl/frames/<taxonomy>/<Tag>/<unit>/CY####Q#.json`
One concept, one period, across every filer. The natural fit for peer comparison. Same
non-dimensional limitation. Unimplemented for the same reason: nothing needs it yet.

---

## Endpoints deliberately avoided

`https://www.sec.gov/cgi-bin/browse-edgar` — the legacy HTML/RSS interface. Everything it offers is
available as JSON from the endpoints above, and scraping HTML would make this layer break on a
cosmetic change to a page.
