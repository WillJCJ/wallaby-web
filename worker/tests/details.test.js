import { describe, it, expect } from 'vitest';
import { handlePrivateDetails } from '../details.js';

const makeRequest = (method = 'GET', email = null) => {
  const headers = {};
  if (email) {
    headers['CF-Access-Authenticated-User-Email'] = email;
  }
  return new Request('http://example.com/api/private/details', { method, headers });
};

const baseEnv = {
  EVENT_ADDRESS: '62 West Wallaby Street',
  GATE_CODE: '9999',
};

describe('handlePrivateDetails', () => {
  it('returns address and gateCode for an authenticated GET request', async () => {
    const res = await handlePrivateDetails(makeRequest('GET', 'user@example.com'), baseEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.address).toBe('62 West Wallaby Street');
    expect(body.gateCode).toBe('9999');
    expect(body.viewer).toBe('user@example.com');
  });

  it('falls back to default address and gate code when env vars are not set', async () => {
    const res = await handlePrivateDetails(makeRequest('GET', 'user@example.com'), {});
    const body = await res.json();
    expect(body.address).toBe('62 West Wallaby Street, Wigan, Lancashire, WA11 4BY');
    expect(body.gateCode).toBe('1234');
  });

  it('returns 401 when the auth header is absent', async () => {
    const res = await handlePrivateDetails(makeRequest('GET', null), baseEnv);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 405 for a POST request', async () => {
    const res = await handlePrivateDetails(makeRequest('POST', 'user@example.com'), baseEnv);
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toBe('Method Not Allowed');
  });

  it('sets cache-control: private, no-store on the response', async () => {
    const res = await handlePrivateDetails(makeRequest('GET', 'user@example.com'), baseEnv);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
});
