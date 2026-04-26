import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDevAuthEmailFromCookie,
  handleDevAuthApi,
  isDevAuthEnabled,
  isDevAuthRequestAllowed,
} from '../dev-auth.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const makeRequest = (url, options = {}) => new Request(url, options);

describe('isDevAuthEnabled', () => {
  it('returns true on localhost when DEV_AUTH_ENABLED=true', () => {
    const req = makeRequest('http://localhost/api/dev-auth/login');
    expect(isDevAuthEnabled({ DEV_AUTH_ENABLED: 'true' }, req)).toBe(true);
  });

  it('returns false on localhost when DEV_AUTH_ENABLED=false', () => {
    const req = makeRequest('http://localhost/api/dev-auth/login');
    expect(isDevAuthEnabled({ DEV_AUTH_ENABLED: 'false' }, req)).toBe(false);
  });

  it('returns true by default on localhost when flag is unset', () => {
    const req = makeRequest('http://127.0.0.1/api/dev-auth/login');
    expect(isDevAuthEnabled({}, req)).toBe(true);
  });

  it('returns false on non-local hosts even when DEV_AUTH_ENABLED=true', () => {
    const req = makeRequest('https://wallaby-web-preview.workers.dev/api/dev-auth/login');
    expect(isDevAuthEnabled({ DEV_AUTH_ENABLED: 'true' }, req)).toBe(false);
  });
});

describe('isDevAuthRequestAllowed', () => {
  it('allows configured localhost hosts', () => {
    const req = makeRequest('http://localhost/api/dev-auth/login');
    expect(isDevAuthRequestAllowed(req, {
      DEV_AUTH_ENABLED: 'true',
      DEV_AUTH_ALLOWED_HOSTS: 'localhost,127.0.0.1',
    })).toBe(true);
  });

  it('blocks hosts not in DEV_AUTH_ALLOWED_HOSTS', () => {
    const req = makeRequest('http://localhost/api/dev-auth/login');
    expect(isDevAuthRequestAllowed(req, {
      DEV_AUTH_ENABLED: 'true',
      DEV_AUTH_ALLOWED_HOSTS: '127.0.0.1',
    })).toBe(false);
  });
});

describe('getDevAuthEmailFromCookie', () => {
  it('extracts valid email from cookie', () => {
    const req = makeRequest('http://localhost/api/auth/status', {
      headers: { cookie: 'wallabyfest-dev-auth-email=test%40example.com' },
    });

    expect(getDevAuthEmailFromCookie(req)).toBe('test@example.com');
  });

  it('returns null when cookie is missing or invalid', () => {
    const req = makeRequest('http://localhost/api/auth/status', {
      headers: { cookie: 'wallabyfest-dev-auth-email=invalid' },
    });

    expect(getDevAuthEmailFromCookie(req)).toBeNull();
  });
});

describe('handleDevAuthApi', () => {
  it('returns 403 on non-local hosts', async () => {
    const req = makeRequest('https://example.com/api/dev-auth/status');
    const res = await handleDevAuthApi(req, { DEV_AUTH_ENABLED: 'true' }, '/api/dev-auth/status');
    expect(res.status).toBe(403);
  });

  it('sets cookie on successful localhost login', async () => {
    const req = makeRequest('http://localhost/api/dev-auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'friend@example.com' }),
    });

    const res = await handleDevAuthApi(req, { DEV_AUTH_ENABLED: 'true' }, '/api/dev-auth/login');
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('wallabyfest-dev-auth-email=friend%40example.com');
  });

  it('clears cookie on localhost logout', async () => {
    const req = makeRequest('http://localhost/api/dev-auth/logout', {
      method: 'POST',
    });

    const res = await handleDevAuthApi(req, { DEV_AUTH_ENABLED: 'true' }, '/api/dev-auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('rejects invalid login payloads', async () => {
    const req = makeRequest('http://localhost/api/dev-auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'invalid' }),
    });

    const res = await handleDevAuthApi(req, { DEV_AUTH_ENABLED: 'true' }, '/api/dev-auth/login');
    expect(res.status).toBe(400);
  });
});
