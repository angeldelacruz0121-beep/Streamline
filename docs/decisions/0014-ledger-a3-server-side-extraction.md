# 0014 — A3: Extraction runs server-side; client receives only the validated object

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     Financial Data Analyst's WS2 plan touches a critical boundary: whether XBRL instance extraction
             happens on the server or the client. The raw XBRL instance for Microsoft is 10.9 MB
             compressed (~50 MB uncompressed). Sending the whole thing to the client costs
             latency, bandwidth, and storage; parsing it in-browser is expensive and blocks
             interaction.

             Angel's decision: extraction runs server-side. The client downloads only the small
             validated CompanyView object (structure and figures, no raw instance data).

Options:     1. Client-side extraction. Download the full instance, parse and validate in the
                browser. Tradeoff: client sees the whole data source and can re-validate locally,
                but blocks interaction during parsing and burns a large bandwidth and storage
                footprint on every user's machine.
             2. Server-side extraction. Data Engineer provides a route to download the instance,
                Financial Data Analyst extracts and validates it, and the client receives only the small
                validated object. Tradeoff: the client trusts the server's extraction (cannot
                re-validate the raw source locally), but unblocks interaction and removes the
                bandwidth and storage cost.

Decision:    Option 2. Extraction runs server-side in Data Engineer's domain. The client makes a single
             request to GET /api/edgar/company/:cik/segments and receives the CompanyView
             object, already extracted and validated. The raw 10.9 MB instance is never
             transmitted to the client.

             This decision assumes Data Engineer owns the extraction route and implements ingestAnnualSegments
             from src/data/normalize/ingest.ts. That is a new follow-on task for Data Engineer,
             not part of WS1.

Consequence: Data Engineer has a new task (not in the current WS1 scope): provide the GET
             /api/edgar/company/:cik/segments route, calling Financial Data Analyst's ingestAnnualSegments
             function.

             The client's data-fetch layer hits this route, not the raw EDGAR endpoint, so the
             client never sees the full instance. The traceability story (Invariant 2.3) is
             preserved because Financial Data Analyst's extraction logs every tag it consumes and every derived
             figure it computes, and that log can be returned in the response's provenance field.

             This forecloses client-side XBRL parsing and any architecture where the client
             independently validates the extraction. The extraction validation happens once,
             server-side, and the client's validation task is narrowed to "does the returned
             object match its schema" — which is Software Architect's job, not Financial Data Analyst's.
