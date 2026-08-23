// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeExtractionFingerprint,
  extractionFingerprint,
  resetExtractionFingerprint,
} from './extraction-fingerprint.ts';

/**
 * Built on disk rather than mocked, because the claim under test is about real
 * files: change the code, and the stamp moves without anyone editing a version
 * string. A mocked filesystem would prove the mock.
 */
let root: string;

async function write(path: string, contents: string): Promise<void> {
  const full = join(root, path);

  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, contents, 'utf8');
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'streamline-fingerprint-'));

  await write('src/data/normalize/ingest.ts', 'export const scale = 1_000_000;\n');
  await write('src/data/normalize/ingest.test.ts', "it('x', () => {});\n");
  await write('src/data/sec/client.ts', 'export const client = true;\n');
  await write('src/types/boundary.ts', 'export type B = string;\n');
  await write('server/proxy.ts', 'export const route = true;\n');
  await write('package.json', '{"name":"streamline"}\n');
  await write('package-lock.json', '{"lockfileVersion":3}\n');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  resetExtractionFingerprint();
});

describe('the extraction fingerprint', () => {
  it('is stable when nothing changes', async () => {
    expect(await computeExtractionFingerprint(root)).toBe(await computeExtractionFingerprint(root));
  });

  // The defect, in one test. A hand-typed 'v1' did not move when extraction was
  // fixed, so seventeen stale views survived the fix.
  it('moves when extraction logic changes, with no version constant to remember', async () => {
    const before = await computeExtractionFingerprint(root);

    await write('src/data/normalize/ingest.ts', 'export const scale = 1_000;\n');

    expect(await computeExtractionFingerprint(root)).not.toBe(before);
  });

  it('moves when a schema, a type or the route envelope changes', async () => {
    const before = await computeExtractionFingerprint(root);

    await write('src/types/boundary.ts', 'export type B = number;\n');

    const afterType = await computeExtractionFingerprint(root);

    await write('server/proxy.ts', 'export const route = false;\n');

    const afterRoute = await computeExtractionFingerprint(root);

    expect(afterType).not.toBe(before);
    expect(afterRoute).not.toBe(afterType);
  });

  it('covers a file nobody listed, because the roots are walked, not enumerated', async () => {
    const before = await computeExtractionFingerprint(root);

    await write('src/data/normalize/segments/allocate.ts', 'export const derived = true;\n');

    expect(await computeExtractionFingerprint(root)).not.toBe(before);
  });

  it('moves when a dependency changes, which changes extraction without changing our code', async () => {
    const before = await computeExtractionFingerprint(root);

    await write('package-lock.json', '{"lockfileVersion":3,"bumped":true}\n');

    expect(await computeExtractionFingerprint(root)).not.toBe(before);
  });

  it('moves when a file moves, since where code lives can change what runs', async () => {
    const before = await computeExtractionFingerprint(root);

    await rm(join(root, 'src/data/sec/client.ts'));
    await write('src/data/sec/edgar/client.ts', 'export const client = true;\n');

    expect(await computeExtractionFingerprint(root)).not.toBe(before);
  });

  it('ignores test files, which cannot change a figure but change constantly', async () => {
    const before = await computeExtractionFingerprint(root);

    await write('src/data/normalize/ingest.test.ts', "it('y', () => { expect(1).toBe(1); });\n");

    expect(await computeExtractionFingerprint(root)).toBe(before);
  });

  it('refuses to produce a stamp it cannot stand behind', async () => {
    await rm(join(root, 'src/data'), { recursive: true });

    await expect(computeExtractionFingerprint(root)).rejects.toThrow();
  });

  it('is computed once per process, not per request', async () => {
    const first = extractionFingerprint();

    expect(extractionFingerprint()).toBe(first);
    expect(await first).toMatch(/^[0-9a-f]{16}$/);
  });

  it('fingerprints this repository, so the wiring is real and not only the fixture tree', async () => {
    expect(await computeExtractionFingerprint()).toMatch(/^[0-9a-f]{16}$/);
  });
});
