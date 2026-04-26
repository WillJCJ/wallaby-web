import { describe, it, expect, vi } from 'vitest';
import { handleGuestsApi } from '../guests.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeRequest = (method, body = null, email = 'admin@example.com') => {
  const headers = {};
  if (email) headers['CF-Access-Authenticated-User-Email'] = email;

  return new Request('http://example.com/api/private/guests', {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body), headers: { ...headers, 'content-type': 'application/json' } } : {}),
  });
};

const exampleRow = {
  guest_id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Jane Doe',
  email: 'jane@example.com',
  rsvp: 'yes',
  additional_guests: 1,
  dietary_requirements: 'vegan',
  rsvp_message: 'Looking forward to it!',
  access_enabled: 0,
  invited_at: null,
  last_synced_at: null,
  sync_status: 'never',
  sync_error: '',
  created_at: '2024-01-01T10:00:00Z',
  updated_at: '2024-01-01T10:00:00Z',
  updated_by: 'admin@example.com',
};

const makeDb = (overrides = {}) => {
  const stub = vi.fn();
  const prepared = {
    all: vi.fn().mockResolvedValue({ results: [exampleRow] }),
    run: vi.fn().mockResolvedValue({ success: true, meta: { changed_db: true } }),
    first: vi.fn().mockResolvedValue(exampleRow),
    bind: vi.fn(),
  };
  prepared.bind.mockReturnValue(prepared);
  stub.mockReturnValue(prepared);

  return {
    _prepared: prepared,
    prepare: stub,
    ...overrides,
  };
};

const makeEnv = (dbOverrides = {}, adminEmail = 'admin@example.com') => ({
  ADMIN_EMAILS: adminEmail,
  GUESTS_DB: makeDb(dbOverrides),
});

// ---------------------------------------------------------------------------
// Auth / DB guard
// ---------------------------------------------------------------------------

describe('handleGuestsApi auth and DB guards', () => {
  it('returns 401 when no auth header is present', async () => {
    const req = makeRequest('GET', null, null);
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests');
    expect(res.status).toBe(401);
  });

  it('returns 500 when GUESTS_DB is not configured', async () => {
    const req = makeRequest('GET');
    const res = await handleGuestsApi(req, { ADMIN_EMAILS: 'admin@example.com' }, '/api/private/guests');
    expect(res.status).toBe(500);
  });

  it('returns 403 when the user is not an admin (and not /me route)', async () => {
    const req = makeRequest('GET', null, 'notadmin@example.com');
    const res = await handleGuestsApi(req, makeEnv({}, 'admin@example.com'), '/api/private/guests');
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/private/guests  (collection)
// ---------------------------------------------------------------------------

describe('handleGuestsApi GET /api/private/guests', () => {
  it('returns a list of guests', async () => {
    const req = makeRequest('GET');
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.guests)).toBe(true);
    expect(body.guests[0].name).toBe('Jane Doe');
    expect(body.guests[0].accessEnabled).toBe(false);
    expect(body.guests[0].syncStatus).toBe('never');
  });
});

// ---------------------------------------------------------------------------
// POST /api/private/guests  (create)
// ---------------------------------------------------------------------------

describe('handleGuestsApi POST /api/private/guests', () => {
  it('creates a guest and returns 201', async () => {
    const newGuest = {
      name: 'John Smith',
      email: 'john@example.com',
      rsvp: 'pending',
      additionalGuests: 0,
    };
    const req = makeRequest('POST', newGuest);
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests');
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.guest.name).toBe('Jane Doe'); // returned from the mocked DB row
  });

  it('returns 400 for an invalid JSON body', async () => {
    const req = new Request('http://example.com/api/private/guests', {
      method: 'POST',
      headers: {
        'CF-Access-Authenticated-User-Email': 'admin@example.com',
        'content-type': 'application/json',
      },
      body: 'not json',
    });
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests');
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    const req = makeRequest('POST', { email: 'john@example.com', rsvp: 'yes' });
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('name is required');
  });

  it('returns 405 for an unsupported method on the collection', async () => {
    const req = makeRequest('PATCH');
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests');
    expect(res.status).toBe(405);
  });

  it('returns 409 when email already exists', async () => {
    const db = makeDb();
    db._prepared.run.mockRejectedValue(new Error('D1_ERROR: UNIQUE constraint failed: guests.email'));

    const req = makeRequest('POST', {
      name: 'John Smith',
      email: 'john@example.com',
      rsvp: 'pending',
      additionalGuests: 0,
    });

    const res = await handleGuestsApi(req, { ADMIN_EMAILS: 'admin@example.com', GUESTS_DB: db }, '/api/private/guests');
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  it('returns 409 when insert returns success false for duplicate email', async () => {
    const db = makeDb();
    db._prepared.run.mockResolvedValue({
      success: false,
      error: 'D1_ERROR: UNIQUE constraint failed: guests.email',
      meta: {},
    });

    const req = makeRequest('POST', {
      name: 'John Smith',
      email: 'john@example.com',
      rsvp: 'pending',
      additionalGuests: 0,
    });

    const res = await handleGuestsApi(req, { ADMIN_EMAILS: 'admin@example.com', GUESTS_DB: db }, '/api/private/guests');
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });
});

// ---------------------------------------------------------------------------
// GET /api/private/guests/:id
// ---------------------------------------------------------------------------

describe('handleGuestsApi GET /api/private/guests/:id', () => {
  it('returns a single guest', async () => {
    const req = makeRequest('GET');
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests/550e8400-e29b-41d4-a716-446655440000');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.guest.id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns 404 when the guest does not exist', async () => {
    const db = makeDb();
    db._prepared.first.mockResolvedValue(null);
    const uuid = '550e8400-e29b-41d4-a716-446655440099';
    const req = makeRequest('GET');
    const res = await handleGuestsApi(req, { ADMIN_EMAILS: 'admin@example.com', GUESTS_DB: db }, `/api/private/guests/${uuid}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-UUID guest id', async () => {
    const req = makeRequest('GET');
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests/abc');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/private/guests/:id
// ---------------------------------------------------------------------------

describe('handleGuestsApi PUT /api/private/guests/:id', () => {
  const updatedGuest = {
    name: 'Jane Updated',
    email: 'jane@example.com',
    rsvp: 'yes',
    additionalGuests: 2,
    dietaryRequirements: 'vegan',
    rsvpMessage: '',
  };

  it('updates a guest and returns the updated record', async () => {
    const req = makeRequest('PUT', updatedGuest);
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests/550e8400-e29b-41d4-a716-446655440000');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.guest).toBeTruthy();
  });

  it('returns 404 when no row was changed', async () => {
    const db = makeDb();
    db._prepared.run.mockResolvedValue({ success: true, meta: { changed_db: false } });
    const uuid = '550e8400-e29b-41d4-a716-446655440099';
    const req = makeRequest('PUT', updatedGuest);
    const res = await handleGuestsApi(req, { ADMIN_EMAILS: 'admin@example.com', GUESTS_DB: db }, `/api/private/guests/${uuid}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid payload', async () => {
    const req = makeRequest('PUT', { email: 'jane@example.com' }); // missing name
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests/550e8400-e29b-41d4-a716-446655440000');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/private/guests/:id
// ---------------------------------------------------------------------------

describe('handleGuestsApi DELETE /api/private/guests/:id', () => {
  it('deletes a guest and returns ok: true', async () => {
    const req = makeRequest('DELETE');
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests/550e8400-e29b-41d4-a716-446655440000');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('returns 404 when no row was deleted', async () => {
    const db = makeDb();
    db._prepared.run.mockResolvedValue({ success: true, meta: { changed_db: false } });
    const uuid = '550e8400-e29b-41d4-a716-446655440099';
    const req = makeRequest('DELETE');
    const res = await handleGuestsApi(req, { ADMIN_EMAILS: 'admin@example.com', GUESTS_DB: db }, `/api/private/guests/${uuid}`);
    expect(res.status).toBe(404);
  });

  it('returns 405 for an unsupported method on a guest id route', async () => {
    const req = makeRequest('PATCH');
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests/550e8400-e29b-41d4-a716-446655440000');
    expect(res.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// GET /api/private/guests/me  (self route)
// ---------------------------------------------------------------------------

describe('handleGuestsApi GET /api/private/guests/me', () => {
  it('returns the guest record matching the authenticated user email', async () => {
    const req = makeRequest('GET', null, 'jane@example.com');
    const res = await handleGuestsApi(req, makeEnv({}, 'admin@example.com'), '/api/private/guests/me');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.guest.email).toBe('jane@example.com');
  });

  it('returns 404 when no guest matches the authenticated email', async () => {
    const db = makeDb();
    db._prepared.first.mockResolvedValue(null);
    const req = makeRequest('GET', null, 'nobody@example.com');
    const res = await handleGuestsApi(
      req,
      { ADMIN_EMAILS: 'admin@example.com', GUESTS_DB: db },
      '/api/private/guests/me'
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/private/guests/me  (self-update route)
// ---------------------------------------------------------------------------

describe('handleGuestsApi PUT /api/private/guests/me', () => {
  it('updates the guest record and returns the updated row', async () => {
    const req = makeRequest('PUT', { rsvp: 'yes' }, 'jane@example.com');
    const db = makeEnv({}, 'admin@example.com');
    const res = await handleGuestsApi(req, db, '/api/private/guests/me');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.guest).toBeTruthy();
  });

  it('returns 405 for unsupported methods on /me', async () => {
    const req = makeRequest('DELETE', null, 'jane@example.com');
    const res = await handleGuestsApi(req, makeEnv({}, 'admin@example.com'), '/api/private/guests/me');
    expect(res.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// Unknown route
// ---------------------------------------------------------------------------

describe('handleGuestsApi unknown route', () => {
  it('returns 404 for a deeply nested unknown path', async () => {
    const req = makeRequest('GET');
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const res = await handleGuestsApi(req, makeEnv(), `/api/private/guests/${uuid}/extra/stuff`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/private/guests/:id/access/enable|disable
// ---------------------------------------------------------------------------

describe('handleGuestsApi access toggle routes', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';

  it('enables access and returns failed sync when Cloudflare config is missing', async () => {
    const req = makeRequest('POST');
    const res = await handleGuestsApi(req, makeEnv(), `/api/private/guests/${uuid}/access/enable`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.sync.status).toBe('failed');
  });

  it('disables access and returns failed sync when Cloudflare config is missing', async () => {
    const req = makeRequest('POST');
    const res = await handleGuestsApi(req, makeEnv(), `/api/private/guests/${uuid}/access/disable`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.sync.status).toBe('failed');
  });

  it('returns 405 for non-POST toggle requests', async () => {
    const req = makeRequest('GET');
    const res = await handleGuestsApi(req, makeEnv(), `/api/private/guests/${uuid}/access/enable`);
    expect(res.status).toBe(405);
  });

  it('returns 400 for non-UUID guest id on toggle routes', async () => {
    const req = makeRequest('POST');
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests/abc/access/enable');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/private/guests/sync
// ---------------------------------------------------------------------------

describe('handleGuestsApi sync route', () => {
  it('supports dry-run mode', async () => {
    const req = makeRequest('POST', { mode: 'dry-run' });
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests/sync');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.dryRun).toBe(true);
    expect(Array.isArray(body.desiredEmails)).toBe(true);
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBe(1);
  });

  it('returns sync errors in full mode when Cloudflare config is missing', async () => {
    const req = makeRequest('POST', { mode: 'full' });
    const res = await handleGuestsApi(req, makeEnv(), '/api/private/guests/sync');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/private/guests/sync-status
// ---------------------------------------------------------------------------

describe('handleGuestsApi sync-status route', () => {
  it('returns aggregate sync status summary', async () => {
    const statusDb = {
      prepare: vi.fn((sql) => {
        if (sql.includes('GROUP BY sync_status')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { sync_status: 'in_sync', count: 2 },
                { sync_status: 'failed', count: 1 },
                { sync_status: 'pending', count: 1 },
              ],
            }),
          };
        }

        if (sql.includes('WHERE access_enabled = 1')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [{ email: 'jane@example.com' }, { email: 'friend@example.com' }],
            }),
          };
        }

        if (sql.includes('MAX(last_synced_at)')) {
          return {
            first: vi.fn().mockResolvedValue({ last_synced_at: '2024-01-01T12:00:00Z' }),
          };
        }

        return {
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
      }),
    };

    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      result: {
        id: 'policy-id',
        include: [{ email: { email: 'jane@example.com' } }],
      },
    }), { status: 200 })));

    const req = makeRequest('GET');
    try {
      const res = await handleGuestsApi(
        req,
        {
          ADMIN_EMAILS: 'admin@example.com',
          GUESTS_DB: statusDb,
          CF_ACCOUNT_ID: 'acc',
          CF_ACCESS_API_TOKEN: 'token',
          CF_ACCESS_POLICY_ID: 'policy',
        },
        '/api/private/guests/sync-status'
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.summary.inSync).toBe(2);
      expect(body.summary.failed).toBe(1);
      expect(body.summary.pending).toBe(1);
      expect(body.summary.drift).toBe(true);
      expect(body.summary.lastSyncAt).toBe('2024-01-01T12:00:00Z');
      expect(Array.isArray(body.summary.desiredEmails)).toBe(true);
      expect(Array.isArray(body.summary.policyEmails)).toBe(true);
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }
  });
});
