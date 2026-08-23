# DESIGN.md — Streamline   [FULL]

Generated 2026-08-21 · Authority: the reference files listed below.
`taste.md` is an index only. **This file binds `/build`.**

## THE PAGE'S ONE JOB

Make a beginner say "that's a river running into a lake" in five seconds, and give an analyst
every reported figure with its provenance in thirty — without a single pixel that isn't traceable
to a tagged fact in the filing.

## STRUCTURE

1. **Filing header** — entity, CIK, SIC, form, accession, filed date, period. Provenance first,
   because the claim this product makes is traceability. Establishes trust before the picture.
2. **The canvas** — rivers, constrictions, confluence, trunk, trunk constriction. The five-second
   read lives here and nothing may compete with it.
3. **The separated lake** — behind a vertical rule, spatially apart. Not a continuation of flow.
   This separation is a decision (Q1, decision 0017 Option 1), not an unfinished join.
4. **Scale legends** — a width bar and an area disc, bottom-left, out of the reading path but
   always present. An unlabelled quantitative scale is a lie by omission.
5. **Detail on demand** — the analyst's thirty seconds. Not built yet.

The filing header precedes the canvas because Streamline's entire argument is that the picture is
honest. Showing the source before the drawing is that argument in layout form.

## DIRECTION

A dark instrument that renders believable water. The ground is a desaturated blue-black taken from
`liquid-technology` — not pure black, which is both a fashion tell and a poor surface for the
luminance range water needs. On top of it, water is built the way the photographic measurements say
water actually is: **2–10% saturation, a median well below middle gray, and a small minority of
near-white specular pixels.** Hue does almost nothing; luminance structure does everything. Chrome
is rectilinear and quiet — a 4px grid and 2px radii from `nordic-knots` — so the only organic
shapes on screen are the ones carrying data. One accent blue exists for interface state and is
forbidden from the canvas, because colour is not yet an encoding channel and must not pretend to be.

## REFERENCES IN PLAY

| Dimension | Reference(s) | Contributing | Interaction notes |
|---|---|---|---|
| layout | `references/nordic-knots.md` | 4px grid (4/8/12/24/104), six-step scale, 2px radii, component-vs-section spacing vocabularies | Near-square chrome only works because the canvas supplies every curve |
| color | `references/liquid-technology.md` | Dark ground with a hue cast, one accent used once, alpha-for-de-emphasis, hairline inset ring as edge | The accent reads as instrumentation *only* because the ground is desaturated and shares its hue family |
| texture | `references/lukas-petereit-landscape.md`, `references/room-and-wild.md` | Water = 2–10% saturation, dark median (P50 43–89), near-white highlights (P95 172–221), bimodal histogram | Two independent sources agree. Water reads through luminance, so hue stays free for a future encoding |
| type | `references/apple-macbook-pro.md`, `references/nordic-knots.md`, `references/bullbrief-pro.md` | Tracking on a curve; display set solid; one family carrying weight-based hierarchy; `tabular-nums` on figures | Solid display line-height only survives because display tracking is negative |
| motion | `references/liquid-technology.md`, `references/nordic-knots.md` | One house duration plus a deliberate slow tier; a single house curve | UI chrome only — canvas motion is Forge's rate-locked system and is not governed here |
| copy | **none** | — | — |

**Dimensions with no reference backing:**
- **copy** — zero references, and `voice.md` is explicitly `UNSEEDED — NO VOICE AUTHORITY`. Its
  BANNED CONSTRUCTIONS list binds; its positive voice guidance does not exist. Every string in
  this product is currently unwritten or placeholder.
- **sustained motion** — both motion references contribute a duration and a curve for
  *transitions*. Neither has an extractable model for continuous movement. `liquid-technology`'s
  drift is GSAP plus a video asset, recorded as explicitly not a token.

## TOKENS (BINDING)

```css
/* ─── Surfaces ─────────────────────────────────────────────────────────────
   Measured from liquid-technology. Never pure #000: a hue-cast dark ground is
   what makes the accent read as signal, and it gives water room at the bottom
   of the luminance range. */
--surface-ground:      rgb(18, 19, 29);    /* app background */
--surface-raised:      rgb(30, 32, 41);    /* panels, header, legend plate */
--surface-sunken:      rgb(20, 20, 20);    /* canvas bed, behind the water */
--surface-rule:        rgba(255, 255, 255, 0.08);  /* the Q1 separation rule */

/* ─── Ink ──────────────────────────────────────────────────────────────────
   One ink, four weights. Alpha, not new grays. */
--ink-primary:         rgb(255, 255, 255);
--ink-secondary:       rgba(255, 255, 255, 0.72);
--ink-tertiary:        rgba(255, 255, 255, 0.50);
--ink-faint:           rgba(255, 255, 255, 0.20);

/* ─── Water ────────────────────────────────────────────────────────────────
   DERIVED, not copied. Each step matches the measured luminance percentiles
   from lukas-petereit-landscape + room-and-wild, held at 8–10% saturation
   with the ground's blue cast. Computed luminance is noted per step.
   This ramp is the beginner's five-second read. Treat it as load-bearing. */
--water-deep:          rgb(28, 29, 31);    /* L≈29  · matches P05 12–31   */
--water-mid:           rgb(64, 66, 71);    /* L≈66  · matches P50 43–89   */
--water-shallow:       rgb(101, 104, 112); /* L≈104                        */
--water-specular:      rgb(196, 201, 212); /* L≈201 · matches P95 172–221 */

/* ─── Accent ───────────────────────────────────────────────────────────────
   UI STATE ONLY. Forbidden on the canvas — see INTENTIONAL CHOICES. */
--accent:              rgb(46, 167, 255);
--accent-quiet:        rgba(46, 167, 255, 0.16);

/* ─── Data-quality states ──────────────────────────────────────────────────
   Deliberately achromatic. A refusal is a designed state, not an error, and
   colouring it red would contradict decision 0012. */
--state-refused:       rgba(255, 255, 255, 0.50);
--state-refused-rule:  rgba(255, 255, 255, 0.16);

/* ─── Type scale ───────────────────────────────────────────────────────────
   Six steps, after nordic-knots. Tracking follows apple-macbook-pro's
   direction, NOT nordic-knots' — see RESOLVED CONFLICTS. */
--text-display:   40px;  --lh-display:   1.00;  --track-display:  -0.022em;
--text-title:     28px;  --lh-title:     1.05;  --track-title:    -0.016em;
--text-heading:   20px;  --lh-heading:   1.20;  --track-heading:  -0.010em;
--text-body:      16px;  --lh-body:      1.50;  --track-body:      0;
--text-label:     13px;  --lh-label:     1.30;  --track-label:     0.010em;
--text-micro:     11px;  --lh-micro:     1.35;  --track-micro:     0.020em;

/* Instrument labels — mono, uppercase, wide. From bullbrief-pro. */
--track-instrument: 0.18em;

/* ─── Spacing ──────────────────────────────────────────────────────────────
   4px base, measured from nordic-knots. Two vocabularies, deliberately
   discontinuous: components stop at 24, sections start at 64. */
--space-1:   4px;
--space-2:   8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  24px;
/* gap is intentional */
--space-section:      64px;
--space-section-lg:  104px;

/* ─── Shape ────────────────────────────────────────────────────────────────
   Near-square. Guards against the uniform-rounded fashion tell. */
--radius:        2px;
--radius-plate:  6px;
--border-hair:   1px;
--border-color:  rgba(255, 255, 255, 0.12);

/* ─── Depth ────────────────────────────────────────────────────────────────
   Lightness steps, not shadow stacks. One ring for edge definition. */
--ring-edge:   inset 0 0 0 1px rgba(255, 255, 255, 0.10);
--shadow-lift: 0 16px 48px rgba(0, 0, 0, 0.55);

/* ─── Motion (UI chrome only) ──────────────────────────────────────────────
   Canvas motion is Forge's rate-locked system and is NOT governed here. */
--dur-fast:  150ms;
--dur-base:  300ms;
--dur-slow:  500ms;
--ease:      cubic-bezier(0.4, 0, 0.2, 1);
```

**Type:**
`IBM Plex Sans` · weights 400 / 500 / 600 · `google-selfhosted` ·
fallback `"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`

`IBM Plex Mono` · weights 400 / 500 · `google-selfhosted` ·
fallback `"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Monaco, monospace`

**Every figure renders in IBM Plex Mono with `font-variant-numeric: tabular-nums`.** Required by
test record 0001 C2 — financial figures must not jitter between values.

**Dark variant:** Streamline is dark-native. There is no light theme in this brief, and the dark
palette is authored directly rather than derived by inversion.

## VOICE

`knowledge/design/voice.md`, with a stated limitation: that file is `UNSEEDED`. Its **BANNED
CONSTRUCTIONS** list binds now — no "not just X, it's Y," no three-item rhythm lists, no headers
that announce a topic instead of stating a claim, no hedge-stacking, no restatement, no em-dash as
default punctuation. Its **positive** voice guidance does not exist, so no copy written for
Streamline may claim to be in Angel's voice.

Project-specific deviation: **this product's copy must state quantities, not describe them.** A
caption that says "significant tax burden" fails; one that says "$32,185M in income tax" passes.
The invariants forbid the picture from exaggerating; the copy is held to the same standard.

## INTENTIONAL CHOICES — protected from `/polish` Pass 0

- **The lake does not connect to the trunk.** A vertical rule and a constant gap separate them.
  This looks like a missing connector and is not — river width is px/$ and lake area is px²/$,
  and nothing relates those units. Decision 0017 Option 1. Removing the gap would fabricate a
  relationship the data does not support.
- **`--accent` never appears on the canvas.** Colour is not an encoding channel until D15 is
  answered, and Invariant 3.10 requires colourblind safety. A blue river would imply meaning that
  does not exist. The accent is for focus rings, links, and interactive state only.
- **Water is nearly colourless (8–10% saturation).** This is measured, not stylistic. Making the
  rivers "more blue" would move away from believable water, not toward it — the two texture
  references agree that vegetation sits at 34–70% saturation and water at 2–10%.
  **The method is protected; the exact values are provisional.** Angel stated on 2026-08-21 that
  he will tune the ramp on sight once it renders. Tuning inside the measured envelope — L within
  P05 12–31 / P50 43–89 / P95 172–221, saturation within 2–10% — is expected and needs no
  override. Leaving that envelope is a real departure from the evidence and goes in OVERRIDES with
  a reason. `/polish` may not "correct" a hand-tuned value back toward the computed one.
- **The trunk constriction is the smallest narrowing on the canvas.** It carries $21,488M and
  still reads small, because Invariant 3.1 makes the absolute comparison correct. Kill-list K1
  forbids enlarging it for visibility.
- **Spacing jumps from 24px to 64px with nothing between.** Component and section spacing are
  separate vocabularies, measured from `nordic-knots`. Filling the gap would blur the distinction.
- **`--radius: 2px`, not 0.** A visible corner that is not a rounded style. Zero would read as
  unstyled; 8px+ would read as the current era's default.
- **Data-quality states are achromatic.** An out-of-coverage filer returns HTTP 200 and is a
  designed state (decision 0012). Colouring refusals red would restate them as errors.
- **Body text at 16px with `--track-body: 0`.** No negative tracking on reading sizes on a dark
  ground; see RESOLVED CONFLICTS.

Pass 0 may **flag** these but may **not** remove them without asking. Asks are batched into one
list at the end of the pass.

## RESOLVED CONFLICTS

- **Direction: `liquid-technology` vs the natural group** (`room-and-wild`, `nordic-knots`,
  `lukas-petereit-landscape`). Angel chose engineered on 2026-08-21, then bounded it: the dark
  aesthetic may not cost the two-audience test — a beginner must still see a river.
  **This turned out not to be a true conflict.** Measurement dissolved it: `liquid-technology`
  contributes **hue and ground**, the texture references contribute **luminance structure and
  specular highlights**. Different channels, no competition. Rejected reading: that "engineered"
  required abandoning believable water. Recorded because the framing was wrong, not the choice.

- **Type tracking direction: `apple-macbook-pro` vs `nordic-knots`.** Apple tightens tracking as
  size *grows* (−0.015em at 80px, −0.003em at 48px). Nordic Knots does the opposite, tightening as
  size *shrinks* (−0.0176em at 34px, −0.0343em at 14px). **Following `apple-macbook-pro`**, because
  small text on a dark ground suffers optical bloom and needs *more* tracking, not less — and
  Streamline's small text carries figures an analyst must read exactly. Rejected: Nordic Knots'
  inverted curve — recorded, not deleted; it works on their white ground and would not here.

- **House duration: `liquid-technology` 0.35s vs `nordic-knots` 0.3s + 0.5s.** Following
  `nordic-knots`, because two named tiers (base and slow) are more useful than one value, and the
  50ms difference is imperceptible. Rejected: a single 0.35s tier.

- **Type family: `bullbrief-pro`'s Fraunces + Geist pairing.** Rejected for this build. Geist is
  on the `anti-patterns.md` list as "type that announces nobody chose," and Fraunces' warmth pulls
  against the instrument direction. Recorded because `bullbrief-pro` names that pairing as its
  strongest asset — it is right for BullBrief and wrong here.

## REJECTED OPTIONS

- **Natural/warm direction led by the material references.** Rejected by Angel 2026-08-21 in favour
  of engineered. Its concern — recognizable water — was preserved as a binding constraint rather
  than discarded.
- **A licensed display family.** Angel owns no licensed fonts (`fonts.md` Tier 1 is empty). An
  acquisition was offered and declined in favour of IBM Plex at zero cost. Revisit if the type
  ever feels like the weak part of the page.
- **System fonts (SF Pro / SF Compact).** Zero cost and already installed, but `fonts.md` calls
  SF Pro "the typeface equivalent of not deciding," and it is unavailable to non-Apple visitors.
- **Glassmorphic panels** from `bullbrief-pro`. A current fashion tell (`anti-patterns.md`,
  re-audit 2027-01) and structurally the invented-atmosphere tell. Depth here is lightness steps.
- **Ambient video behind the canvas.** Angel's idea, correctly scoped to the empty state only and
  parked until Q3 has a spec. Behind the visualization it would breach Invariant 3.6 — motion with
  no documented meaning next to motion that has one.
- **Viewport-proportional type**, as measured on `liquid-technology` (body computes to 1.042vw).
  It ignores the reader's font-size preference. Unacceptable for a tool an analyst sits in front
  of for thirty minutes.

## ASSET MANIFEST

| Asset | Origin | License | Sourced/Generated | Treatment | Weight budget |
|---|---|---|---|---|---|
| IBM Plex Sans 400/500/600 | Google Fonts | SIL OFL 1.1 | **not yet sourced** | Self-host, subset latin, `woff2`, preload 400 + 600 | ≤ 60 KB total |
| IBM Plex Mono 400/500 | Google Fonts | SIL OFL 1.1 | **not yet sourced** | Self-host, subset latin + tabular figures, `woff2` | ≤ 40 KB total |
| Empty-state ambient video | Angel, to shoot | Angel's own | **parked** | ≤15s seamless loop, muted, near `--surface-ground`, no legible objects | ≤ 2 MB, deferred |

Do **not** hotlink `fonts.googleapis.com` — it costs a DNS round trip, blocks render, and hands a
third party the visitor list.

## OVERRIDES

| Date | Finding | Reason accepted |
|---|---|---|
| — | *(none yet)* | |

## DERIVED VALUES *(appended by `/build`)*

| Value | Derived from | Used for |
|---|---|---|

## REVISION

- 2026-08-21 — created · FULL · approved by Angel

Token-level amendments require re-running `/taste` on that dimension. Superseded values are
recorded, never deleted.

## DELIBERATELY AVOIDING

Chosen for this project from `anti-patterns.md`, not the whole list:

- **Dark mode as pure `#000` with pure `#fff` text.** The current unstyled build sits exactly here.
  Ground is `rgb(18,19,29)`; ink runs at four alpha steps.
- **Uniform `rounded-xl` on every surface.** `--radius: 2px`.
- **Inter / Geist / system-ui as sole family.** Both measured references default to Inter. IBM Plex
  is a decision.
- **Blurred coloured blobs and CSS-invented atmosphere.** Every soft shape on screen is a river,
  a constriction, or a lake, and each is computed from a reported figure.
- **Glassmorphism panels.** Depth is lightness steps plus one hairline ring.
- **Motion without cause.** Canvas motion encodes flow. UI motion is state change. Nothing moves
  for mood.
- **Decoration without function.** Structural tell #2, and the one this product is least able to
  afford — its whole claim is that nothing on screen is invented.
- **Defaults left untouched.** The build currently renders browser-default serif on near-black.
