import { describe, it, expect, vi } from 'vitest';
import {
  handlePublicAccessRequest,
  handleListAccessRequests,
  handleDismissAccessRequest,
} from '../access-requests.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeRequest = (method, body = null, email = null) => {
  const headers = {};
  if (email) headers['CF-Access-Authenticated-User-Email'] = email;

  return new Request('http://example.com/api/access-requests', {
    method,
    headers,
    ...(body
      ? { body: JSON.stringify(body), headers: { ...headers, 'content-type': 'application/json' } }
      : {}),
  });
};

const makeKv = (store = {}) => {
  const data = { ...store };
  return {
    get: vi.fn((key) => Promise.resolve(data[key] ?? null)),
    put: vi.fn((key, value) => {
      data[key] = value;
      return Promise.resolve();
    }),
    delete: vi.fn((key) => {
      delete data[key];
      return Promise.resolve();
    }),
    list: vi.fn(() => Promise.resolve({ keys: Object.keys(data).map((name) => ({ name })) })),
    _data: data,
  };
};

const makeEnv = (overrides = {}) => ({
  ADMIN_EMAILS: 'admin@example.com',
  GUEST_REQUESTS_KV: makeKv(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// handlePublicAccessRequest — POST /api/access-requests
// ---------------------------------------------------------------------------

describe('handlePublicAccessRequest', () => {
  it('returns 405 for non-POST requests', async () => {
    const req = makeRequest('GET');
    const res = await handlePublicAccessRequest(req, makeEnv());
    expect(res.status).toBe(405);
  });

  it('returns 500 when GUEST_REQUESTS_KV is not configured', async () => {
    const req = makeRequest('POST', { name: 'Alice', email: 'alice@example.com' });
    const res = await handlePublicAccessRequest(req, { ...makeEnv(), GUEST_REQUESTS_KV: undefined });
    expect(res.status).toBe(500);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://example.com/api/access-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    const res = await handlePublicAccessRequest(req, makeEnv());
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    const req = makeRequest('POST', { email: 'alice@example.com' });
    const res = await handlePublicAccessRequest(req, makeEnv());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  it('returns 400 when email is invalid', async () => {
    const req = makeRequest('POST', { name: 'Alice', email: 'not-an-email' });
    const res = await handlePublicAccessRequest(req, makeEnv());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it('returns 400 when name contains invalid characters', async () => {
    const req = makeRequest('POST', { name: 'Alice<script>', email: 'alice@example.com' });
    const res = await handlePublicAccessRequest(req, makeEnv());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid characters/i);
  });

  it('returns 400 when Turnstile verification fails', async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false }), { status: 200 })
    ));

    const env = { ...makeEnv(), TURNSTILE_SECRET_KEY: 'secret' };
    const req = makeRequest('POST', { name: 'Alice', email: 'alice@example.com', turnstileToken: 'bad-token' });
    const res = await handlePublicAccessRequest(req, env);

    vi.stubGlobal('fetch', originalFetch);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/security check/i);
  });

  it('writes to KV and returns 200 on a valid submission (no Turnstile secret = dev mode)', async () => {
    const kv = makeKv();
    const env = { ...makeEnv(), GUEST_REQUESTS_KV: kv };
    const req = makeRequest('POST', { name: 'Alice Smith', email: 'Alice@Example.com' });
    const res = await handlePublicAccessRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(kv.put).toHaveBeenCalledWith(
      'alice@example.com',
      expect.stringContaining('"name":"Alice Smith"'),
      expect.objectContaining({ expirationTtl: expect.any(Number) })
    );
  });

  it('returns 200 (non-enumerating) for a duplicate email submission', async () => {
    const existing = JSON.stringify({ name: 'Old', email: 'alice@example.com', requestedAt: '2024-01-01T00:00:00Z' });
    const kv = makeKv({ 'alice@example.com': existing });
    const env = { ...makeEnv(), GUEST_REQUESTS_KV: kv };
    const req = makeRequest('POST', { name: 'Alice', email: 'alice@example.com' });
    const res = await handlePublicAccessRequest(req, env);
    expect(res.status).toBe(200);
    expect(kv.put).toHaveBeenCalled();
  });

  it('accepts names with European special characters', async () => {
    const kv = makeKv();
    const env = { ...makeEnv(), GUEST_REQUESTS_KV: kv };
    const req = makeRequest('POST', { name: 'Ångström-O\'Brien', email: 'ang@example.com' });
    const res = await handlePublicAccessRequest(req, env);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// handleListAccessRequests — GET /api/private/admin/access-requests
// ---------------------------------------------------------------------------

describe('handleListAccessRequests', () => {
  const makeAdminRequest = (method = 'GET') =>
    makeRequest(method, null, 'admin@example.com');

  it('returns 405 for non-GET requests', async () => {
    const res = await handleListAccessRequests(makeAdminRequest('POST'), makeEnv());
    expect(res.status).toBe(405);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const req = makeRequest('GET');
    const res = await handleListAccessRequests(req, makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    const req = makeRequest('GET', null, 'guest@example.com');
    const res = await handleListAccessRequests(req, makeEnv());
    expect(res.status).toBe(403);
  });

  it('returns 500 when GUEST_REQUESTS_KV is not configured', async () => {
    const req = makeAdminRequest();
    const res = await handleListAccessRequests(req, { ...makeEnv(), GUEST_REQUESTS_KV: undefined });
    expect(res.status).toBe(500);
  });

  it('returns an empty array when KV is empty', async () => {
    const req = makeAdminRequest();
    const res = await handleListAccessRequests(req, makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toEqual([]);
  });

  it('returns requests sorted newest-first by requestedAt', async () => {
    const kv = makeKv({
      'alice@example.com': JSON.stringify({ name: 'Alice', email: 'alice@example.com', requestedAt: '2024-01-01T10:00:00Z' }),
      'bob@example.com': JSON.stringify({ name: 'Bob', email: 'bob@example.com', requestedAt: '2024-06-01T10:00:00Z' }),
    });
    const req = makeAdminRequest();
    const res = await handleListAccessRequests(req, { ...makeEnv(), GUEST_REQUESTS_KV: kv });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests[0].email).toBe('bob@example.com');
    expect(body.requests[1].email).toBe('alice@example.com');
  });
});

// ---------------------------------------------------------------------------
// handleDismissAccessRequest — DELETE /api/private/admin/access-requests/:email
// ---------------------------------------------------------------------------

describe('handleDismissAccessRequest', () => {
  const makeAdminDelete = (method = 'DELETE') =>
    makeRequest(method, null, 'admin@example.com');

  it('returns 405 for non-DELETE requests', async () => {
    const res = await handleDismissAccessRequest(makeAdminDelete('GET'), makeEnv(), 'alice@example.com');
    expect(res.status).toBe(405);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const req = makeRequest('DELETE');
    const res = await handleDismissAccessRequest(req, makeEnv(), 'alice@example.com');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    const req = makeRequest('DELETE', null, 'guest@example.com');
    const res = await handleDismissAccessRequest(req, makeEnv(), 'alice@example.com');
    expect(res.status).toBe(403);
  });

  it('returns 404 when the KV key does not exist', async () => {
    const req = makeAdminDelete();
    const res = await handleDismissAccessRequest(req, makeEnv(), 'nobody@example.com');
    expect(res.status).toBe(404);
  });

  it('deletes the KV entry and returns ok: true', async () => {
    const kv = makeKv({
      'alice@example.com': JSON.stringify({ name: 'Alice', email: 'alice@example.com', requestedAt: '2024-01-01T00:00:00Z' }),
    });
    const req = makeAdminDelete();
    const res = await handleDismissAccessRequest(req, { ...makeEnv(), GUEST_REQUESTS_KV: kv }, 'alice@example.com');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(kv.delete).toHaveBeenCalledWith('alice@example.com');
  });
});
