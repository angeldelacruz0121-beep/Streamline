# 0016 — Slice figures corrected: $133,700M → $133,749M, $21,537M → $21,488M

Date:        2026-08-20
Status:      accepted (process lesson, not a new decision)
Decided by:  Financial Data Analyst, verified independently, escalated to Technical Writer

Context:     The STATUS.md §0 "Verified target" table stated consolidated net income as $133,700M
             and trunk residual as $21,537M, with both figures asserted as "checked against EDGAR
             directly, then re-verified adversarially — do not re-derive."

             Financial Data Analyst discovered the figures were wrong by reading the SEC wire instead of trusting
             the summary. The error was then independently confirmed by querying the SEC
             companyconcept API for the same accession and period.

The error:   **Consolidated net income: $133,700M was a rounding of $133.7B. The exact tagged
             value is $133,749M.** The SEC XBRL instance carries a single value, not a rounded
             variant:

             us-gaap:NetIncomeLoss, CIK 0000789019, accession 0001193125-26-323660,
             FY 2025-07-01 → 2026-06-30, form 10-K: 133,749,000,000 (decimals="-6")
             No rounded variant is tagged by the filer.

             As a consequence of the correction:
             - Segment operating income: $155,237M (unchanged, confirmed exactly)
             - Trunk residual: $21,488M (was $21,537M)
             - Net margin: 133,749 / 331,839 = 40.31%

Independent The correction is independently verified. All figures from the same accession
verification: (0001193125-26-323660) and period (FY 2025-07-01 → 2026-06-30):

             us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax  $331,839M
             us-gaap:IncomeTaxExpenseBenefit                             $32,185M
             us-gaap:NonoperatingIncomeExpense                          +$10,697M

             Reconciliation check:
             segment operating income           $155,237M
             + non-operating income             +$10,697M
             - income tax expense               -$32,185M
             = consolidated net income         $133,749M ✓

             Bridge closes to the cent; unexplained variance = $0.

Consequence: Invariant 2.2 and decision 0010 are dispositive: the wire wins. Both figures in
             STATUS.md §0 are amended immediately. The trunk residual is now $21,488M.

             **Process lesson (the durable part):** The instruction "do not re-derive" is a
             coercive shortcut that discouraged anyone from checking. Financial Data Analyst's mandate is to read
             the filing, and that is what found the error. The moral is that instructions to skip
             verification can backfire in data work — they save time at the front end and cost
             authority at the back. Financial Data Analyst caught it only by ignoring the summary and reading the
             filing.

             In future corrections, the wire is always the source of truth, and any figure in
             this project that is stated as "verified, do not re-derive" is a red flag for someone
             to check it anyway. Not because the verifier was dishonest, but because the
             instruction itself is an error-hiding vector.

Consequence  Technical Writer will amend two existing decision records (0005 and 0007) to correct their
for records: figures and note that the arguments survive the correction. No record is left with a
             silent wrong figure. Every agent reading STATUS.md tomorrow will see the wrong figures
             flagged rather than trusting them.
