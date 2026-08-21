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

function start(): void {
  const client = createEdgarClient({
    transport: nativeFetchTransport,
    cache: new FileCacheStore(cacheDir),
  });

  createServer(createEdgarProxyHandler(client)).listen(port, host, () => {
    process.stdout.write(
      `EDGAR proxy listening on http://${host}:${port} (cache: ${cacheDir})\n` +
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
