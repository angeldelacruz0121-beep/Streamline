/**
 * Invariant 4.4, proven rather than described.
 *
 * "The SEC ingestion path sits behind an interface. Assume a second source will
 * be added." A comment saying so is worth nothing; the question is whether a
 * second source can actually be added without touching the visualization. So
 * this file adds one.
 *
 * `createArchiveSource` shares no transport, no URL shape, no error taxonomy and
 * no provenance vocabulary with the EDGAR source. It is synchronous where the
 * other is HTTP, it identifies filers by ticker where the other uses CIK, and it
 * reports provenance about a local archive rather than about sec.gov. The only
 * thing the two have in common is `CompanySource` — and that is the point.
 *
 * The three assertions that matter:
 *   1. It compiles as a `CompanySource` with no change to the interface.
 *   2. It produces a byte-identical `CanvasModel`, so the encoding cannot tell
 *      the two sources apart.
 *   3. `App` renders it with no change to `App`, `src/state/` or `src/viz/`.
 *
 * Plus a structural guard: the module graph is walked to prove the seam is not
 * merely unused today but genuinely one-directional.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
// Forge's own harness. jsdom has no 2D context, so a test that really mounts
// the canvas needs the recording stub rather than a mocked-out component — the
// whole point of this file is that the real renderer receives the real model.
import { stubCanvas } from '../../viz/render/testing/recording-context';
import { App } from '../App';
import { composeFromCompany } from '../../state/canvas-adapter';
import { createEdgarHttpSource, validateView } from './edgar-http-source';
import type { RenderableCompany } from '../../data/model/company.ts';
import type { Validated } from '../../types/brand';
import type { CompanyRequest, CompanySource, SourceResult } from '../../types/source';
import {
  MSFT_CIK,
  fixtureFetch,
  readFixtureText,
  readFixtureView,
  repoRoot,
} from '../../../tests/infra/company-fixtures';

/**
 * The second source.
 *
 * Deliberately unlike the first in every respect except the contract. It reads
 * from an in-process archive keyed by ticker, has no notion of HTTP status, and
 * describes its provenance in its own terms. It still cannot hand out an
 * unvalidated view, because `validateView` is the only thing in this layer that
 * mints one — a source that skipped it would have nothing of the right type to
 * return.
 */
function createArchiveSource(archive: Readonly<Record<string, unknown>>): CompanySource {
  const byTicker: Record<string, unknown> = {};

  for (const [ticker, view] of Object.entries(archive)) byTicker[ticker.toUpperCase()] = view;

  return {
    id: 'local-archive',
    label: 'Local filing archive',
    fetchCompanyView: (request: CompanyRequest): Promise<SourceResult> => {
      const key = request.companyId.toUpperCase();
      const provenance = {
        sourceId: 'local-archive',
        url: `archive://filings/${key}`,
        resource: 'archived-filing',
        retrievedAt: '2026-08-21T00:00:00.000Z',
        fromCache: true,
        expiresAt: null,
        documentId: key,
        status: null,
      };

      if (!(key in byTicker)) {
        return Promise.resolve({
          kind: 'source-failure',
          failure: {
            kind: 'not-found',
            detail: `The archive holds no filing for ${key}.`,
            provenance,
            retryAfterMs: null,
            status: null,
          },
        });
      }

      const validated = validateView(byTicker[key], provenance);

      if (!validated.ok) return Promise.resolve(validated.result);

      return Promise.resolve({ kind: 'view', provenance, view: validated.view });
    },
  };
}

describe('a second source', () => {
  beforeEach(() => {
    stubCanvas();
  });

  it('satisfies CompanySource with no change to the interface', () => {
    const source: CompanySource = createArchiveSource({});

    expect(source.id).toBe('local-archive');
    expect(typeof source.fetchCompanyView).toBe('function');
  });

  it('produces a CanvasModel identical to the one the SEC path produces', async () => {
    const edgar = createEdgarHttpSource({
      fetchImpl: fixtureFetch({
        [`/api/edgar/company/${MSFT_CIK}/segments`]: {
          status: 200,
          body: readFixtureText('msft'),
        },
      }),
    });
    const archive = createArchiveSource({ MSFT: readFixtureView('msft') });

    const fromEdgar = await edgar.fetchCompanyView({ companyId: MSFT_CIK });
    const fromArchive = await archive.fetchCompanyView({ companyId: 'msft' });

    expect(fromEdgar.kind).toBe('view');
    expect(fromArchive.kind).toBe('view');
    if (fromEdgar.kind !== 'view' || fromArchive.kind !== 'view') return;
    if (fromEdgar.view.kind !== 'renderable' || fromArchive.view.kind !== 'renderable') return;

    const a = composeFromCompany(fromEdgar.view as Validated<RenderableCompany>);
    const b = composeFromCompany(fromArchive.view as Validated<RenderableCompany>);

    expect(a.kind).toBe('model');
    expect(b).toEqual(a);
  });

  it('reports its own provenance vocabulary, not the SEC one', async () => {
    const archive = createArchiveSource({ MSFT: readFixtureView('msft') });
    const result = await archive.fetchCompanyView({ companyId: 'MSFT' });

    expect(result.kind).toBe('view');
    if (result.kind !== 'view') return;
    expect(result.provenance?.sourceId).toBe('local-archive');
    expect(result.provenance?.url.startsWith('archive://')).toBe(true);
  });

  it('renders through App as a prop swap, with no change to App or the viz layer', async () => {
    const archive = createArchiveSource({ MSFT: readFixtureView('msft') });

    render(<App source={archive} route={{ kind: 'company', companyId: 'MSFT' }} />);

    await waitFor(() => {
      expect(document.querySelector('[data-surface="renderable"]')).not.toBeNull();
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('MICROSOFT');
  });

  it('routes its own failure taxonomy onto the shared failure surface', async () => {
    const archive = createArchiveSource({});

    render(<App source={archive} route={{ kind: 'company', companyId: 'NOPE' }} />);

    await waitFor(() => {
      expect(document.querySelector('[data-surface="source-failure"]')).not.toBeNull();
    });
    expect(document.querySelector('[data-failure="not-found"]')).not.toBeNull();
  });
});

/**
 * The structural half. A seam that happens to be unused is not a seam; these
 * assertions fail the moment someone reaches across it.
 */
describe('the seam holds in the module graph', () => {
  const root = `${repoRoot()}src/`;

  function sourceFiles(dir: string): string[] {
    const found: string[] = [];

    for (const entry of readdirSync(`${root}${dir}`)) {
      const path = `${dir}/${entry}`;

      if (statSync(`${root}${path}`).isDirectory()) {
        found.push(...sourceFiles(path));
        continue;
      }

      if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;

      found.push(path);
    }

    return found;
  }

  function importsOf(path: string): string[] {
    const text = readFileSync(`${root}${path}`, 'utf8');

    return [...text.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] ?? '');
  }

  it('lets nothing outside src/app/sources import the SEC vocabulary', () => {
    const offenders = [...sourceFiles('state'), ...sourceFiles('types')]
      .filter((path) => importsOf(path).some((specifier) => specifier.includes('data/sec')))
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps the visualization ignorant of the app, the state model and every source', () => {
    const offenders = sourceFiles('viz')
      .filter((path) =>
        importsOf(path).some(
          (specifier) =>
            specifier.includes('/app/') ||
            specifier.includes('/state/') ||
            specifier.includes('data/sec') ||
            specifier.includes('types/source'),
        ),
      )
      .sort();

    expect(offenders).toEqual([]);
  });

  it('reaches the visualization through exactly two entry points', () => {
    const specifiers = new Set<string>();

    for (const path of [...sourceFiles('app'), ...sourceFiles('state')]) {
      for (const specifier of importsOf(path)) {
        if (specifier.includes('viz/')) specifiers.add(specifier.replace(/^(\.\.\/)+/, ''));
      }
    }

    // The encoding barrel, for the adapter; the render barrel, for the mount.
    // A third entry point means the app has started reaching into internals.
    expect([...specifiers].sort()).toEqual(['viz/encoding', 'viz/render', 'viz/scales']);
  });
});
