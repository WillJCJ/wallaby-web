import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getAuthenticatedEmail,
  resolveAuthenticatedEmail,
  parseAdminEmails,
  requireAuthenticatedEmail,
  requireAdmin,
  normalizeAuthenticatedEmail,
} from '../auth.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getAuthenticatedEmail
// ---------------------------------------------------------------------------

describe('getAuthenticatedEmail', () => {
  it('returns the CF-Access-Authenticated-User-Email header value', () => {
    const req = new Request('http://example.com', {
      headers: { 'CF-Access-Authenticated-User-Email': 'user@example.com' },
    });
    expect(getAuthenticatedEmail(req)).toBe('user@example.com');
  });

  it('returns null when the header is absent', () => {
    const req = new Request('http://example.com');
    expect(getAuthenticatedEmail(req)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveAuthenticatedEmail
// ---------------------------------------------------------------------------

describe('resolveAuthenticatedEmail', () => {
  it('uses the CF header before considering dev-auth cookie fallback', async () => {
    const req = new Request('http://localhost/api/private/details', {
      headers: {
        'CF-Access-Authenticated-User-Email': 'header@example.com',
        cookie: 'wallabyfest-dev-auth-email=cookie%40example.com',
      },
    });
    const resolved = await resolveAuthenticatedEmail(req, { DEV_AUTH_ENABLED: 'true' });
    expect(resolved).toBe('header@example.com');
  });

  it('uses dev-auth cookie on localhost when enabled', async () => {
    const req = new Request('http://localhost/api/private/details', {
      headers: {
        cookie: 'wallabyfest-dev-auth-email=friend%40example.com',
      },
    });
    const resolved = await resolveAuthenticatedEmail(req, { DEV_AUTH_ENABLED: 'true' });
    expect(resolved).toBe('friend@example.com');
  });

  it('falls back to access identity lookup when auth header is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ email: 'identity@example.com' }), { status: 200 })
    ));

    const req = new Request('https://example.com/api/private/details', {
      headers: { cookie: 'CF_Authorization=token' },
    });
    const resolved = await resolveAuthenticatedEmail(req, { DEV_AUTH_ENABLED: 'true' });
    expect(resolved).toBe('identity@example.com');
  });

  it('accepts bracketed IPv6 localhost hostnames', async () => {
    const req = new Request('http://[::1]/api/private/details', {
      headers: {
        cookie: 'wallabyfest-dev-auth-email=friend%40example.com',
      },
    });
    const resolved = await resolveAuthenticatedEmail(req, { DEV_AUTH_ENABLED: 'true' });
    expect(resolved).toBe('friend@example.com');
  });

  it('never uses dev-auth cookie on preview hosts even when explicitly configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    ));

    const req = new Request('https://wallaby-web-preview.workers.dev/api/private/details', {
      headers: {
        cookie: 'wallabyfest-dev-auth-email=friend%40example.com',
      },
    });

    const resolved = await resolveAuthenticatedEmail(req, {
      DEV_AUTH_ENABLED: 'true',
      DEV_AUTH_ALLOWED_HOSTS: 'wallaby-web-preview.workers.dev,localhost',
    });
    expect(resolved).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseAdminEmails
// ---------------------------------------------------------------------------

describe('parseAdminEmails', () => {
  it('parses a comma-separated list of emails', () => {
    const env = { ADMIN_EMAILS: 'admin@example.com, boss@example.com' };
    const admins = parseAdminEmails(env);
    expect(admins.has('admin@example.com')).toBe(true);
    expect(admins.has('boss@example.com')).toBe(true);
  });

  it('normalises email addresses to lowercase', () => {
    const env = { ADMIN_EMAILS: 'Admin@Example.COM' };
    const admins = parseAdminEmails(env);
    expect(admins.has('admin@example.com')).toBe(true);
  });

  it('filters out empty entries', () => {
    const env = { ADMIN_EMAILS: 'a@b.com,,  ,c@d.com' };
    const admins = parseAdminEmails(env);
    expect(admins.size).toBe(2);
  });

  it('returns an empty Set when ADMIN_EMAILS is not set', () => {
    const admins = parseAdminEmails({});
    expect(admins.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// requireAuthenticatedEmail
// ---------------------------------------------------------------------------

describe('requireAuthenticatedEmail', () => {
  it('returns the email when the header is present', async () => {
    const req = new Request('http://example.com', {
      headers: { 'CF-Access-Authenticated-User-Email': 'user@example.com' },
    });
    const result = await requireAuthenticatedEmail(req);
    expect(result.email).toBe('user@example.com');
    expect(result.error).toBeUndefined();
  });

  it('returns a 401 error response when the header is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    ));

    const req = new Request('http://example.com');
    const result = await requireAuthenticatedEmail(req);
    expect(result.error).toBeInstanceOf(Response);
    expect(result.error.status).toBe(401);
    const body = await result.error.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('authenticates with dev-auth cookie when enabled for localhost', async () => {
    const req = new Request('http://localhost/api/private/details', {
      headers: {
        cookie: 'wallabyfest-dev-auth-email=tester%40example.com',
      },
    });
    const result = await requireAuthenticatedEmail(req, { DEV_AUTH_ENABLED: 'true' });
    expect(result.email).toBe('tester@example.com');
    expect(result.error).toBeUndefined();
  });

  it('authenticates through access identity lookup when header is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ email: 'user@example.com' }), { status: 200 })
    ));

    const req = new Request('https://preview.workers.dev/api/private/details', {
      headers: { cookie: 'CF_Authorization=token' },
    });
    const result = await requireAuthenticatedEmail(req);
    expect(result.email).toBe('user@example.com');
    expect(result.error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------

describe('requireAdmin', () => {
  it('returns null when the email is in the admin list', () => {
    const env = { ADMIN_EMAILS: 'admin@example.com' };
    expect(requireAdmin('admin@example.com', env)).toBeNull();
  });

  it('is case-insensitive for the email comparison', () => {
    const env = { ADMIN_EMAILS: 'Admin@Example.com' };
    expect(requireAdmin('ADMIN@EXAMPLE.COM', env)).toBeNull();
  });

  it('returns a 403 response when the email is not an admin', async () => {
    const env = { ADMIN_EMAILS: 'admin@example.com' };
    const result = requireAdmin('other@example.com', env);
    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(403);
    const body = await result.json();
    expect(body.error).toBe('Forbidden');
  });
});

// ---------------------------------------------------------------------------
// normalizeAuthenticatedEmail
// ---------------------------------------------------------------------------

describe('normalizeAuthenticatedEmail', () => {
  it('trims and lowercases an email', () => {
    expect(normalizeAuthenticatedEmail('  User@Example.COM  ')).toBe('user@example.com');
  });

  it('handles null gracefully', () => {
    expect(normalizeAuthenticatedEmail(null)).toBe('');
  });

  it('handles undefined gracefully', () => {
    expect(normalizeAuthenticatedEmail(undefined)).toBe('');
  });

  it('handles an empty string', () => {
    expect(normalizeAuthenticatedEmail('')).toBe('');
  });
});
