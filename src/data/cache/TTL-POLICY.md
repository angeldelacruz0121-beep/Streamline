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

Two refinements to the approved table, both strictly more conservative, both to avoid caching
something that can still change:

1. **`index.json` is not immutable on its filing day.** Treating it as immutable would permanently
   cache a listing taken before EDGAR finished generating the filing's rendered artifacts, and the
   filing would look like it had no XBRL forever.
2. **Submissions overflow files get their own entry** (7 days) rather than inheriting the
   submissions lifetime, because they are historical slices rather than the live index.

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
