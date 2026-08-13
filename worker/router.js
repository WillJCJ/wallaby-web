import { handleAuthStatus } from './auth-status.js';
import { handleDevAuthApi } from './dev-auth.js';
import { handlePrivateDetails } from './details.js';
import { handleGuestsApi } from './guests.js';
import {
  handlePublicAccessRequest,
  handleListAccessRequests,
  handleDismissAccessRequest,
} from './access-requests.js';
import {
  handleGameHighScores,
  handleGameRunStart,
  handleGameRunFinish,
} from './game-scores.js';
import { isLocalHost, isProductionHost, isWorkersPreviewHost } from './host.js';
import photos from '../site/_data/photos.json' with { type: 'json' };

// Parse a Range header value (e.g. "bytes=0-1023") into R2 get() options.
const parseRange = (header) => {
  const match = /^bytes=(\d+)-(\d*)$/.exec(header);
  if (!match) { return {}; }
  const offset = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : undefined;
  return end !== undefined ? { offset, length: end - offset + 1 } : { offset };
};

const getVideoMimeType = (extension) => {
  if (extension === 'mp4') { return 'video/mp4'; }
  if (extension === 'webm') { return 'video/webm'; }
  if (extension === 'mov') { return 'video/quicktime'; }
  return 'video/mp4';
};

const privateMediaIds = new Set(
  photos
    .filter((item) => item?.private === true && typeof item?.id === 'string')
    .map((item) => item.id)
);



export default {
  // eslint-disable-next-line complexity -- Central worker entrypoint intentionally handles all route branches.
  async fetch(request, env, executionCtx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/videos/')) {
      if (!env.PHOTOS_BUCKET) {
        return new Response('Photos bucket is not configured', { status: 503 });
      }

      const segment = decodeURIComponent(url.pathname.slice('/api/videos/'.length));
      if (!segment) {
        return new Response('Video key is required', { status: 400 });
      }

      if (privateMediaIds.has(segment)) {
        return new Response('Video not found', { status: 404 });
      }

      const key = `videos/${segment}`;
      const rangeHeader = request.headers.get('range');
      const options = rangeHeader ? parseRange(rangeHeader) : {};
      const object = await env.PHOTOS_BUCKET.get(key, options);

      if (!object) {
        return new Response('Video not found', { status: 404 });
      }

      const extension = segment.split('.').pop()?.toLowerCase() || '';
      const contentType = object.httpMetadata?.contentType || getVideoMimeType(extension);

      const headers = new Headers();
      headers.set('content-type', contentType);
      headers.set('accept-ranges', 'bytes');
      headers.set('cache-control', 'public, max-age=3600');
      if (object.httpEtag) { headers.set('etag', object.httpEtag); }
      if (object.size !== null && object.size !== undefined) { headers.set('content-length', String(object.size)); }

      if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers });
      }

      const status = rangeHeader ? 206 : 200;
      if (rangeHeader && object.range) {
        const { offset = 0, length } = object.range;
        const total = object.size ?? '*';
        const end = length !== null && length !== undefined ? offset + length - 1 : total - 1;
        headers.set('content-range', `bytes ${offset}-${end}/${total}`);
        if (length !== null && length !== undefined) { headers.set('content-length', String(length)); }
      }

      return new Response(object.body, { status, headers });
    }

    if (url.pathname.startsWith('/api/photos/')) {
      if (!env.PHOTOS_BUCKET) {
        return new Response('Photos bucket is not configured', { status: 503 });
      }

      const segment = decodeURIComponent(url.pathname.slice('/api/photos/'.length));
      if (!segment) {
        return new Response('Photo key is required', { status: 400 });
      }

      if (privateMediaIds.has(segment)) {
        return new Response('Photo not found', { status: 404 });
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
      const isProduction = isProductionHost(url.hostname);
      if (isProduction && width !== null && !url.searchParams.has('raw')) {
        const q = url.searchParams.get('q');
        const image = { width };
        if (q) { image.quality = parseInt(q, 10); }
        const accept = request.headers.get('accept') || '';
        if (/image\/avif/.test(accept)) { image.format = 'avif'; }
        else if (/image\/webp/.test(accept)) { image.format = 'webp'; }
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
      const isLocal = isLocalHost(url.hostname);
      const isPreview = isWorkersPreviewHost(url.hostname);

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

    if (url.pathname === '/api/access-requests') {
      return handlePublicAccessRequest(request, env, executionCtx);
    }

    if (url.pathname === '/api/private/access-requests') {
      return handleListAccessRequests(request, env);
    }

    if (url.pathname.startsWith('/api/private/access-requests/')) {
      const requestId = decodeURIComponent(url.pathname.slice('/api/private/access-requests/'.length));
      return handleDismissAccessRequest(request, env, requestId);
    }

    if (
      url.pathname === '/api/private/guests' ||
      url.pathname.startsWith('/api/private/guests/')
    ) {
      return handleGuestsApi(request, env, url.pathname);
    }

    if (url.pathname.startsWith('/api/dev-auth/')) {
      return handleDevAuthApi(request, env, url.pathname);
    }

    if (
      url.pathname === '/api/game/high-scores' ||
      url.pathname === '/api/private/game/high-scores'
    ) {
      return handleGameHighScores(request, env);
    }

    if (url.pathname === '/api/private/game/runs/start') {
      return handleGameRunStart(request, env);
    }

    if (
      url.pathname.startsWith('/api/private/game/runs/') &&
      url.pathname.endsWith('/finish')
    ) {
      return handleGameRunFinish(request, env, url.pathname);
    }

    switch (url.pathname) {
      case '/api/auth/status':
        return handleAuthStatus(request, env);

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
