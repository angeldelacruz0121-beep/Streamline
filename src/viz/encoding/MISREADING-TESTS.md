# Misreading tests — the encodings shipped in this directory

Invariant 3.11: before any encoding ships, state what a beginner would *incorrectly*
conclude from it. If a plausible wrong conclusion exists and is not defended against, the
encoding does not ship.

Cartographer's agent definition says to record these in `docs/decisions/`. That directory
is Archivist's and Advocate's, so the record is written here, inside an owned path, on the
precedent of `src/data/sec/ENDPOINTS.md` and `src/data/cache/TTL-POLICY.md`. **Handoff:
Archivist transcribes this into `docs/decisions/` on the next batch.**

Six encodings shipped. Each is listed with the wrong conclusion, the defense, and the
test that fails if the defense is removed. Where the defense does not exist yet, that is
said plainly rather than softened.

---

## 1. River width — dollars as width

**Wrong conclusion.** *"That river is thin, so that business barely matters."* And, worse
because it is subtler: *"the pinch on the trunk looks smaller than the pinch on that
river, so it took less money."*

**Defense.** One `widthPx` governs every width and every constriction on the canvas, so
pixels removed are proportional to dollars removed no matter what is being pinched. The
second misread is a Weber effect and is real; the answer is the dollar annotation carried
on every constriction, never a resized pinch (kill-list K1) or a normalised one (K2).

**Tests.** `width.test.ts` — "removes exactly the width the same dollars would occupy, for
every probe" and "is independent of how wide the thing being pinched is".
`river.test.ts` — "carries a required dollar annotation on every constriction".

**Residual risk.** The annotation's *presence* is enforced in the geometry; its legibility
is not, because placement is not built yet. See the known gap below.

---

## 2. Constriction — cost as a reduction in width

**Wrong conclusion.** *"This company has two costs and that one has one, so this one is
more complicated."* Constriction count is disclosure depth, not operating structure
(decision 0005).

**Defense.** `disclosure.costCategoriesDisclosed` and `disclosure.labelRequired` travel on
every river so the count cannot reach the screen unlabeled, following the precedent 3.8
sets for single-segment filers.

**Tests.** `river.test.ts` — "renders exactly the categories disclosed", "reaches the same
mouth width from a different disclosure depth", "marks the count as requiring a label".

**Second wrong conclusion.** *"The costs shown are all the costs."* For a filer disclosing
one combined line that is true by construction; for one disclosing two, the river still
reconciles exactly, because a river that does not reconcile refuses to render rather than
absorbing the difference (`segment-does-not-reconcile`, escalating D18).

---

## 3. The trunk constriction — tax and non-operating items

**Wrong conclusion A.** *"That is another cost like the others, so operations are less
efficient than they look."* This is the expensive one: it damages Invariant 1's promise
that a river staying wide signals efficiency.

**Defense.** `kind: 'trunk-residual'` and `distinctTreatmentRequired: true` are carried on
the geometry, so the renderer cannot draw it in the same language as a segment cost
without ignoring a field. Position after the confluence is *not* accepted as sufficient —
a beginner does not know what that position means. The distinguishing cue is Atelier's and
may not be colour alone (3.10). Longitudinal span stays identical to every other
constriction so the distinction never leaks into the quantitative channel.

**Wrong conclusion B.** *"That money was wasted."* Tax is a claim, not waste. The defense
is plain-language labelling, and the label is an input to `composeTrunk`, not a default it
supplies — final wording is Angel's under protocol §3 (0002 C5).

**Wrong conclusion C.** *"So the lake is what shareholders got."* It is not; net income is
retained or distributed and this picture shows neither. Nothing in this directory emits
that framing, and 0001 C4 forbids it in copy.

**Tests.** `trunk.test.ts` — "is marked as requiring a distinct treatment", "does not take
the distinction from its length", "does not take the distinction from colour", and the K5
check that no attention effect appears anywhere in the model.

---

## 4. Lake area — net earnings as surface area

**Wrong conclusion A — the conservation read.** *"That much water flowed in and that much
collected, so almost everything survived"* — or the reverse, depending on how the lake
happens to be sized against the trunk. **There is no defense, and the encoding does not
attempt one.** Width is px/$ and area is px²/$; their ratio has units of pixels and no
invariant pins it. This is open question Q1, it is Angel's, and it is left as a live seam:
`lake.junction` is an unresolved value that a renderer must handle explicitly, and
`UNRESOLVED_JUNCTION.forbidden` names the three ways it must not be closed. The concrete
size of the problem, at the constants shipped: Microsoft's trunk arrives at 155.24px and
the lake has an equivalent diameter of 412.67px. Whatever a viewer concludes from that
2.658× is not something the data said.

**Wrong conclusion B — the balance-sheet read.** *"That is Microsoft's money."* A stock
reading of one period of flow.

**Defense.** `fiscalPeriodLabel` is a *required argument*: `composeLake` refuses to
compose without one, for a filled lake exactly as for a drained basin (0001 C3). Test:
`lake.test.ts` — "refuses to compose a lake with no period label".

**Wrong conclusion C — perceptual understatement.** Area is perceived at an exponent near
0.7, so a lake twice as large reads as roughly 1.6× larger. Every magnitude comparison
made from area is compressed.

**Defense.** The numeric label, not a distorted scale. `netEarningsReadout` is a required,
non-optional field marked `persistent` and `tabularNumerals`, so the exact figure is text
on screen at all times and the analyst's path to it never routes through area (0001 C2).
A Stevens correction is killed at K4 and `area.test.ts` asserts a constant px²/$ ratio
across four decades, which is what would break if one were added.

**Honest scope note, from 0001 §1.** In the vertical slice there is one lake, one period,
and nothing else on the canvas at the same area constant, so the lake's *area* conveys
nothing to a beginner. It is inert, not wrong. It becomes load-bearing at company two or
period two. It must not be presented in the slice as though the beginner is learning
something from the lake's size.

---

## 5. Basin plan area and depth — a negative year

**Wrong conclusion.** *"A deep hole is a bigger loss than a wide one"* — reading depth as
a second magnitude — and *"the company is $10B in the hole"* — the balance-sheet read
again, which a hole in the ground invites even more strongly than a lake does.

**Defense.** Plan area carries the magnitude on the same signed constant as the lake, so a
−$10B basin and a +$10B lake have identical footprints (0006, 0001 C5). Depth is pinned by
identity to the width constant — "as deep as a river carrying the same dollars is wide" —
which leaves no free parameter to tune and needs no second indicator (K12). No volumetric
cue may be derived from it (K13), and `volumetricShadingForbidden: true` says so on the
geometry. The period label is required as above.

**Tests.** `area.test.ts` — the whole C5 block, including "refutes kill-list K11".
`depth.test.ts` — "is pinned to the width constant by identity, leaving no free parameter".
`lake.test.ts` — "carries the sign by cues that are not size and not colour".

**Microsoft cannot exercise this.** It is built now because 0006 requires the constant to
be defined once for both signs rather than settled for profit and retrofitted for loss.

---

## 6. The closed trunk — a residual wider than the flow it claims

Shipped with the fix that made a loss-making filer composable at all. Until it landed,
`composeCanvas` threw for any negative net earnings and Invariant 3.4 was unreachable
through the entry point, so this encoding had no reader and no misreading test.

**What is drawn.** When net earnings are negative the trunk's residual is
`arriving + |net|` — a claim wider than the whole trunk. A cost cannot remove more width
than exists, so the constriction consumes the trunk completely: `departingWidthPx` 0,
`departingUsd` $0, `terminatesAtConstriction` true, and the basin below holds the
remainder.

**Wrong conclusion A — the expensive one.** *"The pinch cost what the trunk was carrying"*
— the reader takes the removal they can see, $10B, as the size of the claim, when the claim
was $18B. The width channel saturates and the eye cannot detect the saturation.

**Defense.** `costUsd` and `annotation.valueUsd` keep the **full** claim, never the drawn
part, so the number on screen is the true one and the annotation is mandatory (0002 C2).
The gap is not left implicit in the data either: `ConstrictionOverdraw` states
`claimedCostUsd`, `representedCostUsd`, `unrepresentedUsd` and its width, and carries
`annotationRequired: true`, so the shortfall must be stated in dollars at the constriction.
The arithmetic is closed and testable — `removedWidthPx + unrepresentedWidthPx =
widthPx(costUsd)` on one constant — which is how Invariant 3.2 is satisfied in sum rather
than per channel: no dollars leave the picture, they change channel.

**Wrong conclusion B — the one the naive fix would have created.** *"The company kept
$8B"* — if the departing width had been set to `widthPx(|net|)`, a -$8B year would draw an
8px trunk flowing onward. Width has no sign channel, so a loss would read as a profit of
the same size. This is the reason the departing width is zero and not the magnitude.

**Defense.** Structural. `departingUsd` is `max(net, 0)` and is documented as what the
*width* claims, never as the reported result; the signed figure lives only on the lake's
persistent readout (0001 C2) and in `totals.netEarningsUsd`. A test asserts the departing
width is not the magnitude of the loss.

**Wrong conclusion C.** *"The rivers dried up"* / *"the company had no revenue."*

**Defense.** The rivers are untouched by the sign of the result: a test asserts every head
and mouth width is identical to the profitable twin's. The closure happens at the annotated
constriction, which is exactly Invariant 3.4's picture — rivers still flow in and are still
consumed, and the loss is the void that revenue failed to fill, not an absence of revenue.

**Why this is a derivation and not a clamp.** `depth.ts` pins `DEPTH_USD_PER_PX` to
`WIDTH_USD_PER_PX` by identity, so the width the constriction could not remove **is** the
depth the basin sinks below grade — the same number, not a calibrated one. There is no free
parameter here to tune and no second on-screen indicator (K12). That identity is asserted
directly, and it fails first if anyone ever unpins the depth constant.

**Tests.** `loss-case.test.ts` — "makes unrepresented width and basin depth the same
number", "conserves the claim across both channels, at every constriction on the canvas",
"consumes the trunk entirely rather than drawing a signless departing flow", "leaves the
rivers untouched", "sweeps net earnings through zero with no throw, no negative width, no
discontinuity", and the 3.7 block under a loss. `trunk.test.ts` — the Invariant 3.4 block
and `closeConstriction`.

**Open, and not decided here.** The trunk terminus label prints `departingUsd`, which is
`$0M` on a closed trunk. Whether that is the right thing to say, and what the caption at a
fully consumed terminus reads, is Angel's and Atelier's wording, not Cartographer's. The
geometry states the fact; it does not author the sentence.

---

## Colour-vision verification (Invariant 3.10)

**Result: passes trivially, and the reason is worth stating rather than claiming a
simulation that was not run.** No encoding shipped here uses colour at all, and that
includes the loss branch — `loss-case.test.ts` re-asserts the absence of colour and of flow
speed on a composed basin, so the drained basin cannot acquire a hue by being the one path
nobody checked. There is no
hue, no fill, no stroke and no palette anywhere in the model — `compose.test.ts` asserts
that the serialised canvas matches no colour token, and `index.test.ts` asserts the same
of the scale manifest. Every channel in use is size, position-order, or text. Under
deuteranopia or protanopia the picture is unchanged because there is nothing to confuse.

This holds only until D15 is answered and segment hue becomes an encoding. At that point a
real simulation is required and this section must be rewritten, not extended.

---

## Known gap: label placement

Cartographer's definition of done requires deterministic, collision-free label placement
tested at three viewport widths. **It is not built and is not claimed.** What ships is the
*requirement*, attached to the geometry that needs it: every constriction carries a
required `annotation` with its dollar value and the width being dimensioned, every river
carries `disclosure.labelRequired`, and the lake carries a required persistent readout and
a required period label. A placement solver needs Atelier's type metrics and, for anything
on the lake side, needs Q1 answered first. Until then no label position exists to collide.


## 7. The world dressing cannot be read as data (decision 0038)

The scenery invites four wrong conclusions, each with a mechanical defense:

**"Taller hills mean a better company."** The hills are seeded by the CIK string alone;
every ridge tile is a pure function of (seed, tile index). `world.test.ts` doubles every
filed figure and asserts the shared tiles are byte-identical, and a source scan asserts
`world.ts` names no financial field. Contrast with the lake: the lake IS data, so its
outline must be inert in shape; the hills are dressing, so their shape must be provably
disconnected from the filing. Two different obligations, both tested.

**"The terraces are a data series."** There are no terraces — trimmed under Angel's
governing clause. The anti-bar law binds what remains: bounded slopes, no vertical edges,
3–5 vertices per 160px tile, so no ridge can drift toward chart-shapes.

**"The mist marks uncertainty."** Mist lives only in the sky band, above the fence no
label or geometry crosses, in one near-achromatic tone at alpha ≤ 0.2. It touches
nothing that carries a number.

**"The world bridges the trunk-lake separation."** The terrain runs continuously under
the gap by Angel's ruling, and the separation rule is drawn ON TOP of the world, with
the gap constant untouched (`junction.test.ts`). Land under both is what the metaphor
already claimed; the water still visibly does not connect.
