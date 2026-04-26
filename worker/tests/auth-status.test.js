import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleAuthStatus } from '../auth-status.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const makeRequest = (cookie = '') =>
  new Request('http://example.com/api/auth/status', {
    headers: cookie ? { cookie } : {},
  });

describe('handleAuthStatus', () => {
  it('returns dev-auth identity on localhost when dev auth is enabled', async () => {
    const req = new Request('http://localhost/api/auth/status', {
      headers: { cookie: 'wallabyfest-dev-auth-email=local%40example.com' },
    });

    const res = await handleAuthStatus(req, { DEV_AUTH_ENABLED: 'true' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedIn).toBe(true);
    expect(body.email).toBe('local@example.com');
  });

  it('ignores dev-auth cookie on non-local hosts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    ));

    const req = new Request('https://example.com/api/auth/status', {
      headers: { cookie: 'wallabyfest-dev-auth-email=local%40example.com' },
    });

    const res = await handleAuthStatus(req, { DEV_AUTH_ENABLED: 'true' });
    const body = await res.json();
    expect(body.signedIn).toBe(false);
    expect(body.email).toBeNull();
  });

  it('returns signedIn: true with the email when identity lookup succeeds', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ email: 'user@example.com' }), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const res = await handleAuthStatus(makeRequest('cf_auth=token'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedIn).toBe(true);
    expect(body.email).toBe('user@example.com');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [requestArg] = mockFetch.mock.calls[0];
    expect(requestArg.url).toContain('/cdn-cgi/access/get-identity');
  });

  it('resolves email from user_email field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user_email: 'alt@example.com' }), { status: 200 })
    ));

    const res = await handleAuthStatus(makeRequest());
    const body = await res.json();
    expect(body.email).toBe('alt@example.com');
  });

  it('resolves email from nested identity.email field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ identity: { email: 'nested@example.com' } }), { status: 200 })
    ));

    const res = await handleAuthStatus(makeRequest());
    const body = await res.json();
    expect(body.email).toBe('nested@example.com');
  });

  it('returns signedIn: false when identity lookup returns a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    ));

    const res = await handleAuthStatus(makeRequest());
    const body = await res.json();
    expect(body.signedIn).toBe(false);
    expect(body.email).toBeNull();
  });

  it('returns signedIn: false when the identity fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const res = await handleAuthStatus(makeRequest());
    const body = await res.json();
    expect(body.signedIn).toBe(false);
    expect(body.email).toBeNull();
  });

  it('returns signedIn: false when the identity JSON is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    ));

    const res = await handleAuthStatus(makeRequest());
    const body = await res.json();
    expect(body.signedIn).toBe(false);
    expect(body.email).toBeNull();
  });

  it('returns signedIn: false when the identity body is malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('not json', { status: 200 })
    ));

    const res = await handleAuthStatus(makeRequest());
    const body = await res.json();
    expect(body.signedIn).toBe(false);
    expect(body.email).toBeNull();
  });

  it('sets cache-control: no-store on the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    ));

    const res = await handleAuthStatus(makeRequest());
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
