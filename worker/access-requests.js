import { validateAccessRequestPayload, parseJsonBody } from './validation.js';
import { requireAuthenticatedEmail } from './auth.js';
import { requireAdmin } from './auth.js';
import { jsonResponse, badRequest, notFound, methodNotAllowed, internalError } from './response.js';
import { requireGuestsDb } from './db.js';
import { sendAccessRequestDiscordNotification } from './discord-access-request-notification.js';

const ACCESS_REQUEST_KEY_PREFIX = 'request:';
const ACCESS_REQUEST_TTL_SECONDS = 60 * 60 * 24 * 30;
const APPROVAL_LINK_TTL_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

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

const timingSafeEqual = (a, b) => {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    result |= aBytes[i] ^ bBytes[i];
  }

  return result === 0;
};

const toBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const getApprovalLinkSigningSecret = (env) => {
  const secret = env.ACCESS_REQUEST_APPROVAL_SECRET;
  return typeof secret === 'string' && secret.trim() ? secret.trim() : null;
};

const signApprovalLink = async (secret, requestId, expiresAt) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payload = `${requestId}.${expiresAt}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toBase64Url(signature);
};

const buildApprovalLink = async (env, origin, requestId) => {
  const secret = getApprovalLinkSigningSecret(env);
  if (!secret) {
    return null;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + APPROVAL_LINK_TTL_SECONDS;
  const sig = await signApprovalLink(secret, requestId, expiresAt);
  const approvalUrl = new URL('/api/private/access-requests/approve', origin);
  approvalUrl.searchParams.set('rid', requestId);
  approvalUrl.searchParams.set('exp', String(expiresAt));
  approvalUrl.searchParams.set('sig', sig);
  return approvalUrl.toString();
};

const redirectToAdminWithStatus = (requestUrl, status) => {
  const location = new URL('/admin.html', requestUrl.origin);
  location.searchParams.set('approval', status);

  return new Response(null, {
    status: 302,
    headers: {
      location: location.toString(),
      'cache-control': 'no-store',
    },
  });
};

const isDuplicateGuestEmailError = (error) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /unique constraint failed: guests\.email|\bUNIQUE\b/i.test(message);
};

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
  const notificationPromise = buildApprovalLink(env, origin, requestId)
    .then((approvalLink) =>
      sendAccessRequestDiscordNotification(env, requestEntry, origin, approvalLink)
    )
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

// GET /api/private/access-requests/approve?rid=<id>&exp=<unix>&sig=<hmac>
export const handleApproveAccessRequest = async (request, env) => {
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }

  const kvError = requireKv(env);
  if (kvError) return kvError;

  const dbError = requireGuestsDb(env);
  if (dbError) return dbError;

  const requestUrl = new URL(request.url);
  const requestId = requestUrl.searchParams.get('rid') || '';
  const expiresAtRaw = requestUrl.searchParams.get('exp') || '';
  const providedSig = requestUrl.searchParams.get('sig') || '';

  if (!requestId || !expiresAtRaw || !providedSig) {
    return redirectToAdminWithStatus(requestUrl, 'invalid-link');
  }

  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0 || expiresAt < Math.floor(Date.now() / 1000)) {
    return redirectToAdminWithStatus(requestUrl, 'expired-link');
  }

  const secret = getApprovalLinkSigningSecret(env);
  if (!secret) {
    return redirectToAdminWithStatus(requestUrl, 'approval-secret-missing');
  }

  const expectedSig = await signApprovalLink(secret, requestId, expiresAt);
  if (!timingSafeEqual(expectedSig, providedSig)) {
    return redirectToAdminWithStatus(requestUrl, 'invalid-link');
  }

  const key = makeAccessRequestKey(requestId);
  const existing = await env.GUEST_REQUESTS_KV.get(key);
  if (!existing) {
    return redirectToAdminWithStatus(requestUrl, 'request-not-found');
  }

  let parsed;
  try {
    parsed = JSON.parse(existing);
  } catch {
    return redirectToAdminWithStatus(requestUrl, 'request-invalid');
  }

  if (!parsed?.name || !parsed?.email) {
    return redirectToAdminWithStatus(requestUrl, 'request-invalid');
  }

  const guestId = crypto.randomUUID();
  try {
    const insert = await env.GUESTS_DB
      .prepare(
        `INSERT INTO guests (guest_id, name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        guestId,
        parsed.name,
        parsed.email,
        'pending',
        0,
        '',
        '',
        'discord-approval-link'
      )
      .run();

    if (!insert.success) {
      return redirectToAdminWithStatus(requestUrl, 'create-failed');
    }

    await env.GUEST_REQUESTS_KV.delete(key);
    return redirectToAdminWithStatus(requestUrl, 'created');
  } catch (error) {
    if (isDuplicateGuestEmailError(error)) {
      await env.GUEST_REQUESTS_KV.delete(key).catch(() => {});
      return redirectToAdminWithStatus(requestUrl, 'already-exists');
    }

    return redirectToAdminWithStatus(requestUrl, 'create-failed');
  }
};
