/**
 * The vertical slice, end to end, with nothing mocked but the socket.
 *
 * fetch -> `companyBoundary` -> `composeFromCompany` -> `CanvasModel` ->
 * `StreamlineCanvas`. The bytes are a verbatim capture of the live proxy's
 * response for Microsoft, the boundary is the real one, the encoding is the
 * real one and the renderer is the real one — only the 2D context is a
 * recording stub, because jsdom has none.
 *
 * The test that earns its place is the second describe block: Exxon Mobil comes
 * back 200 with `out-of-coverage` and the app renders a considered message. If
 * that ever turns into an error surface, decision 0012 has been broken and this
 * fails.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createEdgarHttpSource } from './sources/edgar-http-source';
import { stubCanvas } from '../viz/render/testing/recording-context';
import type { RecordingContext } from '../viz/render/testing/recording-context';
import type { CompanySource } from '../types/source';
import {
  MSFT_CIK,
  XOM_CIK,
  fixtureFetch,
  readFixtureText,
} from '../../tests/infra/company-fixtures';

let ctx: RecordingContext;

beforeEach(() => {
  ctx = stubCanvas();
});

function liveShapedSource(): CompanySource {
  return createEdgarHttpSource({
    fetchImpl: fixtureFetch({
      [`/api/edgar/company/${MSFT_CIK}/segments`]: { status: 200, body: readFixtureText('msft') },
      [`/api/edgar/company/${XOM_CIK}/segments`]: { status: 200, body: readFixtureText('xom') },
    }),
  });
}

function surfaceName(): string | null {
  return document.querySelector('[data-surface]')?.getAttribute('data-surface') ?? null;
}

describe('the shell', () => {
  it('still mounts a main landmark', () => {
    render(<App source={liveShapedSource()} route={{ kind: 'idle' }} />);

    expect(screen.getByRole('main')).toBeDefined();
  });

  it('shows the idle surface when no filer is chosen, and asks the source for nothing', () => {
    const fetchCompanyView = vi.fn();

    render(<App source={{ id: 'x', label: 'X', fetchCompanyView }} route={{ kind: 'idle' }} />);

    expect(surfaceName()).toBe('idle');
    expect(fetchCompanyView).not.toHaveBeenCalled();
  });

  it('reads the route from the hash when none is supplied', async () => {
    window.location.hash = `#/company/${MSFT_CIK}`;

    render(<App source={liveShapedSource()} />);

    await waitFor(() => {
      expect(surfaceName()).toBe('renderable');
    });

    window.location.hash = '';
  });
});

describe('the vertical slice', () => {
  it('draws Microsoft FY2026 from the captured response, with the reported figures', async () => {
    render(<App source={liveShapedSource()} route={{ kind: 'company', companyId: MSFT_CIK }} />);

    await waitFor(() => {
      expect(surfaceName()).toBe('renderable');
    });

    expect(document.querySelector('[data-streamline-surface]')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('MICROSOFT');
    expect(document.querySelector('[data-surface="renderable"]')?.getAttribute('data-period')).toBe(
      'FY2026',
    );

    // The lake is consolidated net earnings. If the wire ever dropped a figure
    // or the adapter ever rescaled one, this is where it shows.
    //
    // Awaited rather than read synchronously, because the application does not
    // pass `reducedMotion` — that prop is a harness hook and the shell has no
    // business setting it — so the first paint lands on an animation frame,
    // exactly as it does in a browser.
    await waitFor(() => {
      expect(ctx.texts().join(' ')).toContain('$133.749B');
    });

    const drawn = ctx.texts().join(' ');
    expect(drawn).toContain('Productivity and Business Processes');
    expect(drawn).toContain('Intelligent Cloud');
    expect(drawn).toContain('More Personal Computing');
  });

  it('shows loading before the source answers', async () => {
    let release: () => void = () => undefined;
    const slow: CompanySource = {
      id: 'slow',
      label: 'Slow',
      fetchCompanyView: () =>
        new Promise((resolve) => {
          release = () => {
            void liveShapedSource().fetchCompanyView({ companyId: MSFT_CIK }).then(resolve);
          };
        }),
    };

    render(<App source={slow} route={{ kind: 'company', companyId: MSFT_CIK }} />);

    expect(surfaceName()).toBe('loading');
    expect(screen.getByRole('status')).toBeDefined();

    release();
    await waitFor(() => {
      expect(surfaceName()).toBe('renderable');
    });
  });
});

describe('a 200 that refuses to draw (decision 0012)', () => {
  it('renders Exxon Mobil as out-of-coverage, not as an error and not as a crash', async () => {
    render(<App source={liveShapedSource()} route={{ kind: 'company', companyId: XOM_CIK }} />);

    await waitFor(() => {
      expect(surfaceName()).toBe('out-of-coverage');
    });

    expect(screen.getByText(/technology sector only/)).toBeDefined();
    expect(document.querySelector('[data-surface="source-failure"]')).toBeNull();
    expect(document.querySelector('[data-surface="invalid-payload"]')).toBeNull();
    expect(document.querySelector('[data-streamline-surface]')).toBeNull();
  });
});

describe('the non-success surfaces are reachable through the real path', () => {
  it('routes a transport failure to the failure surface', async () => {
    const source = createEdgarHttpSource({
      fetchImpl: fixtureFetch({
        [`/api/edgar/company/${MSFT_CIK}/segments`]: {
          status: 502,
          body: JSON.stringify({
            kind: 'transport-error',
            provenance: {
              url: 'https://www.sec.gov/x',
              resource: 'archive-document',
              fetchedAt: '2026-08-21T12:00:00.000Z',
              fromCache: false,
              expiresAt: null,
              accession: null,
              status: 502,
            },
            attempts: 3,
            detail: 'EDGAR returned an unusable status three times.',
          }),
        },
      }),
    });

    render(<App source={source} route={{ kind: 'company', companyId: MSFT_CIK }} />);

    await waitFor(() => {
      expect(surfaceName()).toBe('source-failure');
    });
    expect(screen.getByText(/unusable status/)).toBeDefined();
  });

  it('routes a boundary rejection to the data-quality surface, and never to the canvas', async () => {
    const source = createEdgarHttpSource({
      fetchImpl: fixtureFetch({
        [`/api/edgar/company/${MSFT_CIK}/segments`]: {
          status: 200,
          body: JSON.stringify({
            kind: 'view',
            provenance: null,
            view: { kind: 'renderable', segments: [] },
          }),
        },
      }),
    });

    render(<App source={source} route={{ kind: 'company', companyId: MSFT_CIK }} />);

    await waitFor(() => {
      expect(surfaceName()).toBe('invalid-payload');
    });
    expect(document.querySelector('[data-streamline-surface]')).toBeNull();
    expect(document.querySelectorAll('[data-part="issues"] li').length).toBeGreaterThan(0);
  });

  it('switches filers without leaking the previous one onto the screen', async () => {
    const source = liveShapedSource();
    const { rerender } = render(
      <App source={source} route={{ kind: 'company', companyId: MSFT_CIK }} />,
    );

    await waitFor(() => {
      expect(surfaceName()).toBe('renderable');
    });

    rerender(<App source={source} route={{ kind: 'company', companyId: XOM_CIK }} />);

    await waitFor(() => {
      expect(surfaceName()).toBe('out-of-coverage');
    });
    expect(screen.queryByText(/MICROSOFT/)).toBeNull();
  });
});
