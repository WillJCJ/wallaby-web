import { handleAuthStatus } from './auth-status.js';
import { handlePrivateDetails } from './details.js';
import { handleGuestsApi } from './guests.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route favicon requests through one code path and map to env-specific static assets.
    if (url.pathname === '/api/favicon.ico' || url.pathname === '/favicon.ico') {
      const host = url.hostname;
      const isLocal =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1';
      const isPreview =
        host.includes('-preview') &&
        host.endsWith('.workers.dev');

      const faviconPath = isLocal
        ? '/images/logos/logo_greyscale_red_eyes.svg'
        : isPreview
          ? '/images/logos/logo_orangey.svg'
          : '/images/logos/logo.svg';

      return new Response(null, {
        status: 302,
        headers: {
          location: faviconPath,
          'cache-control': 'no-store',
        },
      });
    }

    if (
      url.pathname === '/api/private/guests' ||
      url.pathname.startsWith('/api/private/guests/')
    ) {
      return handleGuestsApi(request, env, url.pathname);
    }

    switch (url.pathname) {
      case '/api/auth/status':
        return handleAuthStatus(request);

      case '/api/env':
        {
          const metadata = env.CF_VERSION_METADATA;
          const versionId =
            metadata?.id ||
            metadata?.version_id ||
            metadata?.versionId ||
            null;
          const versionTimestamp =
            metadata?.timestamp ||
            metadata?.created_at ||
            metadata?.createdAt ||
            metadata?.created_on ||
            null;

        return new Response(
          JSON.stringify({
            deploymentId: versionId,
            versionId,
            versionTimestamp,
          }),
          {
            headers: {
              'content-type': 'application/json',
            },
          }
        );
        }

      case '/api/private/details':
        return handlePrivateDetails(request, env);
    }

    if (env.ASSETS?.fetch) {
      return env.ASSETS.fetch(request);
    }

    // Defensive local-dev fallback when ASSETS binding is unavailable.
    return new Response('Not Found', { status: 404 });
  },
};
