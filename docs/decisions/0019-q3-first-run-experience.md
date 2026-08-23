# 0019 — Q3: First-run experience is unwritten and partly blocked

Date:        2026-08-20
Status:      pending (awaiting decisions D10 and D12)
Escalated by: Product Analyst (docs/product/open-questions.md §Q3)

Context:     Product Analyst's definition of done requires a first-run experience specification —
             what a user sees before choosing a company. This is not owned by any other agent.

             Two open decisions sit directly in this spec:
             - **D10** — SIC 3570–3579 / 7370–7379 as a proxy for "tech." First-run has to
               state coverage limits, and the phrasing depends on whether the boundary is
               described as a sector or as an SIC range.
             - **D12** — default period on load. First-run shows a period before the user
               picks one.

Blocking:    The specification itself is unwritten. Product Analyst's definition of done on first-run
             is unmet.

Not blocking: The empty state's information architecture, the company-selection affordance,
             what the product says it does not do, and the scale-indicator legend a first-time
             viewer meets before any company loads. These can be written without D10 or D12.

Dependencies: Blocked by decisions D10 and D12.

Awaiting:    Angel's decisions on D10 (SIC range as coverage limit) and D12 (default period).
             Once those are answered, the first-run spec can be written.
