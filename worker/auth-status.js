import { jsonResponse } from './response.js';
import { getDevAuthEmailFromCookie, isDevAuthRequestAllowed } from './dev-auth.js';

export const handleAuthStatus = async (request, env = {}) => {
  let email = null;

  if (isDevAuthRequestAllowed(request, env)) {
    email = getDevAuthEmailFromCookie(request);
  }

  if (!email) {
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

      if (identityResponse.ok) {
        const identity = await identityResponse.json().catch(() => null);
        const resolvedEmail = identity?.email || identity?.user_email || identity?.identity?.email || null;
        email = typeof resolvedEmail === 'string' && resolvedEmail ? resolvedEmail : null;
      }
    } catch {
      // If identity lookup fails, treat the user as signed out.
    }
  }

  return jsonResponse(
    {
      signedIn: Boolean(email),
      email,
    },
    {
      headers: {
        'cache-control': 'no-store',
      },
    }
  );
};
