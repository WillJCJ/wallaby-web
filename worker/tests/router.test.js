import { describe, it, expect, vi, afterEach } from 'vitest';
import router from '../router.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const makeEnv = (overrides = {}) => ({
  ASSETS: null,
  CF_VERSION_METADATA: null,
  PHOTOS_BUCKET: null,
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
    expect(res.headers.get('location')).toBe('/images/logos/logo_red.svg');
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

  it('accepts localhost dev-auth cookie fallback when enabled', async () => {
    const req = makeRequest('http://localhost/api/private/details', {
      headers: { cookie: 'wallabyfest-dev-auth-email=dev%40example.com' },
    });

    const res = await router.fetch(req, makeEnv({ DEV_AUTH_ENABLED: 'true' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewer).toBe('dev@example.com');
  });
});

// ---------------------------------------------------------------------------
// /api/private/photos
// ---------------------------------------------------------------------------

describe('router /api/private/photos', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = makeRequest('https://example.com/api/private/photos');
    const res = await router.fetch(req, makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns private media manifest for authenticated users', async () => {
    const req = makeRequest('https://example.com/api/private/photos', {
      headers: { 'CF-Access-Authenticated-User-Email': 'user@example.com' },
    });

    const res = await router.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.photos)).toBe(true);
    expect(body.photos.length).toBeGreaterThan(0);
    expect(body.photos.some((item) => item.id === '2026/sleepy_kids.jpg')).toBe(true);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns 405 for non-GET methods', async () => {
    const req = makeRequest('https://example.com/api/private/photos', {
      method: 'POST',
      headers: { 'CF-Access-Authenticated-User-Email': 'user@example.com' },
    });

    const res = await router.fetch(req, makeEnv());
    expect(res.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// /api/dev-auth/*
// ---------------------------------------------------------------------------

describe('router /api/dev-auth/*', () => {
  it('returns 403 when dev auth is explicitly disabled', async () => {
    const req = makeRequest('http://localhost/api/dev-auth/status');
    const res = await router.fetch(req, makeEnv({ DEV_AUTH_ENABLED: 'false' }));
    expect(res.status).toBe(403);
  });

  it('sets dev auth cookie on login', async () => {
    const req = makeRequest('http://localhost/api/dev-auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'friend@example.com' }),
    });

    const res = await router.fetch(req, makeEnv({ DEV_AUTH_ENABLED: 'true' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('wallabyfest-dev-auth-email=friend%40example.com');
  });

  it('reports current dev auth identity from cookie', async () => {
    const req = makeRequest('http://localhost/api/dev-auth/status', {
      headers: { cookie: 'wallabyfest-dev-auth-email=friend%40example.com' },
    });

    const res = await router.fetch(req, makeEnv({ DEV_AUTH_ENABLED: 'true' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.email).toBe('friend@example.com');
  });

  it('returns 403 on preview hosts even if dev auth flags are set', async () => {
    const req = makeRequest('https://wallaby-web-preview.workers.dev/api/dev-auth/status', {
      headers: { cookie: 'wallabyfest-dev-auth-email=friend%40example.com' },
    });

    const res = await router.fetch(req, makeEnv({
      DEV_AUTH_ENABLED: 'true',
      DEV_AUTH_ALLOWED_HOSTS: 'wallaby-web-preview.workers.dev,localhost',
    }));
    expect(res.status).toBe(403);
  });

  it('returns 403 on production hosts even if dev auth flags are set', async () => {
    const req = makeRequest('https://wallabyfest.co.uk/api/dev-auth/status', {
      headers: { cookie: 'wallabyfest-dev-auth-email=friend%40example.com' },
    });

    const res = await router.fetch(req, makeEnv({
      DEV_AUTH_ENABLED: 'true',
      DEV_AUTH_ALLOWED_HOSTS: 'wallabyfest.co.uk,localhost',
    }));
    expect(res.status).toBe(403);
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

// ---------------------------------------------------------------------------
// /api/photos/*
// ---------------------------------------------------------------------------

describe('router /api/photos/*', () => {
  it('returns SVG placeholder for LQIP requests (w <= 60) without hitting R2', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const req = makeRequest('https://example.com/api/photos/test.jpg?w=40&q=5');
    const res = await router.fetch(req, makeEnv({ PHOTOS_BUCKET: { get: vi.fn() } }));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses cf.image fetch subrequest on the production domain', async () => {
    const mockResponse = new Response('resized-bytes', { status: 200 });
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', mockFetch);

    const req = makeRequest('https://wallabyfest.co.uk/api/photos/sample.jpg?w=600&q=80');
    const res = await router.fetch(req, makeEnv({ PHOTOS_BUCKET: { get: vi.fn() } }));

    expect(res.status).toBe(200);
    const [calledUrl, calledOpts] = mockFetch.mock.calls[0];
    expect(new URL(calledUrl).searchParams.get('raw')).toBe('1');
    expect(calledOpts.cf.image.width).toBe(600);
    expect(calledOpts.cf.image.quality).toBe(80);
  });

  it('returns 503 when PHOTOS_BUCKET binding is unavailable', async () => {
    const req = makeRequest('https://example.com/api/photos/party.jpg');
    const res = await router.fetch(req, makeEnv({ PHOTOS_BUCKET: null }));
    expect(res.status).toBe(503);
  });

  it('returns 404 when photo does not exist in R2', async () => {
    const req = makeRequest('https://example.com/api/photos/missing.jpg');
    const env = makeEnv({
      PHOTOS_BUCKET: {
        get: vi.fn().mockResolvedValue(null),
      },
    });
    const res = await router.fetch(req, env);
    expect(res.status).toBe(404);
  });

  it('returns 404 for private photos without hitting R2 when unauthenticated', async () => {
    const mockGet = vi.fn();
    const req = makeRequest('https://example.com/api/photos/2026/sleepy_kids.jpg');
    const env = makeEnv({
      PHOTOS_BUCKET: {
        get: mockGet,
      },
    });

    const res = await router.fetch(req, env);
    expect(res.status).toBe(404);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns private photos for authenticated requests', async () => {
    const privateBytes = 'private-photo-bytes';
    const mockGet = vi.fn().mockResolvedValue({
      body: privateBytes,
      httpMetadata: { contentType: 'image/jpeg' },
      httpEtag: '"private-photo-etag"',
    });
    const req = makeRequest('https://example.com/api/photos/2026/sleepy_kids.jpg', {
      headers: { 'CF-Access-Authenticated-User-Email': 'viewer@example.com' },
    });
    const env = makeEnv({ PHOTOS_BUCKET: { get: mockGet } });

    const res = await router.fetch(req, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(privateBytes);
    expect(mockGet).toHaveBeenCalledWith('photos/2026/sleepy_kids.jpg');
  });

  it('returns photo content and metadata from R2', async () => {
    const req = makeRequest('https://example.com/api/photos/sample.jpg');
    const mockGet = vi.fn().mockResolvedValue({
      body: 'photo-bytes',
      httpMetadata: { contentType: 'image/jpeg' },
      httpEtag: '"etag-123"',
    });
    const env = makeEnv({
      PHOTOS_BUCKET: { get: mockGet },
    });

    const res = await router.fetch(req, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('photo-bytes');
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(res.headers.get('etag')).toBe('"etag-123"');
    expect(mockGet).toHaveBeenCalledWith('photos/sample.jpg');
  });
});

// ---------------------------------------------------------------------------
// /api/videos/*
// ---------------------------------------------------------------------------

describe('router /api/videos/*', () => {
  it('returns 503 when PHOTOS_BUCKET binding is unavailable', async () => {
    const req = makeRequest('https://example.com/api/videos/clip.mp4');
    const res = await router.fetch(req, makeEnv({ PHOTOS_BUCKET: null }));
    expect(res.status).toBe(503);
  });

  it('returns 404 when video does not exist in R2', async () => {
    const req = makeRequest('https://example.com/api/videos/missing.mp4');
    const env = makeEnv({ PHOTOS_BUCKET: { get: vi.fn().mockResolvedValue(null) } });
    const res = await router.fetch(req, env);
    expect(res.status).toBe(404);
  });

  it('returns 404 for private media ids on the videos endpoint without hitting R2 when unauthenticated', async () => {
    const mockGet = vi.fn();
    const req = makeRequest('https://example.com/api/videos/2026/sleepy_kids.jpg');
    const env = makeEnv({ PHOTOS_BUCKET: { get: mockGet } });

    const res = await router.fetch(req, env);
    expect(res.status).toBe(404);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns private media ids on the videos endpoint for authenticated requests', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      body: 'private-video-bytes',
      httpMetadata: { contentType: 'video/mp4' },
      httpEtag: '"private-video-etag"',
      size: 1234,
    });
    const req = makeRequest('https://example.com/api/videos/2026/sleepy_kids.jpg', {
      headers: { 'CF-Access-Authenticated-User-Email': 'viewer@example.com' },
    });
    const env = makeEnv({ PHOTOS_BUCKET: { get: mockGet } });

    const res = await router.fetch(req, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('private-video-bytes');
    expect(mockGet).toHaveBeenCalledWith('videos/2026/sleepy_kids.jpg', {});
  });

  it('returns video content with correct headers', async () => {
    const req = makeRequest('https://example.com/api/videos/clip.mp4');
    const mockGet = vi.fn().mockResolvedValue({
      body: 'video-bytes',
      httpMetadata: { contentType: 'video/mp4' },
      httpEtag: '"etag-vid"',
      size: 5000000,
    });
    const env = makeEnv({ PHOTOS_BUCKET: { get: mockGet } });

    const res = await router.fetch(req, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('video-bytes');
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(mockGet).toHaveBeenCalledWith('videos/clip.mp4', {});
  });

  it('handles Range requests and returns 206', async () => {
    const req = makeRequest('https://example.com/api/videos/clip.mp4', {
      headers: { range: 'bytes=0-1023' },
    });
    const mockGet = vi.fn().mockResolvedValue({
      body: 'partial-bytes',
      httpMetadata: {},
      size: 5000000,
      range: { offset: 0, length: 1024 },
    });
    const env = makeEnv({ PHOTOS_BUCKET: { get: mockGet } });

    const res = await router.fetch(req, env);
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-1023/5000000');
    expect(res.headers.get('content-length')).toBe('1024');
    expect(mockGet).toHaveBeenCalledWith('videos/clip.mp4', { offset: 0, length: 1024 });
  });
});

// /api/private/game/*
// ---------------------------------------------------------------------------

describe('router /api/private/game/*', () => {
  it('allows unauthenticated high-score requests', async () => {
    const req = makeRequest('https://example.com/api/game/high-scores');
    const env = makeEnv({
      GUESTS_DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => ({ results: [] }),
          }),
        }),
      },
    });
    const res = await router.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leaderboard).toEqual([]);
    expect(body.myBest).toBeNull();
  });

  it('returns 401 for unauthenticated run start request', async () => {
    const req = makeRequest('https://example.com/api/private/game/runs/start', { method: 'POST' });
    const res = await router.fetch(req, makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 401 for unauthenticated run finish request', async () => {
    const req = makeRequest('https://example.com/api/private/game/runs/test-run/finish', { method: 'POST' });
    const res = await router.fetch(req, makeEnv());
    expect(res.status).toBe(401);
  });
});
