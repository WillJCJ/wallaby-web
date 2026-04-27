import { validateAccessRequestPayload, parseJsonBody } from './validation.js';
import { requireAuthenticatedEmail } from './auth.js';
import { requireAdmin } from './auth.js';
import { jsonResponse, badRequest, notFound, methodNotAllowed, internalError } from './response.js';
import { isLocalHost, isProductionHost } from './host.js';

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

const sendAdminNotification = async (env, name, origin) => {
  if (!env.DISCORD_WEBHOOK_URL) return;

  const url = new URL(origin);
  const hostname = url.hostname;
  
  // Determine environment and colors
  let environment = 'production';
  let embedColor = 3447003; // Blue
  let environmentBadge = '';
  
  if (isLocalHost(hostname)) {
    environment = 'local';
    embedColor = 0x3498db; // Bright blue
    environmentBadge = ' 🔷 Local';
  } else if (!isProductionHost(hostname)) {
    environment = 'preview';
    embedColor = 0xf39c12; // Orange
    environmentBadge = ' ⚠️ Preview';
  }

  const fields = [];
  if (environmentBadge) {
    fields.push({
      name: 'Environment',
      value: environmentBadge.trim(),
      inline: true,
    });
  }

  const response = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `New access request from **${name}**${environmentBadge}`,
      embeds: [
        {
          title: 'Review Request',
          description: `Click the button below to review and approve/deny this request.`,
          url: `${origin}/admin.html`,
          color: embedColor,
          fields,
          footer: {
            text: `Wallaby Fest • ${environment}`,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const detail = body ? ` ${body.slice(0, 200)}` : '';
    throw new Error(`Discord webhook rejected notification (${response.status}).${detail}`);
  }
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
  const payload = JSON.stringify({ name, email, requestedAt: new Date().toISOString() });

  try {
    await env.GUEST_REQUESTS_KV.put(email, payload, { expirationTtl: 60 * 60 * 24 * 30 });
  } catch {
    return internalError('Unable to save request');
  }

  // Keep the notification alive after returning the response, and log failures
  // so preview/production issues are visible in Worker logs.
  const notificationPromise = sendAdminNotification(env, name, new URL(request.url).origin)
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

// GET /api/private/admin/access-requests — admin only
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
        requests.push(JSON.parse(raw));
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

// DELETE /api/private/admin/access-requests/:email — admin only
export const handleDismissAccessRequest = async (request, env, email) => {
  if (request.method !== 'DELETE') {
    return methodNotAllowed();
  }

  const authResult = await requireAuthenticatedEmail(request, env);
  if (authResult.error) return authResult.error;

  const adminError = requireAdmin(authResult.email, env);
  if (adminError) return adminError;

  const kvError = requireKv(env);
  if (kvError) return kvError;

  const existing = await env.GUEST_REQUESTS_KV.get(email);
  if (!existing) {
    return notFound('Request not found');
  }

  try {
    await env.GUEST_REQUESTS_KV.delete(email);
  } catch {
    return internalError('Unable to dismiss request');
  }

  return jsonResponse({ ok: true });
};
