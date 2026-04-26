import { unauthorized, forbidden } from './response.js';
import { getDevAuthEmailFromCookie, isDevAuthRequestAllowed } from './dev-auth.js';

export const getAuthenticatedEmail = (request) => request.headers.get('CF-Access-Authenticated-User-Email');

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
