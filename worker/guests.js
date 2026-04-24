import {
  normalizeAuthenticatedEmail,
  requireAdmin,
  requireAuthenticatedEmail,
} from './auth.js';
import { requireGuestsDb } from './db.js';
import {
  parseJsonBody,
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
  'id, name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, created_at, updated_at, updated_by';

const formatGuest = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  rsvp: row.rsvp,
  additionalGuests: row.additional_guests,
  dietaryRequirements: row.dietary_requirements,
  rsvpMessage: row.rsvp_message,
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
