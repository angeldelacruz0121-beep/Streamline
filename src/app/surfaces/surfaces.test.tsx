/**
 * All eleven surfaces, rendered.
 *
 * Five app-level states (idle, loading, source-failure, invalid-payload,
 * encoding-blocked) and six `CompanyView` arms. Every one is reachable, every
 * one renders, and none of them is an error boundary or a blank page.
 *
 * WHERE THE NON-MICROSOFT ARMS COME FROM. Four arms have no captured fixture,
 * because the two filers exercised this session return the other two. Rather
 * than invent a company, each is assembled from the *real* entity, filing and
 * reconciliation figures in the captured Microsoft response and then pushed
 * through `companyBoundary` — so the figures are real, the objects are
 * genuinely validated, and the exercise doubles as proof that the boundary
 * accepts all six arms. Only the `detail` strings are written here, and a
 * message is not a financial figure.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { stubCanvas } from '../../viz/render/testing/recording-context';
import { companyBoundary } from '../../data/validate/company-schema.ts';
import {
  EncodingBlockedSurface,
  IdleSurface,
  InvalidPayloadSurface,
  LoadingSurface,
  SourceFailureSurface,
} from './app-surfaces';
import { CompanySurface } from './company/CompanySurface';
import { readFixtureView } from '../../../tests/infra/company-fixtures';
import type { RenderableCompany } from '../../data/model/company.ts';
import type { Validated } from '../../types/brand';

const parsedMsft = companyBoundary.parse(readFixtureView('msft'));

if (parsedMsft.kind !== 'renderable') throw new Error('captured Microsoft view is not renderable');

// Narrowed, never un-branded. Casting to a bare `RenderableCompany` here would
// strip the brand and `CompanySurface` would refuse the value — which is the
// compile-time half of Invariant 4.3 working correctly, in a test.
const msft: Validated<RenderableCompany> = parsedMsft;
const xom = companyBoundary.parse(readFixtureView('xom'));

function surface(): Element | null {
  return document.querySelector('[data-surface]');
}

function surfaceName(): string | null {
  return surface()?.getAttribute('data-surface') ?? null;
}

describe('the app-level surfaces', () => {
  it('renders idle as a structural placeholder with no invented first-run content', () => {
    render(<IdleSurface />);

    // Open question Q3 owns what goes here. It is deliberately empty: no
    // company picker, no coverage statement, no scale legend, no copy.
    expect(surfaceName()).toBe('idle');
    expect(surface()?.textContent).toBe('');
  });

  it('renders loading with a live region and the filer it is waiting on', () => {
    render(<LoadingSurface companyId="0000789019" />);

    expect(surfaceName()).toBe('loading');
    expect(surface()?.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status')).toBeDefined();
    expect(surface()?.getAttribute('data-company')).toBe('0000789019');
  });

  it('renders a transport failure with the source’s own explanation', () => {
    render(
      <SourceFailureSurface
        companyId="0000789019"
        failure={{
          kind: 'rate-limited',
          detail: 'EDGAR throttled the request and the retry budget was exhausted.',
          provenance: null,
          retryAfterMs: 1200,
          status: 429,
        }}
      />,
    );

    expect(surfaceName()).toBe('source-failure');
    expect(surface()?.getAttribute('data-failure')).toBe('rate-limited');
    expect(screen.getByText(/retry budget/)).toBeDefined();
  });

  it('renders a boundary rejection with the paths that failed, not a shrug', () => {
    render(
      <InvalidPayloadSurface
        companyId="0000789019"
        detail="The company object did not pass the pipeline boundary."
        issues={[
          { path: ['segments', 0, 'revenue', 'provenance'], message: 'Required' },
          { path: [], message: 'Invalid input' },
        ]}
      />,
    );

    expect(surfaceName()).toBe('invalid-payload');
    expect(screen.getByText('segments.0.revenue.provenance')).toBeDefined();
    expect(screen.getByText('<root>')).toBeDefined();
  });

  it('renders an encoding refusal with each reason and the decision it escalates against', () => {
    render(
      <EncodingBlockedSurface
        outcome={{
          kind: 'blocked',
          reasons: [
            {
              code: 'segment-operating-loss',
              subject: 'msft:MorePersonalComputingMember',
              message: 'A segment lost money at the operating line.',
              escalation: 'Q2',
              amountUsd: -1_000_000_000,
            },
          ],
        }}
      />,
    );

    expect(surfaceName()).toBe('encoding-blocked');
    expect(surface()?.getAttribute('data-outcome')).toBe('blocked');
    expect(screen.getByText(/lost money at the operating line/)).toBeDefined();
    expect(screen.getByText('Q2')).toBeDefined();
  });

  it('renders an adapter refusal and a thrown encoding as the same considered state', () => {
    const { unmount } = render(
      <EncodingBlockedSurface
        outcome={{ kind: 'refused', detail: 'Reported in EUR; this app does not convert.' }}
      />,
    );
    expect(screen.getByText(/does not convert/)).toBeDefined();
    unmount();

    render(
      <EncodingBlockedSurface outcome={{ kind: 'threw', detail: 'RangeError: bad domain' }} />,
    );
    expect(surface()?.getAttribute('data-outcome')).toBe('threw');
    expect(screen.getByText(/RangeError/)).toBeDefined();
  });
});

describe('the six CompanyView arms', () => {
  beforeEach(() => {
    stubCanvas();
  });

  it('renderable mounts the canvas and nothing else draws', () => {
    render(<CompanySurface view={msft} missing={null} />);

    expect(surfaceName()).toBe('renderable');
    expect(document.querySelector('[data-streamline-surface]')).not.toBeNull();
    expect(surface()?.getAttribute('data-period')).toBe('FY2026');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('MICROSOFT');
  });

  /** Decision 0012, at the surface. A 200 that refuses is a considered message. */
  it('out-of-coverage is a considered message, not a failure', () => {
    render(<CompanySurface view={xom} missing={null} />);

    expect(surfaceName()).toBe('out-of-coverage');
    expect(screen.getAllByText(/Petroleum Refining/).length).toBeGreaterThan(0);
    expect(screen.getByText(/technology sector only/)).toBeDefined();
    expect(screen.getByText('3570–3579')).toBeDefined();
    expect(document.querySelector('[data-surface="source-failure"]')).toBeNull();
  });

  it('segment-identity-unresolved names what it found', () => {
    const view = companyBoundary.parse({
      kind: 'segment-identity-unresolved',
      entity: msft.entity,
      filing: msft.filing,
      enumeratedMembers: msft.segments.map((segment) => segment.id),
      reportedSegmentCount: 5,
      detail: 'The tagged members do not agree with the reported segment count.',
      notes: [
        { code: 'count-mismatch', severity: 'warning', message: 'Enumerated 3, reported 5.' },
      ],
    });

    render(<CompanySurface view={view} missing={null} />);

    expect(surfaceName()).toBe('segment-identity-unresolved');
    expect(screen.getByText('msft:IntelligentCloudMember')).toBeDefined();
    expect(screen.getByText('Enumerated 3, reported 5.')).toBeDefined();
  });

  it('reconciliation-break renders the figures, not just the message (Invariant 2.4)', () => {
    const view = companyBoundary.parse({
      kind: 'reconciliation-break',
      entity: msft.entity,
      filing: msft.filing,
      period: msft.period,
      reconciliation: msft.reconciliation,
      detail: 'Segment revenues do not reconcile to consolidated revenue within tolerance.',
      notes: [],
    });

    render(<CompanySurface view={view} missing={null} />);

    expect(surfaceName()).toBe('reconciliation-break');
    expect(screen.getAllByText('331839000000').length).toBeGreaterThan(0);
    expect(screen.getByText('0.005')).toBeDefined();
  });

  it('incomplete-filing lists what the accession did not carry', () => {
    const view = companyBoundary.parse({
      kind: 'incomplete-filing',
      entity: msft.entity,
      filing: msft.filing,
      missing: ['MetaLinks.json', 'R-files'],
      detail: 'The accession does not carry the artifacts a structured read needs.',
    });

    render(<CompanySurface view={view} missing={null} />);

    expect(surfaceName()).toBe('incomplete-filing');
    expect(screen.getByText('MetaLinks.json')).toBeDefined();
    expect(screen.getByText('R-files')).toBeDefined();
  });

  it('no-segment-disclosure renders as its own state', () => {
    const view = companyBoundary.parse({
      kind: 'no-segment-disclosure',
      entity: msft.entity,
      filing: msft.filing,
      detail: 'The filing is readable but discloses no segment axis.',
    });

    render(<CompanySurface view={view} missing={null} />);

    expect(surfaceName()).toBe('no-segment-disclosure');
    expect(screen.getByText(/no segment axis/)).toBeDefined();
  });

  it('shows a missing-artifact list alongside a view that still renders', () => {
    render(<CompanySurface view={msft} missing={['MetaLinks.json']} />);

    expect(surfaceName()).toBe('renderable');
    expect(screen.getByText('MetaLinks.json')).toBeDefined();
  });
});

describe('exhaustiveness', () => {
  /**
   * The runtime half of `assertNever`. The compile-time half is the real gate —
   * a seventh arm stops `CompanySurface` compiling — but a value that arrives
   * from outside the type system must fail loudly rather than render nothing.
   */
  it('refuses to silently render an arm it does not know', () => {
    const rogue = { kind: 'invented-arm' } as unknown as typeof xom;

    expect(() => render(<CompanySurface view={rogue} missing={null} />)).toThrow(
      /Unhandled CompanyView arm/,
    );
  });
});
