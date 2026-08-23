# 0024 — Terminus ruling: fully consumed trunk draws nothing past closure; "$0M" caption stays visible

Date:        2026-08-21
Status:      accepted
Decided by:  Angel

Context:     When a trunk is fully consumed (all residual width is allocated to the lake or is
             zero), the trunk terminates at the closure — the point where the banks meet at the
             centreline. No geometry is drawn past this point.

             A question arose: should the "$0M" caption (or placeholder text indicating zero
             remaining width) be visible at the terminus, or should it be hidden for tidiness?

             Angel's ruling: visibility wins. The "$0M" caption (or honest placeholder) stays
             visible until real copy exists. This principle extends to all empty or zero states:
             show the honest value first, hide or replace it only with real copy.

Decision:    A fully consumed trunk draws nothing geometrically past the closure. The banks meet
             at the centreline. The "$0M" caption or placeholder text indicating zero remaining
             width is displayed at the terminus deliberately, not hidden.

Consequence: Every terminus of a fully consumed trunk is visually marked with its honest value
             (zero). This is tidier code and clearer for readers. The convention extends:
             initial placeholders anywhere are the honest data until replaced with authored copy.
             No special-casing of empty states to "prettify" the interface.