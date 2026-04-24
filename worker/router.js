import { handleAuthStatus } from './auth-status.js';
import { handlePrivateDetails } from './details.js';
import { handleGuestsApi } from './guests.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/photos/')) {
      if (!env.PHOTOS_BUCKET) {
        return new Response('Photos bucket is not configured', { status: 503 });
      }

      const segment = decodeURIComponent(url.pathname.slice('/api/photos/'.length));
      if (!segment) {
        return new Response('Photo key is required', { status: 400 });
      }

      const w = url.searchParams.get('w');
      const width = w ? parseInt(w, 10) : null;

      // LQIP requests: return a tiny SVG placeholder immediately.
      // In production the browser never requests this URL — CF Image Resizing
      // handles the cdn-cgi LQIP URL at the edge. In preview and local, the
      // CSS background gets a solid placeholder instead.
      if (width !== null && width <= 60) {
        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
          { status: 200, headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' } }
        );
      }

      // On the production domain, use Cloudflare Image Resizing via a cf.image
      // subrequest so we get automatic format negotiation and resizing without
      // needing the /cdn-cgi/image/ URL scheme (which isn't available on
      // workers.dev preview domains).
      const isProduction = url.hostname === 'wallabyfest.co.uk';
      if (isProduction && width !== null && !url.searchParams.has('raw')) {
        const q = url.searchParams.get('q');
        const image = { width };
        if (q) image.quality = parseInt(q, 10);
        const accept = request.headers.get('accept') || '';
        if (/image\/avif/.test(accept)) image.format = 'avif';
        else if (/image\/webp/.test(accept)) image.format = 'webp';
        const rawUrl = new URL(request.url);
        rawUrl.searchParams.set('raw', '1');
        return fetch(rawUrl.toString(), { cf: { image } });
      }

      const key = `photos/${segment}`;
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
          ? '/images/logos/logo_red.svg'
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
