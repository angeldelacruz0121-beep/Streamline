/**
 * Adversarial corpus capture. QA Engineer owns this file (protocol §3).
 *
 * Run ONCE, by hand, against a running proxy. Never run in CI and never run by a
 * test. Protocol §8: "Fixtures are static. QA Engineer builds each fixture once
 * and commits it. Fixtures are never regenerated, only extended." Re-running this
 * against a later EDGAR state would silently replace a captured refusal with a
 * different one and destroy the evidence a finding was filed against.
 *
 *   npm run server            # proxy on 8787, holds the User-Agent and the 10/s budget
 *   node fixtures/capture/capture.ts
 *
 * Everything goes through the proxy (Invariant 4.6). Nothing here talks to
 * sec.gov directly: a capture that bypassed the proxy would bypass the rate
 * limiter and the contact header at the same time.
 *
 * Decision 0010 governs the form: the bytes are written exactly as the proxy
 * sent them, never edited, never recomposed from what a schema expects. What is
 * captured here is the response of the route that actually ships, so a test
 * written against it is a test against the thing users will hit.
 *
 * EXTENDING: add a row to `CORPUS`, run with `--only=<slug>`, commit the new
 * file and the regenerated manifest row. Do not re-capture existing rows.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const PROXY = process.env.STREAMLINE_PROXY ?? 'http://127.0.0.1:8787';
const OUT = new URL('../envelopes/', import.meta.url).pathname;

/**
 * One row per filer. `attacks` names the standing-set case from
 * `.claude/agents/qa-engineer.md` that the filer was chosen to exercise; it is
 * the reason the filer is in the corpus, not a prediction of what it returns.
 */
interface CorpusRow {
  readonly slug: string;
  readonly ticker: string;
  readonly cik: string;
  readonly attacks: string;
}

const CORPUS: readonly CorpusRow[] = [
  { slug: 'unity', ticker: 'U', cik: '0001810806', attacks: 'negative-net-earnings' },
  { slug: 'uber', ticker: 'UBER', cik: '0001543151', attacks: 'negative-net-earnings' },
  { slug: 'servicenow', ticker: 'NOW', cik: '0001373715', attacks: 'single-segment' },
  { slug: 'snowflake', ticker: 'SNOW', cik: '0001640147', attacks: 'single-segment-and-loss' },
  { slug: 'meta', ticker: 'META', cik: '0001326801', attacks: 'dominant-segment' },
  { slug: 'alphabet', ticker: 'GOOGL', cik: '0001652044', attacks: 'dominant-segment' },
  { slug: 'ibm', ticker: 'IBM', cik: '0000051143', attacks: 'segment-reclassification' },
  { slug: 'adobe', ticker: 'ADBE', cik: '0000796343', attacks: 'fiftytwo-week-and-non-december' },
  { slug: 'cisco', ticker: 'CSCO', cik: '0000858877', attacks: 'fiftytwo-week-and-non-december' },
  { slug: 'autodesk', ticker: 'ADSK', cik: '0000769397', attacks: 'non-december-fiscal-year' },
  { slug: 'sap', ticker: 'SAP', cik: '0001000184', attacks: 'non-usd-currency' },
  { slug: 'amdocs', ticker: 'DOX', cik: '0001062579', attacks: 'non-usd-currency' },
  { slug: 'supermicro', ticker: 'SMCI', cik: '0001375365', attacks: 'restatement-and-amendment' },
  { slug: 'nvidia', ticker: 'NVDA', cik: '0001045810', attacks: 'out-of-coverage' },
  { slug: 'apple', ticker: 'AAPL', cik: '0000320193', attacks: 'companion-axis' },
  { slug: 'hp', ticker: 'HPQ', cik: '0000047217', attacks: 'twelve-plus-segments' },
  { slug: 'ncrvoyix', ticker: 'VYX', cik: '0000070866', attacks: 'twelve-plus-segments' },
  { slug: 'jackhenry', ticker: 'JKHY', cik: '0000779152', attacks: 'twelve-plus-segments' },
  { slug: 'diebold', ticker: 'DBD', cik: '0000028823', attacks: 'twelve-plus-segments' },
];

async function main(): Promise<void> {
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
  const rows = only === undefined ? CORPUS : CORPUS.filter((r) => r.slug === only);

  mkdirSync(OUT, { recursive: true });

  const manifest: unknown[] = [];

  for (const row of rows) {
    const file = `${row.slug}-${row.cik}-segments.json`;
    const url = `${PROXY}/api/edgar/company/${row.cik}/segments`;

    // Never overwrite. Protocol §8: extended, never regenerated.
    if (existsSync(`${OUT}${file}`) && only === undefined) {
      const body = readFileSync(`${OUT}${file}`, 'utf8');
      manifest.push(describe(row, file, body, null));
      continue;
    }

    const started = Date.now();
    const response = await fetch(url);
    const body = await response.text();
    const elapsedMs = Date.now() - started;

    writeFileSync(`${OUT}${file}`, body);
    manifest.push(describe(row, file, body, { status: response.status, elapsedMs }));
    process.stdout.write(`${row.slug} ${String(response.status)} ${String(body.length)}B\n`);
  }

  writeFileSync(`${OUT}MANIFEST.json`, `${JSON.stringify(manifest, null, 2)}\n`);
}

function describe(
  row: CorpusRow,
  file: string,
  body: string,
  live: { status: number; elapsedMs: number } | null,
): unknown {
  let envelopeKind: string | null = null;
  let viewKind: string | null = null;

  try {
    const parsed = JSON.parse(body) as { kind?: unknown; view?: { kind?: unknown } };
    envelopeKind = typeof parsed.kind === 'string' ? parsed.kind : null;
    viewKind = typeof parsed.view?.kind === 'string' ? parsed.view.kind : null;
  } catch {
    envelopeKind = 'unparseable';
  }

  return {
    ...row,
    file,
    bytes: body.length,
    sha256: createHash('sha256').update(body).digest('hex'),
    envelopeKind,
    viewKind,
    live,
  };
}

await main();
