// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryCacheStore } from '../cache/store.ts';
import {
  dailyIndexText,
  microsoftSubmissions,
  MICROSOFT_10K_ACCESSION,
  MICROSOFT_10K_FILING_DATE,
  MICROSOFT_CIK,
  tickerMap,
} from './__fixtures__/microsoft.ts';
import { probeArchiveIndexComplete, TEST_CONTACT_EMAIL } from './__fixtures__/shape-probes.ts';
import { createEdgarClient } from './client.ts';
import {
  CONTACT_EMAIL_ENV_VAR,
  SecContactEmailError,
  userAgentCarriesContact,
} from './user-agent.ts';
import {
  acquireRateLimitSlot,
  getRateLimiterState,
  resetRateLimiterForTests,
  SEC_MAX_REQUESTS_PER_SECOND,
} from './rate-limit.ts';
import {
  assertEveryRequestCarriedContactEmail,
  startEdgarDouble,
  type EdgarDouble,
} from './testing/edgar-double.ts';
import type { EdgarTransport } from './transport.ts';

/**
 * Invariant 4.6's gate.
 *
 * These are not happy-path checks. Each one is written so that deleting the
 * control it guards makes it fail: the aggregate assertion covers every request
 * the suite emitted rather than a chosen one, the source scans fail on a new
 * bypassing call path, and the limiter test fails if the budget ever becomes
 * per-client instead of per-process.
 */

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCANNED_ROOTS = ['src/data/sec', 'src/data/cache', 'server'];

function sourceFiles(): readonly string[] {
  const found: string[] = [];

  for (const root of SCANNED_ROOTS) {
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);

        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|md)$/.test(entry.name)) found.push(full);
      }
    };

    walk(join(REPO_ROOT, root));
  }

  return found;
}

const isTestFile = (path: string): boolean =>
  path.endsWith('.test.ts') || path.includes('__fixtures__') || path.includes('/testing/');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

let double: EdgarDouble;

describe('User-Agent cannot be bypassed (Invariant 4.6)', () => {
  beforeAll(async () => {
    double = await startEdgarDouble();
  });

  afterAll(async () => {
    await double.close();
  });

  beforeEach(() => {
    double.reset();
    resetRateLimiterForTests();
  });

  it('carries a contact email on every request the whole client surface makes', async () => {
    double.route('/files/company_tickers.json', { status: 200, body: JSON.stringify(tickerMap) });
    double.route(`/submissions/CIK${MICROSOFT_CIK}.json`, {
      status: 200,
      body: JSON.stringify(microsoftSubmissions),
    });
    double.route(`/api/xbrl/companyfacts/CIK${MICROSOFT_CIK}.json`, { status: 200, body: '{}' });
    double.route(`/api/xbrl/companyconcept/CIK${MICROSOFT_CIK}/us-gaap/Revenues.json`, {
      status: 200,
      body: '{}',
    });
    double.route('/Archives/edgar/data/789019/000119312526323660/index.json', {
      status: 200,
      body: JSON.stringify(probeArchiveIndexComplete),
    });
    double.route('/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm', {
      status: 200,
      body: '<html></html>',
    });
    double.route('/Archives/edgar/daily-index/2026/QTR3/form.20260729.idx', {
      status: 200,
      body: dailyIndexText,
    });

    const client = createEdgarClient({
      contactEmail: TEST_CONTACT_EMAIL,
      transport: double.transport,
      cache: new MemoryCacheStore(),
    });

    await client.resolveCik('MSFT');
    await client.getSubmissions(MICROSOFT_CIK);
    await client.getFilingSeries(MICROSOFT_CIK, '10-K');
    await client.getCompanyFacts(MICROSOFT_CIK);
    await client.getCompanyConcept(MICROSOFT_CIK, 'us-gaap', 'Revenues');
    await client.getFilingIndex(MICROSOFT_CIK, MICROSOFT_10K_ACCESSION);
    await client.getArchiveDocument(MICROSOFT_CIK, MICROSOFT_10K_ACCESSION, 'msft-20260630.htm');
    await client.getDailyIndex(MICROSOFT_10K_FILING_DATE);

    // Seven network requests: getFilingSeries is served from the submissions
    // cache, which is why the count is not eight.
    expect(double.requests).toHaveLength(7);
    assertEveryRequestCarriedContactEmail(double.requests);
    expect(double.requests.every((entry) => userAgentCarriesContact(entry.userAgent ?? ''))).toBe(
      true,
    );
  });

  it('spends exactly one rate slot per network request and none per cache hit', async () => {
    double.route(`/submissions/CIK${MICROSOFT_CIK}.json`, {
      status: 200,
      body: JSON.stringify(microsoftSubmissions),
    });

    const client = createEdgarClient({
      contactEmail: TEST_CONTACT_EMAIL,
      transport: double.transport,
      cache: new MemoryCacheStore(),
    });

    await client.getSubmissions(MICROSOFT_CIK);
    await client.getSubmissions(MICROSOFT_CIK);
    await client.getSubmissions(MICROSOFT_CIK);

    expect(double.requests).toHaveLength(1);
    expect(getRateLimiterState().admittedTotal).toBe(1);
  });

  it('applies the header and the rate slot before the injected transport can run', async () => {
    const observed: { userAgent: string | null; admittedBefore: number }[] = [];
    const hostile: EdgarTransport = (request) => {
      observed.push({
        userAgent: request.headers.get('user-agent'),
        admittedBefore: getRateLimiterState().admittedTotal,
      });

      return Promise.resolve(new Response('{}', { status: 200 }));
    };

    const client = createEdgarClient({
      contactEmail: TEST_CONTACT_EMAIL,
      transport: hostile,
      cache: new MemoryCacheStore(),
    });

    await client.getCompanyFacts(MICROSOFT_CIK);

    expect(observed).toHaveLength(1);
    expect(userAgentCarriesContact(observed[0]?.userAgent ?? '')).toBe(true);
    expect(observed[0]?.admittedBefore).toBe(1);
  });

  it('refuses to construct a client when the contact variable is unset', () => {
    const saved = process.env[CONTACT_EMAIL_ENV_VAR];

    delete process.env[CONTACT_EMAIL_ENV_VAR];

    try {
      expect(() => createEdgarClient()).toThrow(SecContactEmailError);
      expect(() => createEdgarClient({ contactEmail: 'not-an-email' })).toThrow(
        SecContactEmailError,
      );
    } finally {
      if (saved !== undefined) process.env[CONTACT_EMAIL_ENV_VAR] = saved;
    }
  });
});

describe('rate limit cannot be bypassed (Invariant 4.6)', () => {
  beforeEach(() => {
    resetRateLimiterForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimiterForTests();
  });

  it('shares one budget across independently constructed clients', async () => {
    let dispatched = 0;
    const counting: EdgarTransport = () => {
      dispatched += 1;

      return Promise.resolve(new Response('{}', { status: 200 }));
    };

    const first = createEdgarClient({
      contactEmail: TEST_CONTACT_EMAIL,
      transport: counting,
      cache: new MemoryCacheStore(),
    });
    const second = createEdgarClient({
      contactEmail: TEST_CONTACT_EMAIL,
      transport: counting,
      cache: new MemoryCacheStore(),
    });

    const pending = Promise.all([
      ...Array.from({ length: 6 }, (_unused, index) =>
        first.getCompanyConcept(MICROSOFT_CIK, 'us-gaap', `ProbeTagA${index}`),
      ),
      ...Array.from({ length: 6 }, (_unused, index) =>
        second.getCompanyConcept(MICROSOFT_CIK, 'us-gaap', `ProbeTagB${index}`),
      ),
    ]);

    await vi.advanceTimersByTimeAsync(1);
    expect(dispatched).toBe(SEC_MAX_REQUESTS_PER_SECOND);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(dispatched).toBe(12);

    await pending;
  });

  it('gates a direct acquisition the same way it gates the client', async () => {
    let admitted = 0;
    const pending = Promise.all(
      Array.from({ length: 14 }, () =>
        acquireRateLimitSlot().then(() => {
          admitted += 1;
        }),
      ),
    );

    await vi.advanceTimersByTimeAsync(1);
    expect(admitted).toBe(SEC_MAX_REQUESTS_PER_SECOND);

    await vi.advanceTimersByTimeAsync(1_000);
    await pending;
  });
});

describe('no bypassing call path exists in the source', () => {
  it('calls fetch in exactly one production module', () => {
    const offenders = sourceFiles().filter((path) => {
      if (isTestFile(path) || !path.endsWith('.ts')) return false;

      return /(?<![.\w])fetch\s*\(/.test(read(path)) && !path.endsWith('sec/transport.ts');
    });

    expect(offenders.map((path) => relative(REPO_ROOT, path))).toEqual([]);
  });

  it('acquires a rate slot in exactly one production module', () => {
    const offenders = sourceFiles().filter((path) => {
      if (isTestFile(path) || !path.endsWith('.ts')) return false;

      return (
        read(path).includes('acquireRateLimitSlot') &&
        !path.endsWith('sec/transport.ts') &&
        !path.endsWith('sec/rate-limit.ts')
      );
    });

    expect(offenders.map((path) => relative(REPO_ROOT, path))).toEqual([]);
  });

  it('sets a User-Agent header in exactly one production module', () => {
    const offenders = sourceFiles().filter((path) => {
      if (isTestFile(path) || !path.endsWith('.ts')) return false;

      return /['"]user-agent['"]/i.test(read(path)) && !path.endsWith('sec/transport.ts');
    });

    expect(offenders.map((path) => relative(REPO_ROOT, path))).toEqual([]);
  });

  it('keeps the test double out of production code', () => {
    const offenders = sourceFiles().filter(
      (path) =>
        !isTestFile(path) && path.endsWith('.ts') && read(path).includes('testing/edgar-double'),
    );

    expect(offenders.map((path) => relative(REPO_ROOT, path))).toEqual([]);
  });

  it('keeps the limiter reset hatch out of production code', () => {
    const offenders = sourceFiles().filter(
      (path) =>
        !isTestFile(path) &&
        path.endsWith('.ts') &&
        !path.endsWith('sec/rate-limit.ts') &&
        read(path).includes('resetRateLimiterForTests'),
    );

    expect(offenders.map((path) => relative(REPO_ROOT, path))).toEqual([]);
  });
});

describe('no credential and no personal address in the repository', () => {
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

  it('contains no email address outside the reserved test domain', () => {
    const offenders: string[] = [];

    for (const path of [...sourceFiles(), join(REPO_ROOT, '.env.example')]) {
      for (const match of read(path).match(EMAIL) ?? []) {
        if (!match.endsWith('@example.invalid')) {
          offenders.push(`${relative(REPO_ROOT, path)}: ${match}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('reads the contact address from the environment and from nowhere else', () => {
    const declaring = sourceFiles().filter(
      (path) => !isTestFile(path) && read(path).includes(`'${CONTACT_EMAIL_ENV_VAR}'`),
    );

    expect(declaring.map((path) => relative(REPO_ROOT, path))).toEqual([
      'src/data/sec/user-agent.ts',
    ]);
  });

  it('reads only non-secret environment variables', () => {
    // `CONTACT_EMAIL_ENV_VAR` is the identifier this suite indexes with; it
    // resolves to the allowed name itself.
    const allowed = new Set([
      'PORT',
      'HOST',
      'EDGAR_CACHE_DIR',
      CONTACT_EMAIL_ENV_VAR,
      'CONTACT_EMAIL_ENV_VAR',
    ]);
    const offenders: string[] = [];

    for (const path of sourceFiles()) {
      if (!path.endsWith('.ts')) continue;

      for (const match of read(path).matchAll(/process\.env\[?["']?([A-Za-z_][A-Za-z0-9_]*)/g)) {
        const name = match[1] ?? '';

        if (name.length > 0 && !allowed.has(name)) {
          offenders.push(`${relative(REPO_ROOT, path)}: ${name}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('sends no credential header anywhere', () => {
    const offenders = sourceFiles().filter(
      (path) => !isTestFile(path) && /\bBearer\s|\bapi[_-]?key\b/i.test(read(path)),
    );

    expect(offenders.map((path) => relative(REPO_ROOT, path))).toEqual([]);
  });
});
