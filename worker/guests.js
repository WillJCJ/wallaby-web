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
  conflict,
  notFound,
  methodNotAllowed,
  internalError,
} from './response.js';

const GUEST_COLUMNS =
  `guest_id, name, email, rsvp, additional_guests, dietary_requirements, rsvp_message,
   access_enabled, invited_at, last_synced_at, sync_status, sync_error,
   created_at, updated_at, updated_by`;

const formatGuest = (row) => ({
  id: row.guest_id,
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

const isDuplicateEmailError = (error) => {
  const message = (error?.message || error?.cause?.message || '').toLowerCase();
  return message.includes('unique constraint failed') && message.includes('guests.email');
};

const isDuplicateEmailInsertFailure = (result) => {
  const message = String(result?.error || result?.message || '').toLowerCase();
  return message.includes('unique constraint failed') && message.includes('guests.email');
};

const isValidUuid = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const recordLastSeen = async (guestId, env) => {
  if (!env.GUEST_LAST_SEEN_KV) {return;}
  try {
    await env.GUEST_LAST_SEEN_KV.put(
      guestId,
      JSON.stringify({ lastSeen: new Date().toISOString() }),
      { expirationTtl: 2592000 } // 30 days
    );
  } catch (error) {
    // Silent fail - logging to activity tracker is best-effort
    console.error('Failed to record last_seen:', error);
  }
};

const loadGuestById = async (env, guestId) => env.GUESTS_DB
  .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE guest_id = ?`)
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
  if (!isValidUuid(guestId)) {
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
       WHERE guest_id = ?`
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

// eslint-disable-next-line complexity -- Sync status aggregates DB and Access drift state in one response contract.
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
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests ORDER BY created_at DESC`)
      .all();

    return jsonResponse({ guests: (results.results || []).map(formatGuest) });
  }

  if (request.method === 'POST') {
    const { errorResponse, input } = await parseAndValidate(request, validateGuestPayload);
    if (errorResponse) {return errorResponse;}

    const guestId = crypto.randomUUID();
    let insert;
    try {
      insert = await env.GUESTS_DB
        .prepare(
          `INSERT INTO guests (guest_id, name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          guestId,
          input.name,
          input.email,
          input.rsvp,
          input.additionalGuests,
          input.dietaryRequirements,
          input.rsvpMessage,
          adminEmail
        )
        .run();
    } catch (error) {
      if (isDuplicateEmailError(error)) {
        return conflict('A guest with this email already exists');
      }
      return internalError('Unable to create guest');
    }

    if (!insert.success) {
      if (isDuplicateEmailInsertFailure(insert)) {
        return conflict('A guest with this email already exists');
      }
      return internalError('Unable to create guest');
    }

    const row = await env.GUESTS_DB
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE guest_id = ?`)
      .bind(guestId)
      .first();

    return jsonResponse({ guest: formatGuest(row) }, { status: 201 });
  }

  return methodNotAllowed();
};

const runDeleteByGuestId = async (env, sql, guestId) => {
  const result = await env.GUESTS_DB
    .prepare(sql)
    .bind(guestId)
    .run();

  if (!result.success) {
    throw new Error('delete_failed');
  }

  return result;
};

const deleteGuestWithRelatedRows = async (env, guestId) => {
  // Remove child records first to satisfy guest foreign key constraints.
  await runDeleteByGuestId(env, 'DELETE FROM game_scores WHERE guest_id = ?', guestId);
  await runDeleteByGuestId(env, 'DELETE FROM game_runs WHERE guest_id = ?', guestId);
  return runDeleteByGuestId(env, 'DELETE FROM guests WHERE guest_id = ?', guestId);
};

// eslint-disable-next-line complexity -- Guest-by-ID handler covers GET/PUT/DELETE methods with auth and validation checks per method.
const handleGuestById = async (request, env, adminEmail, guestId) => {
  if (!isValidUuid(guestId)) {
    return badRequest('Invalid guest id');
  }

  if (request.method === 'GET') {
    const row = await env.GUESTS_DB
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE guest_id = ?`)
      .bind(guestId)
      .first();

    if (!row) {
      return notFound('Guest not found');
    }

    return jsonResponse({ guest: formatGuest(row) });
  }

  if (request.method === 'PUT') {
    const { errorResponse, input } = await parseAndValidate(request, validateGuestPayload);
    if (errorResponse) {return errorResponse;}

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
         WHERE guest_id = ?`
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
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE guest_id = ?`)
      .bind(guestId)
      .first();

    return jsonResponse({ guest: formatGuest(row) });
  }

  if (request.method === 'DELETE') {
    let deleted;
    try {
      deleted = await deleteGuestWithRelatedRows(env, guestId);
    } catch {
      return internalError('Unable to delete guest');
    }

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
    if (errorResponse) {return errorResponse;}

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

const handleRecordVisit = async (request, env, authenticatedEmail) => {
  if (request.method !== 'POST') {
    return methodNotAllowed();
  }

  const email = normalizeAuthenticatedEmail(authenticatedEmail);
  const guest = await env.GUESTS_DB
    .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE LOWER(email) = ?`)
    .bind(email)
    .first();

  if (!guest) {
    return notFound('Guest not found');
  }

  await recordLastSeen(guest.guest_id, env);
  return jsonResponse({ success: true });
};

const handleGetLastSeen = async (request, env, guestId) => {
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }

  if (!isValidUuid(guestId)) {
    return badRequest('Invalid guest id');
  }

  if (!env.GUEST_LAST_SEEN_KV) {
    return jsonResponse({ lastSeen: null });
  }

  try {
    const data = await env.GUEST_LAST_SEEN_KV.get(guestId);
    if (data) {
      const parsed = JSON.parse(data);
      return jsonResponse({ lastSeen: parsed.lastSeen });
    }
  } catch {
    // Silently handle parse errors
  }

  return jsonResponse({ lastSeen: null });
};

const handleSendInvitation = async (request, env, guestId) => {
  if (request.method !== 'POST') {
    return methodNotAllowed();
  }

  if (!isValidUuid(guestId)) {
    return badRequest('Invalid guest id');
  }

  const guest = await loadGuestById(env, guestId);
  if (!guest) {
    return notFound('Guest not found');
  }

  // TODO: Integrate email service to send Cloudflare Access login link
  // For now, just return success
  return jsonResponse({ success: true, message: 'Invitation queued' });
};

// eslint-disable-next-line complexity -- Router-style path dispatch is intentionally centralised for guests API.
export const handleGuestsApi = async (request, env, pathname) => {
  const authResult = await requireAuthenticatedEmail(request, env);

  if (authResult.error) {
    return authResult.error;
  }

  const dbError = requireGuestsDb(env);

  if (dbError) {
    return dbError;
  }

  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 4 && parts[3] === 'record-visit') {
    return handleRecordVisit(request, env, authResult.email);
  }

  if (parts.length === 4 && parts[3] === 'sync') {
    return handleGuestsSync(request, env);
  }

  if (parts.length === 4 && parts[3] === 'sync-status') {
    return handleGuestsSyncStatus(request, env);
  }

  if (parts.length === 6 && parts[4] === 'access' && parts[5] === 'enable') {
    return handleGuestAccessToggle(request, env, authResult.email, parts[3], true);
  }

  if (parts.length === 6 && parts[4] === 'access' && parts[5] === 'disable') {
    return handleGuestAccessToggle(request, env, authResult.email, parts[3], false);
  }

  if (parts.length === 5 && parts[4] === 'last-seen') {
    const adminError = requireAdmin(authResult.email, env);
    if (adminError) {return adminError;}
    return handleGetLastSeen(request, env, parts[3]);
  }

  if (parts.length === 5 && parts[4] === 'send-invitation') {
    const adminError = requireAdmin(authResult.email, env);
    if (adminError) {return adminError;}
    return handleSendInvitation(request, env, parts[3]);
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
      parts[3]
    );
  }

  return notFound();
};
