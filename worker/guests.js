import { HTTP_STATUS } from './constants.js';
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
import { jsonResponse } from './response.js';

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

const handleGuestsCollection = async (request, env, adminEmail) => {
  if (request.method === 'GET') {
    const results = await env.GUESTS_DB
      .prepare(
        `SELECT id, name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, created_at, updated_at, updated_by
         FROM guests
         ORDER BY name COLLATE NOCASE ASC`
      )
      .all();

    return jsonResponse({ guests: (results.results || []).map(formatGuest) });
  }

  if (request.method === 'POST') {
    const body = await parseJsonBody(request);

    if (!body) {
      return jsonResponse(
        { error: 'Invalid JSON body' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const validated = validateGuestPayload(body);

    if (validated.error) {
      return jsonResponse(
        { error: validated.error },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const input = validated.value;

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
      return jsonResponse(
        { error: 'Unable to create guest' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }

    const guestId = insert.meta.last_row_id;

    const row = await env.GUESTS_DB
      .prepare(
        `SELECT id, name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, created_at, updated_at, updated_by
         FROM guests
         WHERE id = ?`
      )
      .bind(guestId)
      .first();

    return jsonResponse({ guest: formatGuest(row) }, { status: 201 });
  }

  return jsonResponse(
    { error: 'Method Not Allowed' },
    { status: HTTP_STATUS.METHOD_NOT_ALLOWED }
  );
};

const handleGuestById = async (request, env, adminEmail, guestId) => {
  if (!Number.isInteger(guestId) || guestId < 1) {
    return jsonResponse(
      { error: 'Invalid guest id' },
      { status: HTTP_STATUS.BAD_REQUEST }
    );
  }

  if (request.method === 'GET') {
    const row = await env.GUESTS_DB
      .prepare(
        `SELECT id, name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, created_at, updated_at, updated_by
         FROM guests
         WHERE id = ?`
      )
      .bind(guestId)
      .first();

    if (!row) {
      return jsonResponse(
        { error: 'Guest not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    return jsonResponse({ guest: formatGuest(row) });
  }

  if (request.method === 'PUT') {
    const body = await parseJsonBody(request);

    if (!body) {
      return jsonResponse(
        { error: 'Invalid JSON body' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const validated = validateGuestPayload(body);

    if (validated.error) {
      return jsonResponse(
        { error: validated.error },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const input = validated.value;

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
      return jsonResponse(
        { error: 'Unable to update guest' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }

    if (!update.meta.changed_db) {
      return jsonResponse(
        { error: 'Guest not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    const row = await env.GUESTS_DB
      .prepare(
        `SELECT id, name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, created_at, updated_at, updated_by
         FROM guests
         WHERE id = ?`
      )
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
      return jsonResponse(
        { error: 'Unable to delete guest' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }

    if (!deleted.meta.changed_db) {
      return jsonResponse(
        { error: 'Guest not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    return jsonResponse({ ok: true });
  }

  return jsonResponse(
    { error: 'Method Not Allowed' },
    { status: HTTP_STATUS.METHOD_NOT_ALLOWED }
  );
};

const handleGuestSelf = async (request, env, authenticatedEmail) => {
  const email = normalizeAuthenticatedEmail(authenticatedEmail);

  if (request.method === 'GET' || request.method === 'PUT') {
    const existingGuest = await env.GUESTS_DB
      .prepare(
        `SELECT id, name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, created_at, updated_at, updated_by
         FROM guests
         WHERE LOWER(email) = ?`
      )
      .bind(email)
      .first();

    if (!existingGuest) {
      return jsonResponse(
        { error: 'Guest not found' },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    if (request.method === 'GET') {
      return jsonResponse({ guest: formatGuest(existingGuest) });
    }

    const body = await parseJsonBody(request);

    if (!body) {
      return jsonResponse(
        { error: 'Invalid JSON body' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const validated = validateGuestSelfPayload(body, existingGuest);

    if (validated.error) {
      return jsonResponse(
        { error: validated.error },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const input = validated.value;

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
      return jsonResponse(
        { error: 'Unable to update guest' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }

    const row = await env.GUESTS_DB
      .prepare(
        `SELECT id, name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, created_at, updated_at, updated_by
         FROM guests
         WHERE LOWER(email) = ?`
      )
      .bind(email)
      .first();

    return jsonResponse({ guest: formatGuest(row) });
  }

  return jsonResponse(
    { error: 'Method Not Allowed' },
    { status: HTTP_STATUS.METHOD_NOT_ALLOWED }
  );
};

export const handleGuestsApi = async (request, env, pathname) => {
  const authResult = requireAuthenticatedEmail(request);

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

  return jsonResponse(
    { error: 'Not Found' },
    { status: HTTP_STATUS.NOT_FOUND }
  );
};
