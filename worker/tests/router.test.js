import { describe, it, expect, vi, afterEach } from 'vitest';
import router from '../router.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const makeEnv = (overrides = {}) => ({
  ASSETS: null,
  CF_VERSION_METADATA: null,
  ...overrides,
});

const makeRequest = (url, options = {}) => new Request(url, options);

// ---------------------------------------------------------------------------
// Favicon routing
// ---------------------------------------------------------------------------

describe('router favicon routing', () => {
  it('redirects /favicon.ico to /images/logos/logo.svg on production', async () => {
    const req = makeRequest('https://wallaby.example.com/favicon.ico');
    const res = await router.fetch(req, makeEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/images/logos/logo.svg');
  });

  it('redirects /api/logo.svg to the localhost logo on localhost', async () => {
    const req = makeRequest('http://localhost/api/logo.svg');
    const res = await router.fetch(req, makeEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/images/logos/logo_greyscale_red_eyes.svg');
  });

  it('redirects to the preview logo on a -preview.workers.dev host', async () => {
    const req = makeRequest('https://my-app-preview.workers.dev/favicon.ico');
    const res = await router.fetch(req, makeEnv());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/images/logos/logo_orangey.svg');
  });

  it('sets cache-control: no-store on favicon responses', async () => {
    const req = makeRequest('https://wallaby.example.com/favicon.ico');
    const res = await router.fetch(req, makeEnv());
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

// ---------------------------------------------------------------------------
// /api/env
// ---------------------------------------------------------------------------

describe('router /api/env', () => {
  it('returns version metadata when available', async () => {
    const req = makeRequest('https://example.com/api/env');
    const env = makeEnv({
      CF_VERSION_METADATA: { id: 'abc-123', timestamp: '2024-01-01T00:00:00Z' },
    });
    const res = await router.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versionId).toBe('abc-123');
    expect(body.versionTimestamp).toBe('2024-01-01T00:00:00Z');
  });

  it('returns null values when CF_VERSION_METADATA is not set', async () => {
    const req = makeRequest('https://example.com/api/env');
    const res = await router.fetch(req, makeEnv());
    const body = await res.json();
    expect(body.versionId).toBeNull();
    expect(body.versionTimestamp).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// /api/auth/status
// ---------------------------------------------------------------------------

describe('router /api/auth/status', () => {
  it('delegates to handleAuthStatus and returns JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ email: 'user@example.com' }), { status: 200 })
    ));

    const req = makeRequest('https://example.com/api/auth/status');
    const res = await router.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('signedIn');
  });
});

// ---------------------------------------------------------------------------
// /api/private/details
// ---------------------------------------------------------------------------

describe('router /api/private/details', () => {
  it('returns 401 when no auth header is present', async () => {
    const req = makeRequest('https://example.com/api/private/details');
    const res = await router.fetch(req, makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns details for an authenticated user', async () => {
    const req = makeRequest('https://example.com/api/private/details', {
      headers: { 'CF-Access-Authenticated-User-Email': 'user@example.com' },
    });
    const res = await router.fetch(req, makeEnv({ EVENT_ADDRESS: '1 Test Lane', GATE_CODE: '0000' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.address).toBe('1 Test Lane');
  });
});

// ---------------------------------------------------------------------------
// ASSETS fallback
// ---------------------------------------------------------------------------

describe('router ASSETS fallback', () => {
  it('falls back to the ASSETS binding for unknown routes', async () => {
    const assetResponse = new Response('Asset content', { status: 200 });
    const env = makeEnv({
      ASSETS: { fetch: vi.fn().mockResolvedValue(assetResponse) },
    });
    const req = makeRequest('https://example.com/some/page');
    const res = await router.fetch(req, env);
    expect(res.status).toBe(200);
  });

  it('returns 404 when ASSETS binding is unavailable', async () => {
    const req = makeRequest('https://example.com/unknown');
    const res = await router.fetch(req, makeEnv());
    expect(res.status).toBe(404);
  });
});
