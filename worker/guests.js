import {
  normalizeAuthenticatedEmail,
  requireAdmin,
  requireAuthenticatedEmail,
} from './auth.js';
import { requireGuestsDb } from './db.js';
import {
  getAccessPolicyEmailDrift,
  listDesiredAccessEmails,
  syncAccessPolicyFromGuests,
} from './access-policy-sync.js';
import {
  parseJsonBody,
  validateGuestsSyncPayload,
  validateGuestPayload,
  validateGuestSelfPayload,
} from './validation.js';
import {
  jsonResponse,
  badRequest,
  notFound,
  methodNotAllowed,
  internalError,
} from './response.js';

const GUEST_COLUMNS =
  `id, name, email, rsvp, additional_guests, dietary_requirements, rsvp_message,
   access_enabled, invited_at, last_synced_at, sync_status, sync_error,
   created_at, updated_at, updated_by`;

const formatGuest = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  rsvp: row.rsvp,
  additionalGuests: row.additional_guests,
  dietaryRequirements: row.dietary_requirements,
  rsvpMessage: row.rsvp_message,
  accessEnabled: row.access_enabled === 1,
  invitedAt: row.invited_at,
  lastSyncedAt: row.last_synced_at,
  syncStatus: row.sync_status,
  syncError: row.sync_error,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

const parseAndValidate = async (request, validator, validatorArg) => {
  const body = await parseJsonBody(request);
  if (!body) {
    return { errorResponse: badRequest('Invalid JSON body') };
  }
  const validated = validator(body, validatorArg);
  if (validated.error) {
    return { errorResponse: badRequest(validated.error) };
  }
  return { input: validated.value };
};

const loadGuestById = async (env, guestId) => env.GUESTS_DB
  .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE id = ?`)
  .bind(guestId)
  .first();

const markGuestsSyncFailed = async (env, message) => {
  await env.GUESTS_DB
    .prepare(
      `UPDATE guests
       SET sync_status = 'failed',
           sync_error = ?,
           updated_at = datetime('now')
       WHERE sync_status IN ('pending', 'never', 'in_sync', 'drift', 'failed')`
    )
    .bind(message)
    .run();
};

const markGuestsSyncSuccess = async (env) => {
  await env.GUESTS_DB
    .prepare(
      `UPDATE guests
       SET sync_status = 'in_sync',
           sync_error = '',
           last_synced_at = datetime('now'),
           updated_at = datetime('now')`
    )
    .run();
};

const runPolicySync = async (env) => {
  const syncResult = await syncAccessPolicyFromGuests(env);
  if (syncResult.error) {
    await markGuestsSyncFailed(env, syncResult.error.message);
    return {
      ok: false,
      status: 'failed',
      message: syncResult.error.message,
      retryable: Boolean(syncResult.error.retryable),
    };
  }

  await markGuestsSyncSuccess(env);
  return {
    ok: true,
    status: 'in_sync',
    message: `Synced ${syncResult.value.desiredEmails.length} email${syncResult.value.desiredEmails.length === 1 ? '' : 's'}`,
    desiredEmails: syncResult.value.desiredEmails,
  };
};

const handleGuestAccessToggle = async (request, env, adminEmail, guestId, nextState) => {
  if (!Number.isInteger(guestId) || guestId < 1) {
    return badRequest('Invalid guest id');
  }

  if (request.method !== 'POST') {
    return methodNotAllowed();
  }

  const existing = await loadGuestById(env, guestId);
  if (!existing) {
    return notFound('Guest not found');
  }

  const update = await env.GUESTS_DB
    .prepare(
      `UPDATE guests
       SET access_enabled = ?,
           invited_at = CASE
             WHEN ? = 1 AND invited_at IS NULL THEN datetime('now')
             ELSE invited_at
           END,
           sync_status = 'pending',
           sync_error = '',
           updated_by = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(nextState ? 1 : 0, nextState ? 1 : 0, adminEmail, guestId)
    .run();

  if (!update.success) {
    return internalError('Unable to update guest access');
  }

  const sync = await runPolicySync(env);
  const guest = await loadGuestById(env, guestId);
  return jsonResponse({ ok: true, guest: formatGuest(guest), sync });
};

const handleGuestsSync = async (request, env) => {
  if (request.method !== 'POST') {
    return methodNotAllowed();
  }

  const rawBody = await request.text();
  let payload = null;
  if (rawBody.trim()) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return badRequest('Invalid JSON body');
    }
  }

  const validated = validateGuestsSyncPayload(payload);
  if (validated.error) {
    return badRequest(validated.error);
  }

  if (validated.value.mode === 'dry-run') {
    const driftResult = await getAccessPolicyEmailDrift(env);
    if (driftResult.error) {
      const desiredEmails = await listDesiredAccessEmails(env.GUESTS_DB);
      return jsonResponse({
        ok: false,
        dryRun: true,
        updated: 0,
        drift: false,
        errors: [driftResult.error.message],
        desiredEmails,
        policyEmails: [],
        missingFromPolicy: [],
        extraInPolicy: [],
      });
    }

    return jsonResponse({
      ok: true,
      dryRun: true,
      updated: 0,
      drift: driftResult.value.drift,
      errors: [],
      desiredEmails: driftResult.value.desiredEmails,
      policyEmails: driftResult.value.policyEmails,
      missingFromPolicy: driftResult.value.missingFromPolicy,
      extraInPolicy: driftResult.value.extraInPolicy,
    });
  }

  const sync = await runPolicySync(env);
  const driftResult = await getAccessPolicyEmailDrift(env);
  const drift = driftResult.value ? driftResult.value.drift : false;
  return jsonResponse({
    ok: sync.ok,
    updated: Array.isArray(sync.desiredEmails) ? sync.desiredEmails.length : 0,
    drift,
    errors: sync.ok ? [] : [sync.message],
  });
};

const handleGuestsSyncStatus = async (request, env) => {
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }

  const statusRows = await env.GUESTS_DB
    .prepare('SELECT sync_status, COUNT(*) AS count FROM guests GROUP BY sync_status')
    .all();
  const latestSync = await env.GUESTS_DB
    .prepare('SELECT MAX(last_synced_at) AS last_synced_at FROM guests')
    .first();

  const counts = { in_sync: 0, pending: 0, failed: 0, drift: 0 };
  for (const row of statusRows.results || []) {
    counts[row.sync_status] = row.count;
  }

  const driftResult = await getAccessPolicyEmailDrift(env);
  const drift = driftResult.value ? driftResult.value.drift : false;
  const driftError = driftResult.error ? driftResult.error.message : null;

  return jsonResponse({
    ok: true,
    summary: {
      inSync: counts.in_sync || 0,
      pending: counts.pending || 0,
      failed: counts.failed || 0,
      drift: drift || (counts.drift || 0) > 0,
      lastSyncAt: latestSync?.last_synced_at || null,
      desiredEmails: driftResult.value?.desiredEmails || [],
      policyEmails: driftResult.value?.policyEmails || [],
      driftError,
    },
  });
};

const handleGuestsCollection = async (request, env, adminEmail) => {
  if (request.method === 'GET') {
    const results = await env.GUESTS_DB
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests ORDER BY name COLLATE NOCASE ASC`)
      .all();

    return jsonResponse({ guests: (results.results || []).map(formatGuest) });
  }

  if (request.method === 'POST') {
    const { errorResponse, input } = await parseAndValidate(request, validateGuestPayload);
    if (errorResponse) return errorResponse;

    const insert = await env.GUESTS_DB
      .prepare(
        `INSERT INTO guests (name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        input.name,
        input.email,
        input.rsvp,
        input.additionalGuests,
        input.dietaryRequirements,
        input.rsvpMessage,
        adminEmail
      )
      .run();

    if (!insert.success) {
      return internalError('Unable to create guest');
    }

    const guestId = insert.meta.last_row_id;

    const row = await env.GUESTS_DB
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE id = ?`)
      .bind(guestId)
      .first();

    return jsonResponse({ guest: formatGuest(row) }, { status: 201 });
  }

  return methodNotAllowed();
};

const handleGuestById = async (request, env, adminEmail, guestId) => {
  if (!Number.isInteger(guestId) || guestId < 1) {
    return badRequest('Invalid guest id');
  }

  if (request.method === 'GET') {
    const row = await env.GUESTS_DB
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE id = ?`)
      .bind(guestId)
      .first();

    if (!row) {
      return notFound('Guest not found');
    }

    return jsonResponse({ guest: formatGuest(row) });
  }

  if (request.method === 'PUT') {
    const { errorResponse, input } = await parseAndValidate(request, validateGuestPayload);
    if (errorResponse) return errorResponse;

    const update = await env.GUESTS_DB
      .prepare(
        `UPDATE guests
         SET name = ?,
             email = ?,
             rsvp = ?,
             additional_guests = ?,
             dietary_requirements = ?,
             rsvp_message = ?,
             updated_by = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(
        input.name,
        input.email,
        input.rsvp,
        input.additionalGuests,
        input.dietaryRequirements,
        input.rsvpMessage,
        adminEmail,
        guestId
      )
      .run();

    if (!update.success) {
      return internalError('Unable to update guest');
    }

    if (!update.meta.changed_db) {
      return notFound('Guest not found');
    }

    const row = await env.GUESTS_DB
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE id = ?`)
      .bind(guestId)
      .first();

    return jsonResponse({ guest: formatGuest(row) });
  }

  if (request.method === 'DELETE') {
    const deleted = await env.GUESTS_DB
      .prepare('DELETE FROM guests WHERE id = ?')
      .bind(guestId)
      .run();

    if (!deleted.success) {
      return internalError('Unable to delete guest');
    }

    if (!deleted.meta.changed_db) {
      return notFound('Guest not found');
    }

    return jsonResponse({ ok: true });
  }

  return methodNotAllowed();
};

const handleGuestSelf = async (request, env, authenticatedEmail) => {
  const email = normalizeAuthenticatedEmail(authenticatedEmail);

  if (request.method === 'GET' || request.method === 'PUT') {
    const existingGuest = await env.GUESTS_DB
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE LOWER(email) = ?`)
      .bind(email)
      .first();

    if (!existingGuest) {
      return notFound('Guest not found');
    }

    if (request.method === 'GET') {
      return jsonResponse({ guest: formatGuest(existingGuest) });
    }

    const { errorResponse, input } = await parseAndValidate(request, validateGuestSelfPayload, existingGuest);
    if (errorResponse) return errorResponse;

    const update = await env.GUESTS_DB
      .prepare(
        `UPDATE guests
         SET rsvp = ?,
             additional_guests = ?,
             dietary_requirements = ?,
             rsvp_message = ?,
             updated_by = ?,
             updated_at = datetime('now')
         WHERE LOWER(email) = ?`
      )
      .bind(
        input.rsvp,
        input.additionalGuests,
        input.dietaryRequirements,
        input.rsvpMessage,
        email,
        email
      )
      .run();

    if (!update.success) {
      return internalError('Unable to update guest');
    }

    const row = await env.GUESTS_DB
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE LOWER(email) = ?`)
      .bind(email)
      .first();

    return jsonResponse({ guest: formatGuest(row) });
  }

  return methodNotAllowed();
};

export const handleGuestsApi = async (request, env, pathname) => {
  const authResult = requireAuthenticatedEmail(request, env);

  if (authResult.error) {
    return authResult.error;
  }

  const dbError = requireGuestsDb(env);

  if (dbError) {
    return dbError;
  }

  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 4 && parts[3] === 'sync') {
    return handleGuestsSync(request, env);
  }

  if (parts.length === 4 && parts[3] === 'sync-status') {
    return handleGuestsSyncStatus(request, env);
  }

  if (parts.length === 6 && parts[4] === 'access' && parts[5] === 'enable') {
    return handleGuestAccessToggle(request, env, authResult.email, Number.parseInt(parts[3], 10), true);
  }

  if (parts.length === 6 && parts[4] === 'access' && parts[5] === 'disable') {
    return handleGuestAccessToggle(request, env, authResult.email, Number.parseInt(parts[3], 10), false);
  }

  if (parts.length === 4 && parts[3] === 'me') {
    return handleGuestSelf(request, env, authResult.email);
  }

  const adminError = requireAdmin(authResult.email, env);

  if (adminError) {
    return adminError;
  }

  if (parts.length === 3) {
    return handleGuestsCollection(request, env, authResult.email);
  }

  if (parts.length === 4) {
    return handleGuestById(
      request,
      env,
      authResult.email,
      Number.parseInt(parts[3], 10)
    );
  }

  return notFound();
};
