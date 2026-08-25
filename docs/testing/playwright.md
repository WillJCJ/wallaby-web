# Playwright

Browser smoke and access-control tests live in `tests/browser/` and run with
[Playwright](https://playwright.dev/).

## Run locally

Start the local worker in one terminal:

```bash
npm run dev:wrangler
```

Then run the Playwright suite in another terminal:

```bash
npm run test:playwright
```

Before running browser tests locally, make sure local private routes and media are available:

```bash
npm run d1:migrate:local
npm run d1:seed:local
npm run r2:sync-local
```

In local worker mode, authenticated browser checks use the dev-auth shim already enabled by
`npm run dev:wrangler`.

## Run against the preview environment

To point Playwright at a deployed preview, you can either set `PLAYWRIGHT_BASE_URL` manually or use the preview helper command.

Manual form:

```bash
PLAYWRIGHT_BASE_URL="https://<preview-url>" npm run test:playwright
```

Manual form:

```bash
PLAYWRIGHT_BASE_URL="https://<preview-url>" npm run test:playwright
```

Authenticated preview checks are protected by Cloudflare Access and require both Access headers:

- `CF-Access-Client-Id` from `CLOUDFLARE_ACCESS_CLIENT_ID`
- `CF-Access-Client-Secret` from `CLOUDFLARE_ACCESS_CLIENT_SECRET`

Run the suite against preview like this:

```bash
PLAYWRIGHT_BASE_URL="https://<preview-url>" \
CLOUDFLARE_ACCESS_CLIENT_ID="<client-id>" \
CLOUDFLARE_ACCESS_CLIENT_SECRET="<client-secret>" \
npm run test:playwright
```

If the Access environment variables are missing, the authenticated external checks are skipped,
but the signed-out smoke checks still run.
