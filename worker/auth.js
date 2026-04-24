import { unauthorized, forbidden } from './response.js';
import { getDevAuthEmailFromCookie, isDevAuthRequestAllowed } from './dev-auth.js';

export const getAuthenticatedEmail = (request) => request.headers.get('CF-Access-Authenticated-User-Email');

export const resolveAuthenticatedEmail = (request, env = {}) => {
  const headerEmail = getAuthenticatedEmail(request);
  if (headerEmail) {
    return headerEmail;
  }

  if (!isDevAuthRequestAllowed(request, env)) {
    return null;
  }

  return getDevAuthEmailFromCookie(request);
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

export const requireAuthenticatedEmail = (request, env = {}) => {
  const email = resolveAuthenticatedEmail(request, env);

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
