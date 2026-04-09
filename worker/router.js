import { handlePrivateDetails } from './details.js';
import { handleGuestsApi } from './guests.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/env') {
      const versionMetadata = env.CF_VERSION_METADATA || null;
      return new Response(
        JSON.stringify({
          deploymentId: versionMetadata?.id || null,
          versionId: versionMetadata?.id || null,
          versionTag: versionMetadata?.tag || null,
          versionTimestamp: versionMetadata?.timestamp || null,
        }),
        {
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          },
        }
      );
    }

    if (url.pathname === '/api/private/details') {
      return handlePrivateDetails(request, env);
    }

    if (url.pathname === '/api/private/guests' || url.pathname.startsWith('/api/private/guests/')) {
      return handleGuestsApi(request, env, url.pathname);
    }

    return env.ASSETS.fetch(request);
  },
};
