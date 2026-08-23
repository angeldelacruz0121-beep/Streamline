/**
 * Entry point. The only place in the project that constructs the real network
 * transport, and the only place that reads `SEC_CONTACT_EMAIL`.
 *
 * If that variable is unset this process exits before it can open a socket -
 * which is the intended behaviour, not an inconvenience (Invariant 4.6).
 *
 * Run with `npm run server`.
 */
import { createServer } from 'node:http';
import { createEdgarClient } from '../src/data/sec/client.ts';
import { nativeFetchTransport } from '../src/data/sec/transport.ts';
import { SecContactEmailError } from '../src/data/sec/user-agent.ts';
import { DEFAULT_CACHE_DIR, FileCacheStore } from './file-cache.ts';
import { createEdgarProxyHandler } from './proxy.ts';
import { DEFAULT_SEGMENTS_CACHE_DIR, SegmentsCache } from './segments-cache.ts';

/**
 * Startup used to print the composed User-Agent verbatim, which put the contact
 * address into stdout and therefore into any terminal scrollback, CI log or
 * screen recording of a session. Decision 0009 keeps the address out of the
 * repository; this keeps it out of the logs. The local part is masked so the
 * line still proves a real address was loaded.
 */
function maskContact(userAgent: string): string {
  return userAgent.replace(/([^\s(;]+)@([^\s)]+)/, (_match, _local: string, domain: string) => {
    return `***@${domain}`;
  });
}

const port = Number(process.env['PORT'] ?? 8787);
const host = process.env['HOST'] ?? '127.0.0.1';
const cacheDir = process.env['EDGAR_CACHE_DIR'] ?? DEFAULT_CACHE_DIR;
/**
 * Derived views live apart from the raw EDGAR bytes they were built from. Two
 * different lifetimes for two different reasons: the raw cache is invalidated by
 * EDGAR publishing something new, the derived cache by this project changing how
 * it reads what EDGAR already published - which it now notices by itself, see
 * `extraction-fingerprint.ts`. Retiring a derived view must never cost a
 * re-download of a 10.9MB instance, which is why the two live apart.
 */
const segmentsCacheDir = process.env['SEGMENTS_CACHE_DIR'] ?? DEFAULT_SEGMENTS_CACHE_DIR;

function start(): void {
  const client = createEdgarClient({
    transport: nativeFetchTransport,
    cache: new FileCacheStore(cacheDir),
  });

  const segments = new SegmentsCache({ store: new FileCacheStore(segmentsCacheDir) });

  createServer(createEdgarProxyHandler(client, segments)).listen(port, host, () => {
    process.stdout.write(
      `EDGAR proxy listening on http://${host}:${port} (cache: ${cacheDir})\n` +
        `Segment views cached in ${segmentsCacheDir}\n` +
        `User-Agent: ${maskContact(client.userAgent)}\n`,
    );
  });
}

try {
  start();
} catch (error) {
  if (error instanceof SecContactEmailError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }

  throw error;
}
