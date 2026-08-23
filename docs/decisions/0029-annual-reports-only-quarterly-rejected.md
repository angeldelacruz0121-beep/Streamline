# 0029 — Annual reports only; quarterly considered and rejected

Date:        2026-08-23
Status:      accepted
Decided by:  Angel

Context:     Should Streamline include quarterly filings (10-Q) in addition to annual filings
             (10-K)?

Decision:    Annual filings only. SEGMENTS_FORM stays '10-K'.

Reasoning:   Annual filings (10-K) carry far more segment detail than quarterly filings. Quarterly
             filings (10-Q) often disclose too little segment information to draw the rivers
             at all.

Consequence: No work was required — this confirms existing behaviour. The product makes no
             quarterly data available.

             Future work, if built (quoted per Angel, sequenced only as a note):
             1. Most recent year
             2. Trailing twelve months
             3. Ability to load a specific past report and compare reports
             None of this is scheduled for the current slice.
