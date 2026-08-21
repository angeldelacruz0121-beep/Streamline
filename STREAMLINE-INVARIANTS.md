# Streamline — Invariants

This is the constitution. Every agent reads this file before doing any work. If a task
conflicts with anything here, the agent stops and escalates to Angel. Agents do not amend this
file. Only Angel amends this file.

---

## 1. Product definition

Streamline visualizes a company's earnings as a lake fed by rivers of revenue.

Each river is one reportable revenue segment. As it flows toward the lake it passes through
constriction points representing costs (COGS, R&D, S&M, overhead) that reduce the flow. The
lake is net earnings — the sum of what survived the journey.

Two audiences, served simultaneously and without compromise:

**Beginner.** The visual alone must tell a true story in under five seconds. A wide river that
narrows sharply signals strong revenue with thin margins. A river that stays wide signals
efficiency.

**Analyst.** The metaphor hides nothing. Every river and every constriction is clickable and
opens the actual reported figures with their source. The visualization is an entry point into
the data, never a replacement for it.

**Quality bar.** High-end financial product design — closer to a Bloomberg terminal than an
infographic. It must survive scrutiny from someone who reads 10-Ks for a living.

**Coverage, v1.** Technology sector only. Inclusion test is SIC code 3570–3579 (computer and
office equipment) or 7370–7379 (computer programming, data processing, software services) as
reported on the filer's EDGAR record. A company outside those ranges is out of scope for v1 and
renders an explicit out-of-coverage state, never a partial or approximated render. Additional
sectors are added deliberately, one at a time, each with its own income-statement model.

---

## 2. Data truth rules

Enforced by Ledger. Non-negotiable.

**2.1 Source.** All financial data comes directly from SEC EDGAR — 10-K, 10-Q, 8-K, and their
XBRL company facts. No commercial data vendors in v1. SEC data is public and unrestricted for
redisplay, which is why it was chosen.

**2.2 Traceability.** Every number rendered on screen traces to a specific source line item:
accession number, form type, fiscal period, and XBRL tag with its dimensional axis. A number
with no traceable source does not render.

**2.3 Reported vs. derived.** Filers disclose segment revenue and often segment operating
income. They rarely disclose a full segment-level cost stack. Any cost figure Streamline
allocates or estimates rather than reads is **derived** and must be visually distinguishable
from reported figures in every surface where it appears — river geometry, tooltip, and detail
panel. The allocation method must be stated in the detail panel in plain language.

**2.4 Reconciliation.** The sum of segment revenues must reconcile to consolidated revenue
within **0.5%**. Unallocated corporate items and eliminations are rendered, not silently
dropped. If reconciliation fails outside tolerance, the company does not render — it shows an
explicit data-quality state naming the discrepancy.

**2.5 Period integrity.** Fiscal calendars are normalized to a canonical period model before any
cross-company comparison. Never compare a fiscal year to a calendar year without labeling it.
Restatements and segment reclassifications are tracked; a company whose segments were
reclassified mid-history shows a break marker rather than a smooth false trend.

**2.6 Units and currency.** Every figure carries units and reporting currency through the entire
pipeline as typed data, never as a formatting concern. No implicit USD.

**2.7 Staleness.** Every view states the filing date of the data it renders. Data older than one
reporting period past the filer's expected filing date is flagged in the UI.

---

## 3. Visual encoding rules

Enforced by Cartographer. Non-negotiable.

**3.1 Width is dollars.** River width is strictly linearly proportional to dollars on a
documented scale. No perceptual tuning, no square-root softening, no per-company rescaling for
composition. If the smallest segment is visually thin, that is the correct rendering.

**3.2 Constriction is cost.** The reduction in river width at a bottleneck is proportional to the
cost it represents, on the same scale as 3.1. Bottleneck visuals are never sized for aesthetics.

**3.3 The lake encodes net earnings by AREA.** Lake surface area is linearly proportional to net
earnings. Area, not diameter — diameter would quadruple apparent magnitude on a doubling and
overstate every comparison. A scale indicator is displayed so the encoding is verifiable.

**3.4 Negative net earnings render as a DRAINED BASIN.** When net earnings is negative, the lake
renders as an empty basin with a visible shoreline and a floor below grade. The depth below the
shoreline is linearly proportional to the magnitude of the loss, on a documented scale. The
shoreline stays in place so a loss-making company remains visually comparable to a profitable
one at the same zoom. Rivers still flow in and are still consumed — the loss is shown as a void
that revenue failed to fill, not as an absence of revenue.

**3.5 Flow speed encodes YoY segment revenue growth.** Faster flow means faster growth. Mapping
is linear from −20% YoY (0.5× baseline speed) to +40% YoY (2.0× baseline speed), clamped at
both ends. Baseline speed corresponds to 0% growth. A segment with no prior-period comparison
renders at baseline speed and is labeled as such. This mapping is documented on screen in the
scale indicator.

**3.6 No decorative data.** Nothing on the canvas that looks like data may be arbitrary.
Particle density, flow speed, and color either encode something real and documented here, or
they are removed.

**3.7 Segment display cap.** Render the top 5–8 segments by revenue. Remaining segments collapse
behind a "More" control that opens the full itemized list with real figures.

**Critical:** hidden segments still flow into the lake. The lake always encodes total net
earnings across all segments, including those not currently drawn. Collapsing is a display
decision, never a data decision. A test must assert that lake area is identical whether "More"
is expanded or collapsed.

**3.8 Single-segment companies render as-is.** One river, one lake. No synthetic decomposition,
no substitute axis. A persistent note states that the filer reports a single revenue segment,
so the user understands the sparse picture is the company's actual structure and not missing
data.

**3.9 Dominant-segment case.** When one segment exceeds roughly 80% of revenue, linear scale
makes the remaining rivers near-invisible. That is the correct rendering and it stays linear.
Legibility is solved with labeling and interaction, never by distorting the scale.

**3.10 Accessibility.** All encodings survive deuteranopia and protanopia simulation. Color never
carries meaning alone. Labels never collide or occlude a river at any supported viewport width.

**3.11 The misreading test.** Before any encoding ships, state what a beginner would
*incorrectly* conclude from it. If a plausible wrong conclusion exists and is not defended
against, the encoding does not ship.

---

## 4. Engineering rules

**4.1 Frame budget.** Framerate is a floor to defend, not a target to maximize. Visual quality
may be paid for in framerate down to that floor. A steady locked rate reads as smooth; a higher
average punctuated by hitches reads as broken. **Average FPS is not a governing metric at all** —
it is the metric most likely to hide the exact hitches that make a build feel cheap.

Reference load: 12 segments, desktop viewport.
Reference machine: 2020 MacBook Air, integrated graphics.

Two independent standards. Both must hold; neither substitutes for the other.

**Render smoothness** — measured at the reference load on the reference machine:

| Metric | Standard |
|---|---|
| Locked rate | 60fps preferred; 30fps floor. Always a clean divisor of display refresh — never floating |
| Pacing | No frame exceeds 1.5× the locked interval (25ms at 60, 50ms at 30) |
| 99th percentile | Within the locked interval |
| Hard fail | Sustained below the 30fps floor, any dropped-frame cluster, or any unlocked/floating rate |

**Interaction responsiveness** — measured independently of render rate:

| Metric | Standard |
|---|---|
| Hover and click feedback | Under 100ms |
| Hard fail | Any interaction gated behind the render loop |

These are separate because they fail separately. A product rendering at a locked 30fps still
feels immediate when input handling is not blocked on the frame; a product at 60fps feels broken
when it is.

**Quality outranks rate; both outrank nothing else.** When the budget is tight the renderer steps
the *locked rate* down first — 60 to 30 — and keeps render quality: antialiasing, blur and bloom
quality, particle density, device pixel ratio. Reducing visual density is the second lever, used
only when the 30fps floor cannot hold. This is deliberate: a thinner-looking product on the
hardware most users actually have is a worse outcome than a locked 30.

**Geometry accuracy is never degraded**, at any framerate, for any reason. It is not a lever and
it is not on this ladder.

**4.2 Reduced motion.** `prefers-reduced-motion` produces a fully static, fully accurate
rendering with identical information content. An equivalent, not a lesser version.

**4.3 Typed contract.** The renderer cannot receive an unvalidated financial object. Validation
happens at the pipeline boundary via TypeScript types plus a runtime schema check. The renderer
has no knowledge of data sources.

**4.4 Adapter layer.** The SEC ingestion path sits behind an interface. Assume a second source
will be added.

**4.5 No fabricated data.** No placeholder financials, no invented companies, no seeded demo
numbers in any committed code path. Empty, loading, error, and data-quality states are real
designed UI.

**4.6 SEC access discipline.** EDGAR requires a descriptive User-Agent header including a real
contact email, and rate-limits to 10 requests per second. Both are enforced in code, not by
convention. Responses are cached against the filing calendar.

---

## 5. Aesthetic

Near-black base. Restrained palette with purposeful accent color. Typographic hierarchy carries
the interface; chrome does not. Tabular numerals on every figure. Motion is physical and
purposeful, never ornamental easing. Density over whitespace where an analyst is the reader.

**Naturalism.** Rivers should read as water and the lake should read as a lake. The visualization
needs life and physical presence, not saturation. Naturalism is pursued through motion behavior,
silhouette, surface, and light — never through refraction, caustics, or physically-based water
shading, which will not hold the frame budget on reference hardware even at the 30fps floor.
Forge costs any proposed approach before Atelier commits to it.

**Color is encoding, not decoration.** The palette stays restrained. Where color distinguishes
segments it is a stable hue per segment, consistent across periods and across filers, documented
in the scales, and verified under deuteranopia and protanopia simulation. Vibrance for its own
sake is rejected — it would breach Invariant 3.6 by making viewers read meaning into an arbitrary
choice.

Explicitly rejected: gradients without function, glassmorphism as decoration, generic
AI-interface genericism, anything that reads as a template, and decorative color.

---

## 6. Open decisions

Answered — do not revisit without amending this file:
D1 lake encoding = area · D2 negative earnings = drained basin with proportional depth ·
D3 flow speed = YoY segment growth · D4 frame budget = locked-rate floor (60 preferred, 30 floor) with quality outranking rate; input latency measured separately ·
D5 data source = SEC EDGAR direct · D6 segment cap = top 5–8 plus "More" ·
D7 coverage = technology sector only, SIC 3570–3579 and 7370–7379 · D8 single-segment = render
as-is with a note · D14 visual direction = naturalistic, restrained, color encoded not decorative.

Open — agents escalate rather than decide:

| # | Decision | Blocks | Current default |
|---|---|---|---|
| D9 | Growth-to-speed mapping bounds | Cartographer | −20%→0.5×, +40%→2.0×, clamped |
| D10 | SIC ranges are a proxy for "tech" and will miss or wrongly include some filers | Ledger, Advocate | SIC 3570–3579, 7370–7379 |
| D11 | Cost categories shown as constrictions, and their fixed order along the river | Cartographer, Ledger | COGS → R&D → S&M → other opex |
| D12 | Default period on load: latest fiscal year, latest quarter, or TTM | Advocate, Keel | latest fiscal year |
| D13 | Depth scale for the drained basin — same scale as lake area, or its own | Cartographer | own scale, documented |
| D15 | Which segment-hue set, once color becomes an encoding | Cartographer, Atelier | none assigned yet |

---

## 7. Amendment log

| Date | Change | By |
|---|---|---|
| — | Initial. D1–D8 answered. | Angel |
