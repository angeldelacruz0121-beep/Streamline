/**
 * Routing, hand-rolled, and deliberately two routes wide.
 *
 * There is no router dependency and this does not need one: the app has one
 * address that carries a parameter. A library here would be a dependency taken
 * against a future that has not been specified yet.
 *
 * THERE IS NO PERIOD SEGMENT, AND ITS ABSENCE IS A DECISION. Open decision D12 —
 * whether the app opens on the latest fiscal year, the latest quarter, or TTM —
 * is unanswered. The honest way to hold an unanswered decision is to build a URL
 * that does not encode it, so `#/company/0000789019` names a filer and nothing
 * else. The slice renders exactly one period, so nothing is lost. The cost is
 * known and was accepted: when D12 is answered the route shape changes and every
 * link into it changes with it. Nothing links to it yet, so that churn is
 * cheapest now. Do not add a placeholder segment for a period — a slot whose
 * meaning has not been decided is worse than no slot.
 *
 * Non-success states are not addresses. `#/company/0000789019` is one location
 * whose content depends on which `CompanyView` arm came back; "out of coverage"
 * is what that filer *is*, not somewhere else the reader was sent.
 */

export type Route =
  /** No filer chosen. What this surface says is open question Q3, unwritten. */
  { readonly kind: 'idle' } | { readonly kind: 'company'; readonly companyId: string };

export const IDLE_ROUTE: Route = { kind: 'idle' };

const COMPANY_PATTERN = /^#?\/?company\/(\d{1,10})\/?$/;

/**
 * A hash to a route. Anything unrecognised is `idle` rather than a not-found
 * surface: a malformed address is a reader who has not chosen a filer yet, and
 * inventing a sixth failure state for a typo would be product design this app
 * has no spec for.
 */
export function parseRoute(hash: string): Route {
  const match = COMPANY_PATTERN.exec(hash.trim());

  if (match === null) return IDLE_ROUTE;

  const digits = match[1];

  if (digits === undefined) return IDLE_ROUTE;

  return { kind: 'company', companyId: digits.padStart(10, '0') };
}

export function formatRoute(route: Route): string {
  return route.kind === 'idle' ? '#/' : `#/company/${route.companyId}`;
}

export function sameRoute(left: Route, right: Route): boolean {
  if (left.kind !== right.kind) return false;

  return left.kind !== 'company' || right.kind !== 'company'
    ? true
    : left.companyId === right.companyId;
}
