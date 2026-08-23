# 0034 — Clickable correction detail, captured not built

Date:        2026-08-23
Status:      recorded, unbuilt
From:        Angel

DIRECTION
---------

When a correction exists that does not change the financial numbers, Angel wants a note saying
a correction was made with no direct impact — and for a reader to be able to CLICK it and see
the actual correction in a popup, so they can judge for themselves that it does not affect the
company.

READY TO BUILD
--------------

Already done for it: the Data Engineer's 0028 work carries, for every unread correction, its
accession, form, filing date, period, primary document, full archive document list and report
titles — so the panel can be built later with no additional EDGAR request.

Consequence: Nothing built; interface work is deferred by Angel's instruction. Owners when it
             happens: Software Architect (panel and state), Art Director (appearance), Product
             Analyst (two-audience test), Angel (all copy — voice.md is unseeded and no agent
             may author wording).

             The data backing this feature is complete and shipped by Data Engineer; the
             work is confined to the UI layer.
