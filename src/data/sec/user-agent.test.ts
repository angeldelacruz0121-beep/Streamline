// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TEST_CONTACT_EMAIL } from './__fixtures__/shape-probes.ts';
import {
  assertCompliantUserAgent,
  composeUserAgent,
  CONTACT_EMAIL_ENV_VAR,
  isContactEmailShaped,
  readContactEmailFromEnv,
  SecContactEmailError,
  userAgentCarriesContact,
  USER_AGENT_PRODUCT,
} from './user-agent.ts';

describe('User-Agent, fail-closed (Invariant 4.6)', () => {
  it('refuses to produce a header when the contact variable is unset', () => {
    expect(() => readContactEmailFromEnv({})).toThrow(SecContactEmailError);
  });

  it('names the variable and the reason in the failure', () => {
    let message = '';

    try {
      readContactEmailFromEnv({});
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(CONTACT_EMAIL_ENV_VAR);
    expect(message).toContain('403');
    expect(message).toContain('.env');
  });

  it('treats an empty or whitespace value as unset rather than usable', () => {
    expect(() => readContactEmailFromEnv({ [CONTACT_EMAIL_ENV_VAR]: '' })).toThrow(
      SecContactEmailError,
    );
    expect(() => readContactEmailFromEnv({ [CONTACT_EMAIL_ENV_VAR]: '   ' })).toThrow(
      SecContactEmailError,
    );
  });

  it('rejects values that are not an email address', () => {
    for (const candidate of ['streamline', 'not an email', 'a@b', '@example.invalid', 'a@.com']) {
      expect(() => readContactEmailFromEnv({ [CONTACT_EMAIL_ENV_VAR]: candidate })).toThrow(
        SecContactEmailError,
      );
    }
  });

  it('rejects a value carrying a header injection', () => {
    expect(() =>
      readContactEmailFromEnv({
        [CONTACT_EMAIL_ENV_VAR]: 'probe@example.invalid\r\nX-Injected: yes',
      }),
    ).toThrow(SecContactEmailError);
  });

  it('accepts a usable address and builds a descriptive header from it', () => {
    const header = composeUserAgent(
      readContactEmailFromEnv({ [CONTACT_EMAIL_ENV_VAR]: TEST_CONTACT_EMAIL }),
    );

    expect(header.startsWith(USER_AGENT_PRODUCT)).toBe(true);
    expect(header).toContain(TEST_CONTACT_EMAIL);
    expect(userAgentCarriesContact(header)).toBe(true);
  });

  it('refuses to send a header that lost its contact address', () => {
    expect(() => assertCompliantUserAgent('Streamline/0.1')).toThrow(SecContactEmailError);
    expect(() => assertCompliantUserAgent('Streamline/0.1 (SEC filing visualization)')).toThrow(
      SecContactEmailError,
    );
    expect(() => assertCompliantUserAgent('')).toThrow(SecContactEmailError);
  });

  it('does not accept an anonymous browser-style agent that happens to contain an address', () => {
    expect(userAgentCarriesContact('Mozilla/5.0 (probe@example.invalid)')).toBe(false);
  });

  it('bounds address length', () => {
    expect(isContactEmailShaped(`${'a'.repeat(250)}@example.invalid`)).toBe(false);
  });
});
