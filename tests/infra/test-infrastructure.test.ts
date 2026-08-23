// @vitest-environment node
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Keel-owned harness proof, not a product test.
 *
 * Conduit's Workstream 1 gate is "tests prove the User-Agent and 10 req/s
 * controls cannot be bypassed" (Invariant 4.6). That gate needs three
 * capabilities to exist before Conduit starts: a real local HTTP server, an
 * observable request header, and a controllable clock. This file proves all
 * three work in this repo so Conduit does not have to discover them mid-task.
 *
 * The payload is deliberately meaningless text: Invariant 4.5 forbids anything
 * that could be mistaken for a financial response body.
 */

let server: Server;
let origin: string;
let observedHeaders: IncomingHttpHeaders[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    observedHeaders.push(request.headers);
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('scaffold-transport-ok');
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('Test server did not bind to a TCP port.');
  }

  origin = `http://127.0.0.1:${(address as AddressInfo).port}`;
});

afterAll(async () => {
  server.close();
  await once(server, 'close');
});

beforeEach(() => {
  observedHeaders = [];
});

describe('test infrastructure', () => {
  it('serves a local HTTP endpoint reachable by native fetch', async () => {
    const response = await fetch(origin);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('scaffold-transport-ok');
  });

  it('exposes outbound request headers to assertions', async () => {
    await fetch(origin, { headers: { 'user-agent': 'scaffold-harness-probe' } });

    expect(observedHeaders.at(0)?.['user-agent']).toBe('scaffold-harness-probe');
  });

  it('counts requests, so a rate control can be asserted against a window', async () => {
    await Promise.all([fetch(origin), fetch(origin), fetch(origin)]);

    expect(observedHeaders).toHaveLength(3);
  });

  it('controls the clock, so a rate window needs no wall-clock wait', () => {
    vi.useFakeTimers();

    try {
      let fired = false;

      setTimeout(() => {
        fired = true;
      }, 1_000);

      expect(fired).toBe(false);
      vi.advanceTimersByTime(1_000);
      expect(fired).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
