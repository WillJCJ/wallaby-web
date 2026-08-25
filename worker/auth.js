import { unauthorized, forbidden } from './response.js';
import { getDevAuthEmailFromCookie, isDevAuthRequestAllowed } from './dev-auth.js';

export const getAuthenticatedEmail = (request) => request.headers.get('CF-Access-Authenticated-User-Email');

// eslint-disable-next-line complexity -- Identity fetch parses multiple response formats and handles network, JSON, and auth errors.
export const fetchAccessIdentityEmail = async (request) => {
  try {
    const identityUrl = new URL('/cdn-cgi/access/get-identity', request.url);
    const identityResponse = await fetch(new Request(identityUrl.toString(), {
      method: 'GET',
      headers: {
        cookie: request.headers.get('cookie') || '',
        accept: 'application/json',
      },
      redirect: 'manual',
    }));

    if (!identityResponse.ok) {
      return null;
    }

    const identity = await identityResponse.json().catch(() => null);
    const resolvedEmail = identity?.email || identity?.user_email || identity?.identity?.email || null;
    return typeof resolvedEmail === 'string' && resolvedEmail ? resolvedEmail : null;
  } catch {
    return null;
  }
};

export const resolveAuthenticatedEmail = async (request, env = {}) => {
  const headerEmail = getAuthenticatedEmail(request);
  if (headerEmail) {
    return headerEmail;
  }

  // Test auth bypass: lets Playwright tests identify a user without a real Cloudflare
  // Access login. Cloudflare Access strips CF-Access-Authenticated-User-Email, so service
  // token headers alone only bypass the edge challenge — the worker still sees no identity.
  // Gated on TEST_AUTH_SECRET so it is inert in production where the var is unset.
  if (env.TEST_AUTH_SECRET) {
    const secret = request.headers.get('X-Test-Auth-Secret');
    const email = request.headers.get('X-Test-Auth-Email');
    if (secret && email) {
      const secretValid = await crypto.subtle.timingSafeEqual(
        new TextEncoder().encode(secret),
        new TextEncoder().encode(env.TEST_AUTH_SECRET),
      );
      if (secretValid) {
        return normalizeAuthenticatedEmail(email);
      }
    }
  }

  if (isDevAuthRequestAllowed(request, env)) {
    const devAuthEmail = getDevAuthEmailFromCookie(request);
    if (devAuthEmail) {
      return devAuthEmail;
    }
  }

  return fetchAccessIdentityEmail(request);
};

export const parseAdminEmails = (env) => {
  const raw = env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
};

export const requireAuthenticatedEmail = async (request, env = {}) => {
  const email = await resolveAuthenticatedEmail(request, env);

  if (!email) {
    return { error: unauthorized() };
  }

  return { email };
};

export const requireAdmin = (email, env) => {
  const admins = parseAdminEmails(env);

  if (!admins.has(email.toLowerCase())) {
    return forbidden();
  }

  return null;
};

export const normalizeAuthenticatedEmail = (email) => String(email || '').trim().toLowerCase();
