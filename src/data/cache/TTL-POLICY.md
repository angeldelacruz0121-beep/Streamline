# Cache TTLs — every lifetime, and the reason for it

Lifetimes are tied to the filing calendar, not to round numbers. The governing distinction:
**accessioned bytes are immutable; indexes are not.** EDGAR accepts filings 06:00–22:00 Eastern on
business days, so outside that window an index physically cannot change and a cached copy cannot
go stale.

The machine-readable version of this table is `TTL_REASONS` in `ttl-policy.ts`, and
`ttl-policy.test.ts` fails if any resource kind loses its reason. Each cached entry carries its
reason with it, so a value can always explain why it was trusted.

| Resource | Lifetime | Reason |
|---|---|---|
| `Archives/.../<accession>/<file>` | **Immutable** | Accessioned bytes never change. A correction is a new accession, not an edit to an old one. |
| `Archives/.../<accession>/index.json` | 1h for a settling day, then **immutable** | EDGAR generates the R-files, `MetaLinks.json` and `Financial_Report.xlsx` after acceptance, so a listing read minutes after a filing is incomplete rather than final. Settles within a day. |
| `submissions/CIK##########.json` | 1h during acceptance hours; 6h outside them on a business day; 24h weekends and holidays | An index, not a document: it changes the moment the filer files. Nothing can be accepted outside the window, so a longer lifetime then is free. |
| `submissions/...-submissions-###.json` | 7 days | Older slices change only when the recent block overflows — a multi-month event for any filer. |
| `api/xbrl/companyfacts/...` | 24 hours | Derived from disseminated XBRL: it changes only when the filer files. |
| `api/xbrl/companyconcept/...` | 24 hours | Same underlying data, narrower slice. |
| `files/company_tickers.json` | 7 days | Regenerated roughly daily; a ticker↔CIK mapping changes rarely and a stale miss self-corrects on the next lookup. |
| `daily-index/.../<kind>.<past day>.idx` | **Immutable** | The day is closed. Nothing can be added to it. |
| `daily-index/.../<kind>.<today>.idx` | 15 minutes during acceptance hours; otherwise until the next open | The day is still filling. Outside the window it cannot fill, so the entry lives exactly until EDGAR can next accept a filing. |
| Any 404 | 1 hour | A missing period or a missing exhibit is a real state worth remembering, but short enough to notice a late filing. |
| Built segment view (`streamline:segments/fp1/<code-fingerprint>/<cik>/<form>/<accession>/<period-filings>`) | **Immutable** | Not an EDGAR resource — a `CompanyView` derived from one accession by `server/segments-cache.ts`. Deterministic over accessioned bytes *and the code that read them*, so it inherits their immutability only as long as both are in the key: hence the fingerprint and the period's filing set. The route re-resolves which filing is authoritative on every request, so a new 10-K or a new correction appears on the submissions lifetime above rather than behind this entry. |

Two refinements to the approved table, both strictly more conservative, both to avoid caching
something that can still change:

1. **`index.json` is not immutable on its filing day.** Treating it as immutable would permanently
   cache a listing taken before EDGAR finished generating the filing's rendered artifacts, and the
   filing would look like it had no XBRL forever.
2. **Submissions overflow files get their own entry** (7 days) rather than inheriting the
   submissions lifetime, because they are historical slices rather than the live index.

## The derived view cache

One entry in the table above is not an EDGAR URL. `GET /api/edgar/company/:cik/segments` runs four
or five requests and then parses a ~50MB uncompressed XBRL instance to build one `CompanyView`. The
raw bytes are already immutable here, so a warm repeat costs no rate budget — but it still costs the
parse. `server/segments-cache.ts` caches the finished, boundary-validated view so it does not.

Three rules keep that immutability honest, and each is a test in `server/segments-cache.test.ts` or
`server/proxy.test.ts`:

1. **Accession resolution is never cached.** It re-runs per request. The immutable entry is keyed by
   the accession it was built from, so if resolution were cached alongside it, a newly filed 10-K
   would stay invisible indefinitely. Re-resolving means a new filing surfaces on the *submissions*
   lifetime — 1h during acceptance hours — which is the schedule that governs when filings exist.
   Concurrent resolutions are coalesced, not cached: a burst of tabs asks EDGAR once, a later request
   asks again.
2. **The key carries a fingerprint of the code, computed from the code.** Accessioned bytes never
   change; the code reading them does. This used to be a version string a human edited, and on
   2026-08-23 it failed exactly as a manual step fails: extraction was fixed, the string stayed
   `'v1'`, and seventeen stale views were served afterwards — Autodesk's superseded figure among them
   — until the directory was deleted by hand. `server/extraction-fingerprint.ts` now hashes every
   non-test TypeScript file under `src/data`, `src/types` and `server`, plus `package.json` and
   `package-lock.json`, into the key. Any edit that could change a figure changes the key, and
   nobody has to remember anything. Directories are walked recursively, so a file added tomorrow is
   covered without being listed. **The one residual, stated rather than hidden:** extraction logic
   moved into a *new top-level directory* would escape the hash, and `ROOTS` in that file is where
   it would have to be recorded.

   The trade runs the other way too, and it is accepted deliberately: a comment edited anywhere in
   those roots retires every stored view. That costs a re-parse, not SEC requests — raw EDGAR bytes
   live in `.cache/edgar`, keyed by URL, immutable, and a rebuild re-reads them from local disk. CPU
   is the right currency to spend for certainty that a fix is never forgotten.

   If the fingerprint cannot be computed at all, the cache is disabled for that process and says so
   on `x-cache: bypass`. It never falls back to a fixed stamp; that is the defect, not the remedy.

2b. **The key carries the period's filing set.** A correction that does not change *which* filing is
   read — a cover-page-only `10-K/A`, which is a real and common filing — would otherwise be masked
   by an entry stored before it existed, and the reader would never see the note that a correction
   was filed. Listing every accession for the period in the key means a new correction is a new
   entry.
3. **Two states are deliberately never cached.** `incomplete-accession`, because EDGAR is still
   generating R-files and `MetaLinks.json` for hours after acceptance and refinement 1 above applies
   verbatim — caching it immutably would pin a real filing as permanently incomplete. And
   `out-of-coverage`, because it is decided from the filer's SIC in the submissions index, which is
   mutable and is not what this key identifies.

Transport failures are never cached here either; they ride the 1-hour negative caching in the table
above, which is where an absence belongs.

## Mechanics

**A cache hit costs no rate-limit budget.** The limiter is acquired inside the transport, after
the cache lookup misses. This is the single largest lever the project has for staying inside 10
requests per second, and `compliance.test.ts` asserts it.

**Stale is not the same as gone.** A stale entry is revalidated with `If-None-Match` /
`If-Modified-Since`. A `304` refreshes the lifetime without transferring the body — one request,
no payload, and the value keeps its provenance.

**Absences are cached.** A 404 is stored as a typed absence so a missing filing is not re-asked on
every render, and expires within the hour so a late filing is picked up.

**Nothing secret is ever written.** EDGAR is unauthenticated. The only response header persisted is
an `ETag`.
