# 0013 — A2: Use fast-xml-parser, not hand-rolled XML scanning

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     Financial Data Analyst's WS2 plan proposed using a hand-rolled XML scanner (~200 lines) to extract
             segment data from the raw XBRL instance, avoiding an external dependency. The
             proposal was motivated by an isomorphism argument: the scanner would only parse
             exactly the path structure Financial Data Analyst needs, making the code visible and auditable.

             Angel's charter to Financial Data Analyst is "if no defensible method exists for a cost category,
             the correct output is not disclosed, not an estimate" — which generalizes to "no
             silent errors." Hand-rolled XML parsing is a well-known category of defect that
             creates exactly that risk: edge cases in encoding, namespace handling, CDATA
             boundaries, and entity expansion that go invisible until a filer's instance trips
             them.

Options:     1. Hand-rolled scanner. Visible code, smaller dependency surface, zero network calls
                on parse. Tradeoff: classic silent-error vector, and the isomorphism argument
                below becomes false.
             2. fast-xml-parser (at 5.11.0). Dependency on an external package, but it handles
                the XML specification's edge cases and fails audibly on malformed input.
                Tradeoff: adds a package dependency and requires Financial Data Analyst to trust the package's
                test coverage, but silent failures are eliminated.

Decision:    Option 2. Use fast-xml-parser at 5.11.0. Financial Data Analyst's non-negotiable mandate is no
             silent errors, and hand-rolled XML parsing cannot defend against that. The
             isomorphism argument that motivated the hand-rolled scanner is voided by the A3
             ruling (see 0014-ledger-a3-server-side-extraction.md): the extraction runs
             server-side and the client never sees the 10.9 MB instance, only the validated
             small object. The visibility argument for hand-rolling evaporates.

             fast-xml-parser is battle-tested and maintained, and Financial Data Analyst's parser composition
             (call, validate, return) is thin and auditable even with the library under the
             hood.

Consequence: Package.json carries fast-xml-parser@5.11.0 as a dependency. Financial Data Analyst's XML parsing
             is delegated to the library, and Financial Data Analyst focuses on validation and extraction logic.
             The parser is not modified or wrapped in a way that could re-introduce silent
             failures.
