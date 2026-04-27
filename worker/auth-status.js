import { jsonResponse } from './response.js';
import { resolveAuthenticatedEmail } from './auth.js';

export const handleAuthStatus = async (request, env = {}) => {
  const email = await resolveAuthenticatedEmail(request, env);

  return jsonResponse(
    {
      signedIn: Boolean(email),
    },
    {
      headers: {
        'cache-control': 'no-store',
      },
    }
  );
};
