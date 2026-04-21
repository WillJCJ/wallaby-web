import { handleAuthStatus } from './auth-status.js';
import { handlePrivateDetails } from './details.js';
import { handleGuestsApi } from './guests.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /cdn-cgi/image/ is handled by Cloudflare's edge in production and never
    // reaches the Worker. Locally, Wrangler passes it through, so we strip the
    // transform options and serve the underlying resource directly.
    // For small-width requests (width <= 60, i.e. LQIP placeholders) pointing at
    // photo API paths, we serve the pre-generated blur/{key} from local R2 instead.
    if (url.pathname.startsWith('/cdn-cgi/image/')) {
      const afterPrefix = url.pathname.slice('/cdn-cgi/image/'.length);
      const slashIdx = afterPrefix.indexOf('/');
      const opts = slashIdx === -1 ? afterPrefix : afterPrefix.slice(0, slashIdx);
      const innerPath = slashIdx === -1 ? '/' : '/' + afterPrefix.slice(slashIdx + 1);

      const inner = new URL(request.url);
      const widthMatch = opts.match(/width=(\d+)/);
      const width = widthMatch ? parseInt(widthMatch[1], 10) : Infinity;

      if (width <= 60 && innerPath.startsWith('/api/photos/')) {
        inner.pathname = `/api/photos/blur/${innerPath.slice('/api/photos/'.length)}`;
      } else {
        inner.pathname = innerPath;
      }

      return fetch(inner, request);
    }

    if (url.pathname.startsWith('/api/photos/')) {
      if (!env.PHOTOS_BUCKET) {
        return new Response('Photos bucket is not configured', { status: 503 });
      }

      const key = decodeURIComponent(url.pathname.slice('/api/photos/'.length));
      if (!key) {
        return new Response('Photo key is required', { status: 400 });
      }

      const object = await env.PHOTOS_BUCKET.get(key);
      if (!object) {
        return new Response('Photo not found', { status: 404 });
      }

      const extension = key.split('.').pop()?.toLowerCase() || '';
      const fallbackType = extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : 'image/jpeg';

      const headers = new Headers();
      headers.set('content-type', object.httpMetadata?.contentType || fallbackType);
      headers.set('cache-control', 'public, max-age=3600');
      if (object.httpEtag) {
        headers.set('etag', object.httpEtag);
      }

      if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers });
      }

      return new Response(object.body, { status: 200, headers });
    }

    // Route logo requests through one code path and map to env-specific static assets.
    if (url.pathname === '/api/logo.svg' || url.pathname === '/favicon.ico') {
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
