# 0038 — The world dressing: terrain, sky, hills, mist around the honest geometry

Date:        2026-08-30
Status:      accepted; final look approval pending Angel's screenshot review
Decided by:  Angel

Context:     Angel asked whether the app could render every covered company in the same
             style as the marketing film's world, live, on any search. AI generation per
             company was ruled out to him plainly (film scenery encodes nothing, costs
             credits per view, would invent figures). What shipped instead is the honest
             version: the app's real computed geometry, dressed in the film's world.

             Angel's rulings, in his words and order:
             1. GOVERNING CLAUSE — usability, functionality, and the ability to see and
                understand the information come first; identical rendering on every
                search is a hard requirement; the aesthetic is kept only where it costs
                none of the above. Any fork resolves against the dressing.
             2. Hills and terrain, never bar-shaped scenery — nothing on screen may look
                like data unless it is data.
             3. Flat measured view — the film's dressing, never its perspective. Equal
                dollars stay equal pixels anywhere on screen.
             4. Taste: the dusk grade (approved on a deterministic pixel mock, not AI).
             5. §5 amendment: scenery colour families with hard bounds (terrain hue
                90–150° sat≤35% luma 22–46; sky wrapped ≤33° of 12°, sat≤45%, band-only;
                hills 15–150° sat≤30% luma 40–130; mist sat≤8% alpha≤0.2). All bounds
                enforced by canvas-tokens.test.ts. Reversible: yes.
             6. Terrain runs continuously under the trunk-lake separation; the rule is
                drawn on top; the gap constant is untouched.

Shape:       A 96px sky band above the content (sunset gradient, low-poly hill
             silhouettes, faint mist), geometrically fenced so no text can sit in it;
             dusk-green terrain replacing the near-black ground everywhere; the 0037
             water ramp unchanged, plus a specular-family rim glow at effects quality.
             The layout shifted down by exactly skyBandPx; no width, no flow-axis
             distance, and no scale constant was touched.

Consistency, enforced by construction and proven by test:
             - Hills are seeded by FNV-1a of the CIK STRING only. Every ridge tile and
               mist window is a pure function of (seed, index), so content extent chooses
               how many tiles are visible and can never change what any tile looks like.
               world.test.ts doubles every filed figure and asserts the shared tiles are
               byte-identical; a source scan asserts world.ts touches no financial field.
             - The re-trace law: everything gated by effectsQuality re-traces coordinates
               already emitted unconditionally that frame, so geometry-invariance passes
               untouched at every degradation rung.
             - The anti-bar law: bounded slopes, no vertical edges, 3–5 vertices per
               tile — asserted, so the scenery cannot drift toward chart-shapes.
             - Refusal surfaces (e.g. Meta pending 0032) render with NO world painted:
               the world draws only inside drawScene, and refusal arms never compose a
               Scene. Verified by screenshot.
             - Legibility: the dusk terrain's luminance cap keeps every existing label
               ink at AA (computed in contrast.test.ts: text ≈11.9:1, textDim ≈4.84:1
               over terrain.base) with zero new occluders.

Trimmed (reported, per the governing clause): bank terraces from the film's world were
             dropped — they would sit exactly where annotations anchor, and the clause
             says the dressing loses. The film's neon trend-line ridges and bar clusters
             never entered the app at all (ruling 2).

Verification: 86 files / 1075 tests green; typecheck and prettier clean. Perf gate:
             the world's attributable cost measured inside the plan's +0.3–0.8ms
             envelope; the absolute 4.1 gates flaked at the 25.0ms line on a loaded
             machine, and a bisect (world off, same minute) failed pacing WORSE
             (33.3ms), attributing the failures to machine noise, not the world. OPEN
             ITEM: re-run the gate and re-record the post-world baseline on a quiet
             reference machine before release.

Files:       src/viz/render/world.ts, draw-world.ts (+tests); canvas-tokens.ts
             WORLD_TONES/WORLD + guards; tokens.ts/tokens.css world families;
             draw-scene.ts z-order root + worldSeed; layout.ts skyBand offset;
             renderer.ts/canvas.tsx/RenderableSurface.tsx seed plumbing; rim glow in
             draw-river/draw-trunk/draw-junction-seam; no-encoding-leak colours() is
             now a ruled-family classifier; contrast.test.ts terrain checks.
