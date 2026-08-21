import { afterEach } from 'vitest';

// Testing Library touches `document` at import time, so it is only loaded for
// suites running in the jsdom environment. Node-environment suites
// (`// @vitest-environment node`) share this setup file and must not pay for it.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => {
    cleanup();
  });
}
