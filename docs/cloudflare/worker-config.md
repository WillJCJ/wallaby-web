# Worker Config

Current Worker config lives in `wrangler.toml`.

## Main entrypoint

```toml
main = "worker/router.js"
```

## Build and assets

```toml
[build]
command = "npm run build"

[assets]
directory = "dist"
not_found_handling = "404-page"
```

## Route

```toml
[[routes]]
pattern = "wallabyfest.co.uk"
custom_domain = true
```

## D1 binding requirement

Worker code expects:

```toml
binding = "GUESTS_DB"
```

If this binding name does not match, guest endpoints will fail with database configuration errors.

## R2 binding requirement

Photo endpoints expect:

```toml
[[r2_buckets]]
binding = "PHOTOS_BUCKET"
bucket_name = "wallaby-web"
```

If this binding name does not match, `GET /api/photos/:key` will return `503 Photos bucket is not configured`.

See [R2](r2.md) for bucket creation, uploads, and photo metadata conventions.

## KV binding — access requests

Guest access requests submitted via the public form are stored in a Cloudflare KV namespace.

Create the namespace for each environment:

```bash
wrangler kv namespace create GUEST_REQUESTS_KV
```

Copy the returned `id` values into `wrangler.toml` under the appropriate `[[kv_namespaces]]` entries.

Each KV entry uses the requester's email as the key and stores:

```json
{ "name": "...", "email": "...", "requestedAt": "ISO-8601" }
```

Entries expire automatically after 30 days (TTL set on write).

## Turnstile (bot protection on access request form)

The public `POST /api/access-requests` endpoint optionally verifies a Cloudflare Turnstile token. Add the secret key as a Worker secret:

```bash
wrangler secret put TURNSTILE_SECRET_KEY
```

On `wrangler dev` (localhost), if `TURNSTILE_SECRET_KEY` is absent the verification step is skipped automatically.

To enable the Turnstile widget in the browser:
1. Create a Turnstile site in the Cloudflare dashboard (Turnstile → Add Site).
2. Set the site key in `site/login.html` on the `data-sitekey` attribute of the `.cf-turnstile` element.
3. Uncomment the Turnstile script tag at the bottom of `site/login.html`.

Cloudflare recommends also adding a rate-limit rule in the Cloudflare dashboard for `POST /api/access-requests` (for example, 5 requests per email per 10 minutes) as a secondary defence.
