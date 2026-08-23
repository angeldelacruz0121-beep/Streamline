# 0028 — Amended filings are used, with a qualifier

Date:        2026-08-23
Status:      accepted
Decided by:  Angel

Context:     When a company corrects a prior annual report by filing a 10-K/A (amended form),
             which version's numbers should Streamline display?

             Real EDGAR cases: HP Inc FY2022 correction filed 2023-09-11 (accession
             0000047217-23-000075) contains 146 rendered reports of which 7 are financial
             statements — it supersedes the original. HP FY2019 correction contains 2 rendered
             reports, 0 financial statements — it does not change any financial data.

Options:     (a) Always obey the newest correction literally — would show a blank screen where
                correct original numbers exist.
             (b) Refuse the company entirely when corrections are ambiguous — hides companies
                whose originals are fine.

Decision:    When a company has corrected a prior annual report, Streamline reads the CORRECTED
             filing, not the original. Angel's reasoning: a company files a correction because
             they found a mistake, so the correction carries the most up-to-date and most
             accurate numbers. Accuracy is his top priority.

             THE QUALIFIER: not every correction contains financial data. Companies routinely
             file a correction that only adds a missing section (most often executive
             compensation). If the newest correction contains no financial statements, the
             ORIGINAL's numbers are served, and the response says a correction exists that was
             not used, with the reason stated.

             Angel's wording: "If they do a correction and the financial numbers don't affect
             the company at all, then there's honestly no need to add it to the big picture.
             Maybe just make a note that says a correction was made, no direct impact to the
             company."

             Multiple corrections: newest by filing date wins, because a later correction was
             filed knowing the earlier one.

Consequence: The Data Engineer has implemented this ruling (2026-08-23, suite 1000 → 1032).
             The implementation returns financial statements from the corrected form if it
             contains them; otherwise from the original, with a metadata flag and full accession
             details on every unread correction so the user-facing layer can render the
             correction-not-used note later (correction accession, form, filing date, period,
             primary document, full archive document list, and report titles).

             This replaces the prior blocking gap on "amendments-in-envelope" (STATUS.md §4).
