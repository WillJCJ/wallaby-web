# Worker Config

Current Worker config lives in `wrangler.jsonc`.

## Router Endpoints

The Worker routes below are implemented in `worker/router.js`.

Core and status:

- `GET /api/auth/status`
  - Returns current auth state (`signedIn`, viewer email). Public.
- `GET /api/env`
  - Returns deployment version ID and timestamp from `CF_VERSION_METADATA`. Public.
- `GET /api/private/details`
  - Returns private event details (address, gate code, viewer email). Authenticated guests only.

Access requests:

- `POST /api/access-requests`
  - Public (unauthenticated). Submit an access request with name, email, and Turnstile
    token. Saves to KV and triggers a Discord notification.
- `GET /api/private/access-requests`
  - List all pending access requests from KV, sorted newest-first. Admin only.
- `DELETE /api/private/access-requests/:requestId`
  - Dismiss (delete) a pending access request from KV by its opaque request ID. Admin only.

Guests and admin:

- `GET /api/private/guests`
  - List all guests. Admin only.
- `POST /api/private/guests`
  - Create a new guest record. Admin only.
- `GET /api/private/guests/me`
  - Return the authenticated guest's own profile. Authenticated guests only.
- `PUT /api/private/guests/me`
  - Update the authenticated guest's own profile fields. Authenticated guests only.
- `POST /api/private/guests/sync`
  - Trigger a sync of Cloudflare Access policies to match the current guest list. Admin only.
- `GET /api/private/guests/sync-status`
  - Return the current Access policy sync status. Admin only.
- `POST /api/private/guests/record-visit`
  - Record the current time as `lastSeen` for the authenticated guest in KV. Authenticated guests only.
- `GET /api/private/guests/:id`
  - Return a single guest record by ID. Admin only.
- `PUT /api/private/guests/:id`
  - Update a guest record by ID. Admin only.
- `DELETE /api/private/guests/:id`
  - Delete a guest record and all associated game data by ID. Admin only.
- `POST /api/private/guests/:id/access/enable`
  - Enable Cloudflare Access for the guest (add to policy). Admin only.
- `POST /api/private/guests/:id/access/disable`
  - Disable Cloudflare Access for the guest (remove from policy). Admin only.
- `GET /api/private/guests/:id/last-seen`
  - Return the guest's last-seen timestamp from KV. Admin only.
- `POST /api/private/guests/:id/send-invitation`
  - Send an invitation email to the guest via Cloudflare Email Workers. Admin only.

Game:

- `GET /api/game/high-scores`
  - Return the public high score leaderboard. Public.
- `GET /api/private/game/high-scores`
  - Return the full high score list including guest details. Admin only.
- `POST /api/private/game/runs/start`
  - Start a new game run and return a run ID. Authenticated guests only.
- `POST /api/private/game/runs/:id/finish`
  - Submit the score for a completed game run. Authenticated guests only.

Media and assets:

- `GET|HEAD /api/photos/:key`
  - Stream a photo from R2 by key. Authenticated guests only.
- `GET|HEAD /api/videos/:key`
  - Stream a video from R2 by key. Authenticated guests only.
- `GET /api/logo.svg`
  - Serve the site logo SVG. Public.
- `GET /favicon.ico`
  - Serve the site favicon. Public.

Dev-only auth helpers (localhost only, when enabled):

- `GET /api/dev-auth/status`
  - Return the current dev-auth session state. Local dev only.
- `POST /api/dev-auth/login`
  - Create a dev-auth session for a given email without Cloudflare Access. Local dev only.
- `POST /api/dev-auth/logout`
  - Destroy the dev-auth session. Local dev only.

## Main entrypoint

```toml
main = "worker/router.js"
```

```jsonc
"main": "worker/router.js"
```

## Build and assets

```toml
[build]
command = "npm run build"

[assets]
directory = "dist"
not_found_handling = "404-page"
```

```jsonc
"build": {
  "command": "npm run build"
},
"assets": {
  "directory": "dist",
  "not_found_handling": "404-page"
}
```

## Production route

```toml
[[env.production.routes]]
pattern = "wallabyfest.co.uk"
custom_domain = true
```

```jsonc
"env": {
  "production": {
    "routes": [{
      "pattern": "wallabyfest.co.uk",
      "custom_domain": true
    }]
  }
}
```

Preview runs on `workers.dev` with `workers_dev = true` and `preview_urls = true` under `env.preview`.

## D1 binding requirement

Worker code expects:

```toml
binding = "GUESTS_DB"
```

```jsonc
"binding": "GUESTS_DB"
```

If this binding name does not match, guest endpoints will fail with database configuration errors.

## R2 binding requirement

Photo and video endpoints expect:

```toml
[[r2_buckets]]
binding = "PHOTOS_BUCKET"
bucket_name = "wallaby-web"
```

```jsonc
"r2_buckets": [{
  "binding": "PHOTOS_BUCKET",
  "bucket_name": "wallaby-web"
}]
```

If this binding name does not match, `GET /api/photos/:key` and `GET /api/videos/:key`
will return `503 Photos bucket is not configured`.

See [R2](r2.md) for bucket creation, uploads, and photo metadata conventions.

## KV binding — access requests

Guest access requests submitted via the public form are stored in a Cloudflare KV namespace.

Create the namespace for each environment:

```bash
wrangler kv namespace create GUEST_REQUESTS_KV
```

Copy the returned `id` values into `wrangler.jsonc` under the appropriate `kv_namespaces` entries.

Each KV entry uses an opaque request ID key with prefix `request:` and stores:

```json
{ "requestId": "...", "name": "...", "email": "...", "requestedAt": "ISO-8601" }
```

Entries expire automatically after 30 days (TTL set on write).

## KV binding — guest last seen

Guest profile activity is tracked in a second KV namespace.

Create the namespace for each environment:

```bash
wrangler kv namespace create GUEST_LAST_SEEN_KV
```

Copy the returned `id` values into `wrangler.jsonc` under the appropriate `kv_namespaces` entries.

Each KV entry uses the guest id as the key and stores:

```json
{ "lastSeen": "ISO-8601" }
```

Entries expire automatically after 30 days (TTL set on write).

## Turnstile (bot protection on access request form)

The public `POST /api/access-requests` endpoint verifies a Cloudflare Turnstile token
when `TURNSTILE_SECRET_KEY` is set. Add the secret key as a Worker secret:

```bash
wrangler secret put TURNSTILE_SECRET_KEY
```

On `wrangler dev` (localhost), if `TURNSTILE_SECRET_KEY` is absent the verification step is skipped automatically.

The Turnstile widget is already enabled in [site/login.html](../../site/login.html). To replace or rotate it:

1. Create a Turnstile site in the Cloudflare dashboard (Turnstile → Add Site).
2. Set the site key in `site/login.html` on the `data-sitekey` attribute of the `.cf-turnstile` element.
3. Keep the front-end callback aligned with `data-callback="onTurnstileSuccess"` unless the client code changes too.

Cloudflare recommends also adding a rate-limit rule in the Cloudflare dashboard for
`POST /api/access-requests` (for example, 5 requests per email per 10 minutes) as a
secondary defence.
