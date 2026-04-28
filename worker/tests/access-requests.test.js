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
  const data = new Map(Object.entries(store));
  return {
    get: vi.fn((key) => Promise.resolve(data.get(key) ?? null)),
    put: vi.fn((key, value) => {
      data.set(key, value);
      return Promise.resolve();
    }),
    delete: vi.fn((key) => {
      data.delete(key);
      return Promise.resolve();
    }),
    list: vi.fn(() => Promise.resolve({ keys: Array.from(data.keys()).map((name) => ({ name })) })),
    _data: data,
  };
};

const makeEnv = (overrides = {}) => ({
  ADMIN_EMAILS: 'admin@example.com',
  GUEST_REQUESTS_KV: makeKv(),
  GUESTS_DB: {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        run: vi.fn().mockResolvedValue({ success: true }),
      })),
    })),
  },
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
    const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('req-123');
    const kv = makeKv();
    const env = { ...makeEnv(), GUEST_REQUESTS_KV: kv };
    const req = makeRequest('POST', { name: 'Alice Smith', email: 'Alice@Example.com' });
    const res = await handlePublicAccessRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(kv.put).toHaveBeenCalledWith(
      'request:req-123',
      expect.stringContaining('"name":"Alice Smith"'),
      expect.objectContaining({ expirationTtl: expect.any(Number) })
    );
    uuidSpy.mockRestore();
  });

  it('returns 200 (non-enumerating) for a duplicate email submission', async () => {
    const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('req-456');
    const existing = JSON.stringify({ name: 'Old', email: 'alice@example.com', requestedAt: '2024-01-01T00:00:00Z' });
    const kv = makeKv({ 'request:existing': existing });
    const env = { ...makeEnv(), GUEST_REQUESTS_KV: kv };
    const req = makeRequest('POST', { name: 'Alice', email: 'alice@example.com' });
    const res = await handlePublicAccessRequest(req, env);
    expect(res.status).toBe(200);
    expect(kv.put).toHaveBeenCalled();
    uuidSpy.mockRestore();
  });

  it('accepts names with European special characters', async () => {
    const kv = makeKv();
    const env = { ...makeEnv(), GUEST_REQUESTS_KV: kv };
    const req = makeRequest('POST', { name: 'Ångström-O\'Brien', email: 'ang@example.com' });
    const res = await handlePublicAccessRequest(req, env);
    expect(res.status).toBe(200);
  });

  it('sends Discord notification when DISCORD_WEBHOOK_URL is set', async () => {
    const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('req-789');
    const mockFetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const env = {
      ...makeEnv(),
      DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
    };
    const req = makeRequest('POST', { name: 'Alice Smith', email: 'alice@example.com' });
    await handlePublicAccessRequest(req, env);

    // Give the fire-and-forget a tick to run
    await new Promise((r) => setTimeout(r, 0));

    const discordCall = mockFetch.mock.calls.find(([url]) =>
      typeof url === 'string' && url.includes('discord.com')
    );
    expect(discordCall).toBeDefined();
    expect(discordCall[0]).toBe('https://discord.com/api/webhooks/123/abc');
    expect(discordCall[1].method).toBe('POST');
    const bodyObj = JSON.parse(discordCall[1].body);
    expect(bodyObj.content).toContain('New access request');
    expect(bodyObj.embeds[0].description).toContain('Alice Smith');
    expect(bodyObj.embeds[0].fields[0].name).toBe('Admin page');
    expect(bodyObj.embeds[0].fields[0].value).toContain('/admin)');
    expect(bodyObj.embeds[0].footer.text).toContain('preview');
    expect(JSON.stringify(bodyObj)).not.toContain('alice@example.com');

    vi.unstubAllGlobals();
    uuidSpy.mockRestore();
  });

  it('sends JSON content-type header for Discord webhook', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const env = { ...makeEnv(), DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc' };
    const req = makeRequest('POST', { name: 'Bob', email: 'bob@example.com' });
    await handlePublicAccessRequest(req, env);
    await new Promise((r) => setTimeout(r, 0));

    const discordCall = mockFetch.mock.calls.find(([url]) =>
      typeof url === 'string' && url.includes('discord.com')
    );
    expect(discordCall[1].headers['Content-Type']).toBe('application/json');

    vi.unstubAllGlobals();
  });

  it('does not show environment badge for production domain', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const env = { ...makeEnv(), DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc' };
    const req = new Request('https://wallabyfest.co.uk/api/access-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Prod User', email: 'prod@example.com' }),
    });
    await handlePublicAccessRequest(req, env);
    await new Promise((r) => setTimeout(r, 0));

    const discordCall = mockFetch.mock.calls.find(([url]) =>
      typeof url === 'string' && url.includes('discord.com')
    );
    const bodyObj = JSON.parse(discordCall[1].body);
    expect(bodyObj.content).not.toContain('⚠️');
    expect(bodyObj.embeds[0].fields.some((field) => field.name === 'Environment')).toBe(false);
    expect(bodyObj.embeds[0].footer.text).toContain('production');

    vi.unstubAllGlobals();
  });

  it('does not send Discord notification when DISCORD_WEBHOOK_URL is absent', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const env = makeEnv(); // no DISCORD_WEBHOOK_URL
    const req = makeRequest('POST', { name: 'Carol', email: 'carol@example.com' });
    await handlePublicAccessRequest(req, env);
    await new Promise((r) => setTimeout(r, 0));

    const discordCall = mockFetch.mock.calls.find(([url]) =>
      typeof url === 'string' && url.includes('discord.com')
    );
    expect(discordCall).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('returns 200 even when Discord notification fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const env = { ...makeEnv(), DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc' };
    const req = makeRequest('POST', { name: 'Dave', email: 'dave@example.com' });
    const res = await handlePublicAccessRequest(req, env);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.status).toBe(200);

    vi.unstubAllGlobals();
  });

  it('registers notification with waitUntil when execution context is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const waitUntil = vi.fn();
    const env = { ...makeEnv(), DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc' };
    const req = makeRequest('POST', { name: 'Eve', email: 'eve@example.com' });
    const res = await handlePublicAccessRequest(req, env, { waitUntil });

    expect(res.status).toBe(200);
    expect(waitUntil).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('logs Discord non-2xx failures for debugging', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 }));
    vi.stubGlobal('fetch', mockFetch);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const waitUntil = vi.fn();
    const env = { ...makeEnv(), DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc' };
    const req = makeRequest('POST', { name: 'Frank', email: 'frank@example.com' });
    const res = await handlePublicAccessRequest(req, env, { waitUntil });

    expect(res.status).toBe(200);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
    expect(errorSpy).toHaveBeenCalledWith(
      'Discord notification failed',
      expect.objectContaining({
        message: expect.stringContaining('403'),
      })
    );

    vi.unstubAllGlobals();
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// handleListAccessRequests — GET /api/private/access-requests
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
      'request:alice-1': JSON.stringify({ requestId: 'alice-1', name: 'Alice', email: 'alice@example.com', requestedAt: '2024-01-01T10:00:00Z' }),
      'request:bob-1': JSON.stringify({ requestId: 'bob-1', name: 'Bob', email: 'bob@example.com', requestedAt: '2024-06-01T10:00:00Z' }),
    });
    const req = makeAdminRequest();
    const res = await handleListAccessRequests(req, { ...makeEnv(), GUEST_REQUESTS_KV: kv });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests[0].email).toBe('bob@example.com');
    expect(body.requests[0].requestId).toBe('bob-1');
    expect(body.requests[1].email).toBe('alice@example.com');
  });
});

// ---------------------------------------------------------------------------
// handleDismissAccessRequest — DELETE /api/private/access-requests/:requestId
// ---------------------------------------------------------------------------

describe('handleDismissAccessRequest', () => {
  const makeAdminDelete = (method = 'DELETE') =>
    makeRequest(method, null, 'admin@example.com');

  it('returns 405 for non-DELETE requests', async () => {
    const res = await handleDismissAccessRequest(makeAdminDelete('GET'), makeEnv(), 'alice-1');
    expect(res.status).toBe(405);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const req = makeRequest('DELETE');
    const res = await handleDismissAccessRequest(req, makeEnv(), 'alice-1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    const req = makeRequest('DELETE', null, 'guest@example.com');
    const res = await handleDismissAccessRequest(req, makeEnv(), 'alice-1');
    expect(res.status).toBe(403);
  });

  it('returns 404 when the KV key does not exist', async () => {
    const req = makeAdminDelete();
    const res = await handleDismissAccessRequest(req, makeEnv(), 'nobody');
    expect(res.status).toBe(404);
  });

  it('deletes the KV entry and returns ok: true', async () => {
    const kv = makeKv({
      'request:alice-1': JSON.stringify({ requestId: 'alice-1', name: 'Alice', email: 'alice@example.com', requestedAt: '2024-01-01T00:00:00Z' }),
    });
    const req = makeAdminDelete();
    const res = await handleDismissAccessRequest(req, { ...makeEnv(), GUEST_REQUESTS_KV: kv }, 'alice-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(kv.delete).toHaveBeenCalledWith('request:alice-1');
  });
});

