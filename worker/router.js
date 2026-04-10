import { handleAuthStatus } from './auth-status.js';
import { handlePrivateDetails } from './details.js';
import { handleGuestsApi } from './guests.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Keep one canonical favicon and swap underlying asset by environment host.
    if (
      url.pathname === '/api/favicon.ico' ||
      url.pathname === '/favicon.ico' ||
      url.pathname === '/images/favicon.ico'
    ) {
      const host = url.hostname;
      const isLocal =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1';
      const isPreview =
        host.includes('-preview') &&
        host.endsWith('.workers.dev');

      const faviconPath = isLocal
        ? '/images/favicon-local.ico'
        : isPreview
          ? '/images/favicon-preview.ico'
          : '/images/favicon.ico';

      if (env.LOG_LEVEL === 'debug') {
        console.log('[favicon] resolve', {
          host,
          pathname: url.pathname,
          isLocal,
          isPreview,
          faviconPath,
        });
      }

      const faviconUrl = new URL(request.url);
      faviconUrl.pathname = faviconPath;
      const response = Response.redirect(faviconUrl.toString(), 302);
      response.headers.set('cache-control', 'no-store');

      if (env.LOG_LEVEL === 'debug') {
        console.log('[favicon] response', {
          pathname: url.pathname,
          resolvedPath: faviconPath,
          status: 302,
        });
      }

      return response;
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
