import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { drawRiverBody } from './draw-river';
import { drawScene } from './draw-scene';
import { CONSTRICTION_CUES, JUNCTION_SEPARATION_PX, SPACING, TONES } from './placeholders';
import { layoutScene } from './layout';
import { composeOrThrow, microsoftFy2026, referenceLoad } from './reference-load';
import { RecordingContext } from './testing/recording-context';

const VIEWPORT = { widthPx: 1440, heightPx: 900 };

/** Source with comments stripped. The prose explains the exclusions; the code must obey them. */
function codeOf(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function render(): RecordingContext {
  const ctx = new RecordingContext();
  drawScene(ctx.as(), layoutScene(composeOrThrow(microsoftFy2026()), VIEWPORT), {
    effectsQuality: 1,
    particleX: new Float32Array(0),
    particleY: new Float32Array(0),
    particleCount: 0,
    highlightId: null,
    noteTextOverride: null,
  });
  return ctx;
}

/**
 * D15 (segment hue) and D9 (growth-to-speed) are open. Cartographer proved their absence
 * from the model by test rather than by assertion; this is the same proof one layer down,
 * on the pixels. Nothing is worth more than these two tests if the alternative is a hue
 * quietly hardening into an encoding while Angel is deciding.
 */
describe('D15 — no colour reaches the canvas', () => {
  it('emits nothing above 10% saturation, and one shared fill across the rivers', () => {
    for (const [name, tone] of Object.entries(TONES)) {
      // Adopted `Tone` shape (canvas-tokens): rgb channels plus alpha, replacing the
      // placeholder's single achromatic level under the same widened D15 contract.
      for (const channel of [tone.r, tone.g, tone.b]) {
        expect(typeof channel, name).toBe('number');
        expect(channel, name).toBeGreaterThanOrEqual(0);
        expect(channel, name).toBeLessThanOrEqual(255);
      }
      expect(tone.alpha, name).toBeGreaterThanOrEqual(0);
      expect(tone.alpha, name).toBeLessThanOrEqual(1);
    }
    // Angel's ruling 2026-08-21, superseding the pure-gray (R = G = B) form: DESIGN.md
    // binds a water ramp carrying the ground's slight blue cast — e.g. rgb(28,29,31),
    // ~9.7% saturation — so the pixel guard is now ONE shared fill, saturation ≤ 10%,
    // zero per-segment variation. The bound applies to EVERY emitted colour, not only
    // water; a legitimate token should never trip it, and one that does is a finding.
    // Saturation is (max − min) / max per colour, 0 for black.
    for (const colour of render().colours()) {
      const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(colour);
      if (match === null) continue;
      const channels = [Number(match[1]), Number(match[2]), Number(match[3])];
      const max = Math.max(...channels);
      const min = Math.min(...channels);
      const saturation = max === 0 ? 0 : (max - min) / max;
      expect(saturation, colour).toBeLessThanOrEqual(0.1);
    }

    // Zero per-segment variation, proven on the pixels rather than the source: every
    // river body, drawn alone, emits exactly one fill style, and it is the same one for
    // all of them. The source-level test below remains the assertion guarding D15.
    const scene = layoutScene(composeOrThrow(microsoftFy2026()), VIEWPORT);
    const fills = new Set<string>();
    for (const lane of scene.rivers) {
      const ctx = new RecordingContext();
      drawRiverBody(ctx.as(), lane, { effectsQuality: 1 });
      const laneFills = new Set(ctx.ops('fill').map((call) => call.fillStyle));
      expect(laneFills.size, lane.id).toBe(1);
      for (const fill of laneFills) fills.add(fill);
    }
    expect(fills.size).toBe(1);
  });

  it('gives every river the identical fill, so hue cannot pre-empt a segment scale', () => {
    // Not "no hue but a lightness ramp" — that would be an ordinal channel by another
    // name. Segment differentiation is position, width and label. Nothing else.
    const source = codeOf('src/viz/render/draw-river.ts');
    expect(source).toContain('TONES.water');
    expect(source).not.toMatch(/TONES\.water\w+\[/);
    expect(source).not.toMatch(/index|laneIndex/);
  });

  it('mentions no hue anywhere in the owned source', () => {
    const files = [
      'placeholders.ts',
      'draw-river.ts',
      'draw-trunk.ts',
      'draw-junction-seam.ts',
      'draw-scene.ts',
    ];
    for (const file of files) {
      const source = codeOf(`src/viz/render/${file}`);
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source, file).not.toMatch(/\bhsl\(|\bhue\b/i);
    }
  });
});

describe('D9 — no growth-to-speed mapping exists', () => {
  it('has no growth input anywhere in the render or particle layers', () => {
    const files = [
      'src/viz/render/layout.ts',
      'src/viz/render/renderer.ts',
      'src/viz/render/scene.ts',
      'src/viz/particles/system.ts',
      'src/viz/particles/density.ts',
    ];
    for (const file of files) {
      expect(codeOf(file), file).not.toMatch(/growth|yoy|priorPeriod/i);
    }
  });

  it('labels the baseline, as Invariant 3.5 requires for a flow with no comparison', () => {
    const scene = layoutScene(composeOrThrow(microsoftFy2026()), VIEWPORT);
    const note = scene.notes.find((n) => n.code === 'baseline-flow');
    expect(note?.text).toContain('baseline flow speed');
    expect(note?.text).toContain('varies with nothing');
    expect(render().texts().join(' ')).toContain('baseline flow speed');
  });
});

describe('spacing and cues carry no quantity', () => {
  it('keeps every spacing value a constant', () => {
    for (const [name, value] of Object.entries(SPACING)) {
      expect(typeof value, name).toBe('number');
    }
    expect(typeof JUNCTION_SEPARATION_PX).toBe('number');
  });

  it('distinguishes the trunk constriction by shape, not by colour or by length', () => {
    expect(CONSTRICTION_CUES['trunk-residual'].rimCount).not.toBe(
      CONSTRICTION_CUES['segment-cost'].rimCount,
    );
    expect(CONSTRICTION_CUES['trunk-residual'].throatTicks).toBe(true);
    expect(CONSTRICTION_CUES['segment-cost'].throatTicks).toBe(false);

    // And the span — the quantitative channel's neighbour — is identical.
    const scene = layoutScene(composeOrThrow(microsoftFy2026()), VIEWPORT);
    const spans = new Set(
      [...scene.rivers.flatMap((l) => l.constrictions), scene.trunk.constriction].map(
        (c) => c.spanPx,
      ),
    );
    expect(spans.size).toBe(1);
  });

  it('sources every token group from the design module, keeping the copy Angel-marked', () => {
    // Adopted 2026-08-21: the ATELIER-REPLACE contract is fulfilled. The groups live in
    // `canvas-tokens.ts` and are re-exported here so the render layer keeps one import
    // point and a value cannot fork between layers — a group defined locally again
    // would be a fork, and this test refuses it.
    const source = readFileSync('src/viz/render/placeholders.ts', 'utf8');
    expect(source).toContain("from '../../design/tokens/canvas-tokens'");
    for (const name of [
      'TONES',
      'TYPE',
      'CONSTRICTION_CUES',
      'SPACING',
      'JUNCTION_SEPARATION_PX',
    ]) {
      expect(source, name).toContain(name);
      expect(source, name).not.toContain(`export const ${name}`);
    }
    // The copy block stays local and stays Angel's under protocol §3.
    expect(source).toContain('ANGEL-COPY');
    expect(source).toContain('export const COPY');
  });
});

describe('the perf fixture cannot reach the application', () => {
  it('is not re-exported from the renderer barrel', async () => {
    expect(codeOf('src/viz/render/index.ts')).not.toContain('reference-load');
    const module = (await import('./index')) as Record<string, unknown>;
    expect(module['microsoftFy2026']).toBeUndefined();
    expect(module['referenceLoad']).toBeUndefined();
  });

  it('is not imported by the mountable component', () => {
    expect(codeOf('src/viz/render/canvas.tsx')).not.toContain('reference-load');
  });

  it('still holds only reported figures, never a placeholder', () => {
    const input = referenceLoad(12);
    for (const segment of input.segments) {
      expect(segment.revenueUsd).toBeGreaterThan(0);
      expect(segment.id).toMatch(/^msft:/);
    }
  });
});
