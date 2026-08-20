# Streamline — prototype notes

**What this is:** a throwaway visual proof that a company's earnings can be read as water.
Rivers = revenue segments, width ∝ dollars, bottlenecks = costs bleeding into spill channels,
the lake = the company. What reaches the lake is net contribution. Verdict on the two questions
it was built to answer: the metaphor reads in five seconds, and the motion holds a locked frame
rate with ~10× headroom.

Run it:

```
npm run dev        # port 5180
```

`?reduced` in the URL forces the reduced-motion still frame (dev only).
`window.__streamline.stats()` / `.bench(600)` in the console for frame numbers.

## The three decisions, as built

- **Spline sampling** — every river is one cubic Bézier resampled to 384 points equally spaced
  in arc length; `t` IS normalized arc length, so speed is uniform through curves. Normals from
  central differences; curvature clamps the width so offset curves can't self-intersect.
- **Width** — `w(t) = wSteady(t) · pinch(t)`. `wSteady` is linear in remaining flow on one global
  scale (widths comparable *between* rivers). `pinch` is a narrow Gaussian throat at each cost;
  `speedMul = 1/pinch` gives mass-continuity acceleration through the throat only. Emission ∝
  gross ⇒ areal brightness is constant everywhere — width alone carries the number.
- **Recycling** — fixed pool, closed loop (head → cull/divert → lake → head), stages sized by
  steady-state occupancy integrals, warm-started so frame 1 is already steady. Permanent
  per-particle speed jitter decoheres the pool within one transit — there is no loop point to see.

## Review round 2 (feedback pass)

What changed after the first review:

- **Width was never broken — rendering was.** Measured `w(t)`: source half-widths 54 / 29 / 11 /
  7.1px, exactly ∝ gross. The flattener was a fixed 5–10.5px sprite: one sprite fills a narrow
  channel solid while the same sprite scatters thin across a wide one, inverting perceived weight.
  Sprite diameter is now ∝ local channel width (`D_PER_W`). Linear revenue→width mapping kept —
  a power curve would *compress* the 7.6× ratio, not amplify it.
- **Two structural flatteners found by adversarial review and fixed:** the cost window started at
  t=0.39 so the full entry-width ratio only existed off-frame (moved downstream to 0.44–0.8), and
  wedge lanes were allotted by √gross while widths draw ∝ gross (lanes now ∝ gross, floored).
- **Sparks → water:** particles accumulate in a half-res buffer, decayed via destination-out
  (dt-corrected), downsampled to quarter-res with a 1.6px blur, composited back additively as
  bloom + core. Per-particle alpha dropped ~4×; count raised (cap 9000). The decay is clamped
  at 0.25/frame: in 8 bits, `α·(1−k)` rounds back to α wherever α < 0.5/k, so smaller decays
  leave a permanent white deposit along every path (worst on 120Hz panels, where dt-correction
  halves k). k=0.25 pins the floor at 1/255. A periodic stronger wipe does NOT work —
  `round(3·0.984)=3` — and wipes pulse the trail; adversarial review caught this after a first
  version shipped exactly that.
- **Degrade rebuilds no longer flash dark:** all trail energy lives in the accumulation buffer,
  so recreating it cold on a degrade step dropped the image to ~1/7 brightness for ~20 frames —
  on exactly the hardware the ladder protects. The old field now blits forward on degrade
  (resize stays cold — the layout moves). DPR cap steps at both levels (2 → 1.75 → 1.5) since
  it is the only lever that scales the fixed three-pass composite cost.
- **Lake depth:** offset radial gradient (light from the far shore), elliptical drifting shimmer
  bands, absorption glow at each mouth sized by that river's net, hairline rim.
- **Honest steady state:** the "uniform" lake was a warm-start artifact — real arrivals enter at
  the mouths. Warm start is now mouth-anchored with age-spread angles; milling speed raised so
  one residence carries a particle around the basin. Arrival snap at the mouth fixed (base
  radius now from the actual arrival point).
- **Spills dissipate:** longer channels (wedge-capped), taper to zero, fade over the last 60%.
- **Debug overlay:** press `d` — fps, frame ms, particle count, recycles/s, degrade level.
  Recycle smoothness measured: ~613/s, CV 4.2% (Poisson-level; no pulsing).
- The lake sine set was exactly commensurable (gcd 0.01 → 628s period); rates now genuinely
  irrational multiples.

Numbers after the round: 7,434 particles at 1600×1026@2x — p50 2.8ms / p90 3.5ms / p99 7.1ms
against the 16.7ms budget.

## What I'd tune next

1. **Legacy Hardware's post-cost thread** reads *dashed* at 2px floored width — the honest
   alpha compensation (light ∝ flow) makes it very faint. It tells the "dying river" story, but
   I'd try flooring at 2.5px with a gentler comp curve, or a slight bloom pass on sub-floor
   channels, so "shrinking" never gets confused with "renderer bug".
2. **Spill channel endings.** Water currently fades out mid-air inside the wedge. Better: a
   subtle evaporation treatment — particles decelerating and diffusing laterally as they fade —
   so the loss reads as dissipation rather than clipping.
3. **The mobile view is shrunk, not art-directed.** It rebuilds and stays legible, but a phone
   wants its own composition — probably rivers from the top only, lake at the bottom third,
   labels inline with the flow. (Known tell; deliberate scope cut here.)
4. **Lake shore interaction.** Arrivals currently slip under the surface. A small displacement
   ripple on the sine-displaced boundary where a river lands — amplitude ∝ that river's net —
   would tie the two systems together and reward the 5-second read with a 30-second one.
5. **Label collision at extreme aspect ratios** is handled by staggered heights + clamping, not
   real collision resolution. Fine at 4 segments; would need a pass at 8.
6. **Exposure constant** (`AREAL_TARGET = 0.045`) was tuned on a 2× MacBook panel. On a 1× panel
   the additive accumulation differs slightly; worth one calibration pass per DPR bucket.
7. **Palette** is deliberately unresolved — luminance only, near-black ground `#0b0d10`, one
   lake-floor tone. When a palette lands, the only file that should need touching is
   `render.js` (sprite tint + ground + floor).

## Bugs found by watching (kept for the record)

- Bottlenecks crowded the top of the frame because sources sat at 1.15× corner distance —
  ~40% of every spline was off-screen. Sources now sit just past the wedge ray's viewport exit.
- Spill channels curled *upstream* like thorns — perpendicular sign was inverted.
- Fixed particle count blew out exposure on small viewports — the budget now derives from a
  target areal density (same math that keeps brightness honest between rivers).
- The lake's two-gyre field piled residents onto the bottom rim (soft/hard walls just changed
  the shape of the pile). Replaced with per-particle radial relaxation + tangential milling —
  uniform by construction.
- The lake "breathe" wobble was being baked into position state each frame, turning a bounded
  oscillation into a random walk that stacked particles dead-center. Base radius is now its own
  state; breathe is applied only at writeback.

## Verified

- 5,999 particles at 1440×900@2x; update+render **p50 1.7 ms, p90 3.5 ms** per frame (16.7 ms
  budget) over 600 consecutive frames; rAF cadence a flat 8.3 ms on a 120 Hz panel.
- 30-second watch: no drift, no pulsing, no seam, no accumulation; the four widths stay distinct.
- Hover: readout with count-up figures, hovered river brightens on a critically-damped spring,
  others dim; miss correctly shows nothing.
- Resize: desktop / tablet / mobile all rebuild with wedge-guaranteed no-crossing geometry.
- `prefers-reduced-motion`: one composed still frame with ghost-streak trails, media-query
  listener live.
- Console clean.
