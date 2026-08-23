# 0012 — A1: The runtime boundary validates the whole CompanyView union

Date:        2026-08-20
Status:      accepted
Decided by:  Angel

Context:     Financial Data Analyst's WS2 plan (Check-in A) proposed routing segment extraction through a runtime
             validation boundary that uses Software Architect's ValidationResult to validate the entire
             CompanyView union shape, including its data-quality states. The boundary rejects
             invalid structures but must also pass through five branded data-quality states that
             indicate the company's own data is incomplete or unresolved, rather than
             transmission failure: out-of-coverage, segment-identity-unresolved, reconciliation-break,
             and incomplete-xbrl.

             The question: do data-quality states count as validation failures (rejectable by the
             boundary) or as valid values that the boundary should pass?

Options:     1. Data-quality states are boundary failures. Tighten Software Architect's ValidationResult to
                carry a new field distinguishing data-quality failures from schema failures.
                Tradeoff: more precise boundary semantics, but requires a Software Architect change and blocks
                Financial Data Analyst on Software Architect's schedule. ValidationResult.failure currently carries {path,
                message}[] and cannot express a typed state without widening.
             2. Data-quality states are valid branded values. The boundary passes them as-is,
                and the downstream consumer (Data Engineer) distinguishes them on receipt.
                Tradeoff: zero Software Architect changes and Financial Data Analyst proceeds unblocked, but the validation
                boundary is now semi-permeable — it validates schema but not the domain
                constraints on data-quality states themselves.

Decision:    Option 2. Data-quality states pass through the runtime boundary as valid values. They
             are reported values (when disclosed) or defensible derivations (when inferred), and
             the boundary's job is to validate structure, not to gatekeep missing data. Data Engineer
             sees the CompanyView with its quality state intact and handles routing accordingly.

             This forecloses a Software Architect change and keeps Financial Data Analyst unblocked. It also reflects the
             product intent: a beginner needs to see that a company's data is incomplete as
             eagerly as they need to see the data itself. The encoding of data-quality states
             lives in Data Visualization Engineer's work, and Data Visualization Engineer will have to account for them in the
             visual design.

Consequence: Software Architect's ValidationResult interface remains unchanged. The CompanyView union carries
             its data-quality member alongside the clean-data member, and both are valid outputs
             of the boundary validation.

             This means Data Visualization Engineer must be prepared to render the app's UI with a data-quality
             state active, not just with data present or absent. Failing on incomplete data is
             silent and wrong (Invariant 2.2); rendering a legible "this data is incomplete" is
             the correct behavior. The visual design is not yet specified.
