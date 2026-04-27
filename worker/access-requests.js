import { validateAccessRequestPayload, parseJsonBody } from './validation.js';
import { requireAuthenticatedEmail } from './auth.js';
import { requireAdmin } from './auth.js';
import { jsonResponse, badRequest, notFound, methodNotAllowed, internalError } from './response.js';
import { sendAccessRequestDiscordNotification } from './discord-access-request-notification.js';

const ACCESS_REQUEST_KEY_PREFIX = 'request:';
const ACCESS_REQUEST_TTL_SECONDS = 60 * 60 * 24 * 30;

const requireKv = (env) => {
  if (!env.GUEST_REQUESTS_KV) {
    return internalError('Guest requests store is not configured');
  }
  return null;
};

const verifyTurnstile = async (token, env) => {
  // Skip verification when the secret is absent (local dev).
  if (!env.TURNSTILE_SECRET_KEY) {
    return true;
  }

  if (!token || typeof token !== 'string') {
    return false;
  }

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });

    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
};

const makeAccessRequestKey = (requestId) => `${ACCESS_REQUEST_KEY_PREFIX}${requestId}`;

// POST /api/access-requests — public, unauthenticated
export const handlePublicAccessRequest = async (request, env, executionCtx) => {
  if (request.method !== 'POST') {
    return methodNotAllowed();
  }

  const kvError = requireKv(env);
  if (kvError) return kvError;

  const body = await parseJsonBody(request);
  if (!body) {
    return badRequest('Invalid JSON body');
  }

  const validated = validateAccessRequestPayload(body);
  if (validated.error) {
    return badRequest(validated.error);
  }

  const turnstileOk = await verifyTurnstile(body.turnstileToken, env);
  if (!turnstileOk) {
    return badRequest('Security check failed. Please try again.');
  }

  const { name, email } = validated.value;
  const requestId = crypto.randomUUID();
  const key = makeAccessRequestKey(requestId);
  const requestEntry = {
    requestId,
    name,
    email,
    requestedAt: new Date().toISOString(),
  };
  const payload = JSON.stringify(requestEntry);

  try {
    await env.GUEST_REQUESTS_KV.put(key, payload, { expirationTtl: ACCESS_REQUEST_TTL_SECONDS });
  } catch {
    return internalError('Unable to save request');
  }

  // Keep the notification alive after returning the response, and log failures
  // so preview/production issues are visible in Worker logs.
  const origin = new URL(request.url).origin;
  const notificationPromise = sendAccessRequestDiscordNotification(env, requestEntry, origin)
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Discord notification failed', {
        message,
        hasWebhookUrl: Boolean(env.DISCORD_WEBHOOK_URL),
      });
    });

  if (executionCtx && typeof executionCtx.waitUntil === 'function') {
    executionCtx.waitUntil(notificationPromise);
  }

  // Always return the same response regardless of whether the email was
  // already present in KV or D1 — do not enumerate existing accounts.
  return jsonResponse({ ok: true }, { status: 200 });
};

// GET /api/private/access-requests — admin only
export const handleListAccessRequests = async (request, env) => {
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }

  const authResult = await requireAuthenticatedEmail(request, env);
  if (authResult.error) return authResult.error;

  const adminError = requireAdmin(authResult.email, env);
  if (adminError) return adminError;

  const kvError = requireKv(env);
  if (kvError) return kvError;

  let keys;
  try {
    const list = await env.GUEST_REQUESTS_KV.list();
    keys = list.keys || [];
  } catch {
    return internalError('Unable to list requests');
  }

  const requests = [];
  for (const key of keys) {
    try {
      const raw = await env.GUEST_REQUESTS_KV.get(key.name);
      if (raw) {
        const parsed = JSON.parse(raw);
        requests.push({
          ...parsed,
          requestId: parsed.requestId || (key.name.startsWith(ACCESS_REQUEST_KEY_PREFIX)
            ? key.name.slice(ACCESS_REQUEST_KEY_PREFIX.length)
            : null),
        });
      }
    } catch {
      // Skip malformed entries
    }
  }

  requests.sort((a, b) => {
    const ta = a.requestedAt || '';
    const tb = b.requestedAt || '';
    return tb.localeCompare(ta);
  });

  return jsonResponse({ requests });
};

// DELETE /api/private/access-requests/:requestId — admin only
export const handleDismissAccessRequest = async (request, env, requestId) => {
  if (request.method !== 'DELETE') {
    return methodNotAllowed();
  }

  const authResult = await requireAuthenticatedEmail(request, env);
  if (authResult.error) return authResult.error;

  const adminError = requireAdmin(authResult.email, env);
  if (adminError) return adminError;

  const kvError = requireKv(env);
  if (kvError) return kvError;

  const key = makeAccessRequestKey(requestId);
  const existing = await env.GUEST_REQUESTS_KV.get(key);
  if (!existing) {
    return notFound('Request not found');
  }

  try {
    await env.GUEST_REQUESTS_KV.delete(key);
  } catch {
    return internalError('Unable to dismiss request');
  }

  return jsonResponse({ ok: true });
};

