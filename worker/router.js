import { handleAuthStatus } from './auth-status.js';
import { handlePrivateDetails } from './details.js';
import { handleGuestsApi } from './guests.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/private/guests')) {
      return handleGuestsApi(request, env, url.pathname);
    }

    switch (url.pathname) {
      case '/api/auth/status':
        return handleAuthStatus(request);

      case '/api/env':
        return new Response(
          JSON.stringify({
            deploymentId: env.CF_DEPLOYMENT_ID || null,
          }),
          {
            headers: {
              'content-type': 'application/json',
            },
          }
        );

      case '/api/private/details':
        return handlePrivateDetails(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
