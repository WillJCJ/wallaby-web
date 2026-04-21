import { unauthorized, forbidden } from './response.js';

export const getAuthenticatedEmail = (request) => request.headers.get('CF-Access-Authenticated-User-Email');

export const parseAdminEmails = (env) => {
  const raw = env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
};

export const requireAuthenticatedEmail = (request) => {
  const email = getAuthenticatedEmail(request);

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
