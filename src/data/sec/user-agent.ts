/**
 * Invariant 4.6, first half: a descriptive User-Agent carrying a real contact
 * email on every request. EDGAR answers 403 to a request without one - verified
 * empirically against the live service, not inferred from the documentation.
 *
 * The address is never committed. `SEC_CONTACT_EMAIL` is the single source, and
 * it is required rather than an override: with the variable unset, constructing
 * a client throws before a single request can be built. That is what makes this
 * enforcement rather than convention - the failure is loud, immediate, and
 * cannot be reached past. A hardcoded fallback would be the bypass.
 *
 * Consequence, and it is deliberate: the whole test suite runs with
 * `SEC_CONTACT_EMAIL` unset, because no test touches the live service.
 */

export const CONTACT_EMAIL_ENV_VAR = 'SEC_CONTACT_EMAIL';

/** Product half of the header. Carries no personal data. */
export const USER_AGENT_PRODUCT = 'Streamline/0.1';
const USER_AGENT_PURPOSE = 'SEC filing visualization';

/**
 * Deliberately conservative. Not RFC 5322 in full - that grammar admits quoted
 * local parts and comments, none of which belong in a header EDGAR staff read
 * by eye. One address, no whitespace, no header-injection characters.
 */
const CONTACT_EMAIL_SHAPE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export class SecContactEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecContactEmailError';
  }
}

function explain(problem: string): string {
  return [
    problem,
    `SEC EDGAR rejects any request without a descriptive User-Agent containing a real contact`,
    `email (HTTP 403), and Invariant 4.6 requires that header on every request. Set`,
    `${CONTACT_EMAIL_ENV_VAR} to a monitored address in a gitignored .env file - see .env.example.`,
    `No address is committed to this repository, so there is no default to fall back to.`,
  ].join(' ');
}

/** `true` when the string is a single, syntactically plausible address. */
export function isContactEmailShaped(candidate: string): boolean {
  return CONTACT_EMAIL_SHAPE.test(candidate) && candidate.length <= 254;
}

/**
 * Reads the contact address from the environment. Throws - never returns a
 * placeholder - when it is missing or malformed.
 */
export function readContactEmailFromEnv(
  env: Readonly<Record<string, string | undefined>> = processEnv(),
): string {
  const raw = env[CONTACT_EMAIL_ENV_VAR];

  if (raw === undefined || raw.trim().length === 0) {
    throw new SecContactEmailError(explain(`${CONTACT_EMAIL_ENV_VAR} is not set.`));
  }

  return requireContactEmail(raw.trim());
}

/** Validates an address supplied directly, with the same failure as the env path. */
export function requireContactEmail(candidate: string): string {
  const trimmed = candidate.trim();

  if (!isContactEmailShaped(trimmed)) {
    throw new SecContactEmailError(
      explain(`${CONTACT_EMAIL_ENV_VAR} is not a usable email address.`),
    );
  }

  return trimmed;
}

/**
 * Builds the header. Shape follows the SEC's own published example - a
 * descriptive product identifier plus a contact address.
 */
export function composeUserAgent(contactEmail: string): string {
  return `${USER_AGENT_PRODUCT} (${USER_AGENT_PURPOSE}; ${requireContactEmail(contactEmail)})`;
}

/**
 * Defence in depth at the point of use. `transport.ts` calls this on the header
 * it is about to send, so a User-Agent that lost its contact address between
 * client construction and the wire still cannot leave the process.
 */
export function assertCompliantUserAgent(userAgent: string): void {
  if (!userAgentCarriesContact(userAgent)) {
    throw new SecContactEmailError(
      explain(`Refusing to send User-Agent ${JSON.stringify(userAgent)}: no contact email in it.`),
    );
  }
}

/** The predicate the compliance gate asserts against every observed request. */
export function userAgentCarriesContact(userAgent: string): boolean {
  if (!userAgent.startsWith(USER_AGENT_PRODUCT)) {
    return false;
  }

  const candidate = /\(([^)]*)\)\s*$/.exec(userAgent)?.[1]?.split(';').at(-1)?.trim();

  return candidate !== undefined && isContactEmailShaped(candidate);
}

function processEnv(): Readonly<Record<string, string | undefined>> {
  const runtime = globalThis as { process?: { env?: Record<string, string | undefined> } };

  return runtime.process?.env ?? {};
}
