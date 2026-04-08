const jsonResponse = (payload, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
};

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const METHOD_NOT_ALLOWED = 405;
const INTERNAL_SERVER_ERROR = 500;

const RSVP_VALUES = new Set(['pending', 'yes', 'no']);

const getAuthenticatedEmail = (request) => request.headers.get('CF-Access-Authenticated-User-Email');

const parseAdminEmails = (env) => {
  const raw = env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
};

const requireAuthenticatedEmail = (request) => {
  const email = getAuthenticatedEmail(request);

  if (!email) {
    return { error: jsonResponse({ error: 'Unauthorized' }, { status: UNAUTHORIZED }) };
  }

  return { email };
};

const requireAdmin = (email, env) => {
  const admins = parseAdminEmails(env);

  if (!admins.has(email.toLowerCase())) {
    return jsonResponse({ error: 'Forbidden' }, { status: FORBIDDEN });
  }

  return null;
};

const requireGuestsDb = (env) => {
  if (env.GUESTS_DB) {
    return null;
  }

  return jsonResponse(
    {
      error: 'Guests database is not configured',
      hint: 'Add a D1 binding named GUESTS_DB in wrangler.toml and run migrations.',
    },
    { status: INTERNAL_SERVER_ERROR }
  );
};

const parseJsonBody = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const normalizeRsvp = (value) => {
  const rsvp = String(value ?? 'pending').trim().toLowerCase();
  return RSVP_VALUES.has(rsvp) ? rsvp : null;
};

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

const handlePrivateDetails = (request, env) => {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method Not Allowed' }, { status: METHOD_NOT_ALLOWED });
  }

  const authResult = requireAuthenticatedEmail(request);

  if (authResult.error) {
    return authResult.error;
  }

  return jsonResponse(
    {
      address: env.EVENT_ADDRESS || '62 West Wallaby Street, Wigan, Lancashire, WA11 4BY',
      gateCode: env.GATE_CODE || '1234',
      viewer: authResult.email,
    },
    {
      headers: {
        'cache-control': 'private, no-store',
      },
    }
  );
};

const validateGuestPayload = (payload) => {
  const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const rsvp = normalizeRsvp(payload?.rsvp);
  const additionalGuests = toInteger(payload?.additionalGuests, 0);
  const dietaryRequirements = typeof payload?.dietaryRequirements === 'string'
    ? payload.dietaryRequirements.trim()
    : '';
  const rsvpMessage = typeof payload?.rsvpMessage === 'string'
    ? payload.rsvpMessage.trim()
    : '';

  if (!name) {
    return { error: 'name is required' };
  }

  if (!email) {
    return { error: 'email is required' };
  }

  if (!rsvp) {
    return { error: 'rsvp must be one of: pending, yes, no' };
  }

  if (additionalGuests < 0) {
    return { error: 'additionalGuests must be 0 or greater' };
  }

  return {
    value: {
      name,
      email,
      rsvp,
      additionalGuests,
      dietaryRequirements,
      rsvpMessage,
    },
  };
};

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
      return jsonResponse({ error: 'Invalid JSON body' }, { status: BAD_REQUEST });
    }

    const validated = validateGuestPayload(body);

    if (validated.error) {
      return jsonResponse({ error: validated.error }, { status: BAD_REQUEST });
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
      return jsonResponse({ error: 'Unable to create guest' }, { status: INTERNAL_SERVER_ERROR });
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

  return jsonResponse({ error: 'Method Not Allowed' }, { status: METHOD_NOT_ALLOWED });
};

const handleGuestById = async (request, env, adminEmail, guestId) => {
  if (!Number.isInteger(guestId) || guestId < 1) {
    return jsonResponse({ error: 'Invalid guest id' }, { status: BAD_REQUEST });
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
      return jsonResponse({ error: 'Guest not found' }, { status: 404 });
    }

    return jsonResponse({ guest: formatGuest(row) });
  }

  if (request.method === 'PUT') {
    const body = await parseJsonBody(request);

    if (!body) {
      return jsonResponse({ error: 'Invalid JSON body' }, { status: BAD_REQUEST });
    }

    const validated = validateGuestPayload(body);

    if (validated.error) {
      return jsonResponse({ error: validated.error }, { status: BAD_REQUEST });
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
      return jsonResponse({ error: 'Unable to update guest' }, { status: INTERNAL_SERVER_ERROR });
    }

    if (!update.meta.changed_db) {
      return jsonResponse({ error: 'Guest not found' }, { status: 404 });
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
      return jsonResponse({ error: 'Unable to delete guest' }, { status: INTERNAL_SERVER_ERROR });
    }

    if (!deleted.meta.changed_db) {
      return jsonResponse({ error: 'Guest not found' }, { status: 404 });
    }

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Method Not Allowed' }, { status: METHOD_NOT_ALLOWED });
};

const handleGuestsApi = async (request, env, pathname) => {
  const authResult = requireAuthenticatedEmail(request);

  if (authResult.error) {
    return authResult.error;
  }

  const adminError = requireAdmin(authResult.email, env);

  if (adminError) {
    return adminError;
  }

  const dbError = requireGuestsDb(env);

  if (dbError) {
    return dbError;
  }

  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 3) {
    return handleGuestsCollection(request, env, authResult.email);
  }

  if (parts.length === 4) {
    return handleGuestById(request, env, authResult.email, Number.parseInt(parts[3], 10));
  }

  return jsonResponse({ error: 'Not Found' }, { status: 404 });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/private/details') {
      return handlePrivateDetails(request, env);
    }

    if (url.pathname === '/api/private/guests' || url.pathname.startsWith('/api/private/guests/')) {
      return handleGuestsApi(request, env, url.pathname);
    }

    return env.ASSETS.fetch(request);
  },
};
