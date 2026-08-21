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

> **Hard limitation. Read this before designing anything on top of it.**
> The companyfacts and companyconcept APIs return **non-dimensional facts only**. Per-segment
> values are absent from them entirely — not sparse, not inconsistent: absent. Any segment work
> must go to the raw XBRL instance or the FilingSummary R-files in the filing archive.

### `https://data.sec.gov/api/xbrl/companyconcept/CIK##########/<taxonomy>/<Tag>.json`
**Used for:** one concept across every period. **Why:** a targeted refresh or a spot check without
pulling the whole facts document, which for a large filer is megabytes. Same non-dimensional
limitation as companyfacts.

### `https://www.sec.gov/Archives/edgar/data/<cik>/<accession>/index.json`
**Used for:** the machine-readable listing of one accession. **Why:** it is how this layer finds
the XBRL instance document, `FilingSummary.xml`, `MetaLinks.json` and the rendered `R*.htm` files
— and how it reports, by name, which of those are missing. An accession without an instance
document is returned as `incomplete-xbrl`, never as an empty result.

**Timing caveat:** EDGAR generates the rendered artifacts *after* acceptance. A listing fetched
minutes after a filing is genuinely incomplete rather than authoritative, which is why the TTL for
this resource stays short for a settling day.

### `https://www.sec.gov/Archives/edgar/data/<cik>/<accession>/<file>`
**Used for:** the documents themselves — the XBRL instance (where dimensional, segment-bearing
contexts live), `FilingSummary.xml`, the R-files, the primary document. **Why:** this is the only
source of segment data, per the limitation above.

Returned as text with its content type and **not parsed**. What the contents mean is Ledger's.

### `https://www.sec.gov/Archives/edgar/daily-index/<YYYY>/QTR<n>/form.<YYYYMMDD>.idx`
**Used for:** everything filed on one day, across all filers. **Why:** refresh scheduling. Polling
every tracked company's submissions document daily costs one request per company; reading the
daily index costs one request total and names exactly which companies filed. Filings appear on
known dates — schedule against them rather than polling.

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
