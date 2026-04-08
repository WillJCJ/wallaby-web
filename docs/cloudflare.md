# Cloudflare Setup

This document covers Cloudflare Access, Worker secrets, and D1 setup for WallabyFest.

## Private Details Endpoint

The private endpoint is `/api/private/details` served by `worker.js`.
It only returns data when Cloudflare Access has authenticated the request.

### Worker Secrets

Set private values once per environment:

```bash
wrangler secret put EVENT_ADDRESS
wrangler secret put GATE_CODE
```

## Access Protection

Access policies are managed in the Cloudflare Zero Trust console.

### Steps

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) and sign in.
2. Select your account and go to **Access** -> **Applications**.
3. Click **Create an application** and choose **Self-hosted**.
4. Set:
   - **Application name**: WallabyFest Private
   - **Session duration**: 24 hours (or your preference)
   - **Application domain**: wallabyfest.co.uk
5. Under **Application policies**, add:
   - **Policy name**: Require Authentication
   - **Action**: Allow
   - **Rule**: Require specific emails or your allowed domain
6. Save the application.
7. In **Policies**, protect:
   - `/details/*`
   - `/api/private/*`
8. Unauthenticated users are redirected to Cloudflare Access login.

### Auth Flow

- User visits `/login/`.
- User clicks sign-in and is redirected to `/details/`.
- After authentication, Access injects `CF-Access-Authenticated-User-Email`.
- `/api/private/details` verifies that header before returning data.

## Guest Management (Cloudflare D1)

Guest attendee records are stored in Cloudflare D1.

Fields:
- name
- email
- rsvp (`pending`, `yes`, `no`)
- additional guests
- dietary requirements
- rsvp message

### 1) Create D1 database

```bash
wrangler d1 create wallabyfest-guests
```

Add the returned database id to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "GUESTS_DB"
database_name = "wallabyfest-guests"
database_id = "<your-database-id>"
```

### 2) Run migration

```bash
wrangler d1 execute wallabyfest-guests --remote --file migrations/0001_create_guests.sql
```

### 3) Set admin emails

Only admin emails can access guest management endpoints:

```bash
wrangler secret put ADMIN_EMAILS
```

Use a comma-separated value, for example:

```text
you@example.com,friend@example.com
```

### 4) Private guest API endpoints

Self-service endpoint (authenticated guest, scoped by Access email):

- `GET /api/private/guests/me`
- `PUT /api/private/guests/me`

`PUT /api/private/guests/me` can update only these fields:

- `rsvp`
- `additionalGuests`
- `dietaryRequirements`
- `rsvpMessage`

Admin endpoints (require Cloudflare Access auth and `ADMIN_EMAILS` allowlist match):

- `GET /api/private/guests`
- `POST /api/private/guests`
- `GET /api/private/guests/:id`
- `PUT /api/private/guests/:id`
- `DELETE /api/private/guests/:id`

Example payload:

```json
{
  "name": "Alex Example",
  "email": "alex@example.com",
  "rsvp": "yes",
  "additionalGuests": 1,
  "dietaryRequirements": "Vegetarian",
  "rsvpMessage": "Can bring brownies and arrive around 3pm."
}
```

## Notes

- Do not commit private values to `site/_data` or static files.
- GitHub secrets are for CI/deploy workflows, not direct browser reads.
- Access controls who can view private data.
