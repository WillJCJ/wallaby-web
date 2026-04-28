import { badRequest, forbidden, jsonResponse, methodNotAllowed } from './response.js';
import { isLocalHost, normalizeHost } from './host.js';

const DEV_AUTH_COOKIE = 'wallabyfest-dev-auth-email';

const getCookieValue = (cookieHeader, cookieName) => {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return null;
  }

  const parts = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const pair of parts) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = pair.slice(0, separatorIndex).trim();
    if (key !== cookieName) {
      continue;
    }

    const value = pair.slice(separatorIndex + 1).trim();
    return decodeURIComponent(value);
  }

  return null;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isEmailLike = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const getAllowedHosts = (env) => {
  const raw = String(env?.DEV_AUTH_ALLOWED_HOSTS || '').trim();
  if (!raw) {
    return new Set(['localhost', '127.0.0.1', '::1']);
  }

  return new Set(
    raw
      .split(',')
      .map((host) => normalizeHost(host))
      .filter(Boolean)
  );
};

export const isDevAuthEnabled = (env, request) => {
  const host = normalizeHost(new URL(request.url).hostname);
  if (!isLocalHost(host)) {
    return false;
  }

  const flag = String(env?.DEV_AUTH_ENABLED || '').trim().toLowerCase();

  if (flag === 'false') {
    return false;
  }

  if (flag === 'true') {
    return true;
  }

  return isLocalHost(host);
};

export const isDevAuthRequestAllowed = (request, env) => {
  if (!isDevAuthEnabled(env, request)) {
    return false;
  }

  const host = normalizeHost(new URL(request.url).hostname);
  return getAllowedHosts(env).has(host);
};

export const getDevAuthEmailFromCookie = (request) => {
  const rawEmail = getCookieValue(request.headers.get('cookie') || '', DEV_AUTH_COOKIE);
  const email = normalizeEmail(rawEmail);
  if (!email || !isEmailLike(email)) {
    return null;
  }

  return email;
};

const createCookie = (email, maxAgeSeconds = 60 * 60 * 12) => (
  `${DEV_AUTH_COOKIE}=${encodeURIComponent(email)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`
);

const clearCookie = () => (
  `${DEV_AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
);

export const handleDevAuthApi = async (request, env, pathname) => {
  if (!isDevAuthRequestAllowed(request, env)) {
    return forbidden();
  }

  if (pathname === '/api/dev-auth/status') {
    if (request.method !== 'GET') {
      return methodNotAllowed();
    }

    return jsonResponse({
      enabled: true,
      email: getDevAuthEmailFromCookie(request),
    }, {
      headers: { 'cache-control': 'no-store' },
    });
  }

  if (pathname === '/api/dev-auth/login') {
    if (request.method !== 'POST') {
      return methodNotAllowed();
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Invalid JSON body');
    }

    const email = normalizeEmail(body.email);
    if (!isEmailLike(email)) {
      return badRequest('Valid email is required');
    }

    return jsonResponse({ ok: true, email }, {
      headers: {
        'set-cookie': createCookie(email),
        'cache-control': 'no-store',
      },
    });
  }

  if (pathname === '/api/dev-auth/logout') {
    if (request.method !== 'POST') {
      return methodNotAllowed();
    }

    return jsonResponse({ ok: true }, {
      headers: {
        'set-cookie': clearCookie(),
        'cache-control': 'no-store',
      },
    });
  }

  return methodNotAllowed();
};
