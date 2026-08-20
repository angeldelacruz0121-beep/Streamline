# Reference prototype — not the product

This is the earlier throwaway canvas prototype: hardcoded fictional company data, plain JS with
no types, no SEC data path, a flat file layout that predates and does not match
`AGENT-PROTOCOL.md`'s ownership table.

**It is not foundation code.** No agent owns this directory — it sits outside `src/`
deliberately so it is never mistaken for the live codebase. See
`docs/decisions/0001-prototype-disposition.md` for the reasoning.

**What's worth porting from it**, once Ledger and Cartographer have defined the real company
object and scale contract (`AGENT-PROTOCOL.md` §5):

- `src/engine/spline.js` — arc-length-parameterized Bézier sampling, so particle speed is
  uniform through curves regardless of curvature. Directly reusable.
- `src/engine/flow.js` — the width/pinch/speed table math. The *shape* of this (linear width
  scale, mass-continuity speed through constrictions) is compatible with Invariants 3.1–3.2;
  the actual numbers need to come from Ledger's data, not `data.js`'s fabricated figures.
- `src/engine/particles.js` — pool sizing from steady-state occupancy integrals, warm-start,
  and the decoherence approach to recycling. Solves a real problem (visible loop points /
  pulsing) that Forge will hit again regardless of data source.
- `src/engine/render.js` — the accumulation-buffer + bloom approach that makes particles read
  as water instead of sparks, including the 8-bit quantization fix for trail decay documented
  in `NOTES.md`.

**What is not salvageable as-is:** `data.js` (fabricated data — forbidden outright by
Invariant 4.5), the flat directory layout, the static-ellipse lake (Invariant 3.3 requires
area ∝ net earnings; this prototype's lake size doesn't respond to the numbers at all), and
the complete absence of the drained-basin (3.4) and growth-speed (3.5) encodings.

To run it standalone: `npm install && npm run dev` from this directory.
