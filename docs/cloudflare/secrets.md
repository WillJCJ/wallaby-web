# Secrets

Do not commit private values to the repository.

## GitHub Actions deployment secret

GitHub Actions deploy workflows read `CLOUDFLARE_API_TOKEN` from the GitHub Environment secrets:

- `Preview` environment: token used by `.github/workflows/deploy-preview.yml`
- `Production` environment: token used by `.github/workflows/deploy-production.yml`

Scope each token to the minimum required account resources and permissions.
Rotate these tokens if team access changes or if exposure is suspected.

### Minimum permissions for production deploy

For the current production deploy flow, the Cloudflare API token needs:

- Account permission: `Workers Scripts Edit`
- Account permission: `D1 Edit`
- Zone permission: `Workers Routes Edit`
- Zone permission: `Zone Read`

Optional, but useful for cleaner Wrangler output:

- User permission: `User Details Read`

If the deploy flow later starts managing additional resources directly, add the
matching permissions for those resources rather than broadening the token.

Set Worker secrets per environment:

```bash
wrangler secret put EVENT_ADDRESS --env production
wrangler secret put GATE_CODE --env production
wrangler secret put ADMIN_EMAILS --env production
wrangler secret put CF_ACCESS_API_TOKEN --env production
wrangler secret put TURNSTILE_SECRET_KEY --env production
wrangler secret put DISCORD_WEBHOOK_URL --env production

wrangler secret put EVENT_ADDRESS --env preview
wrangler secret put GATE_CODE --env preview
wrangler secret put ADMIN_EMAILS --env preview
wrangler secret put CF_ACCESS_API_TOKEN --env preview
wrangler secret put TURNSTILE_SECRET_KEY --env preview
wrangler secret put DISCORD_WEBHOOK_URL --env preview
```

## Secret meanings

- `EVENT_ADDRESS`: private destination address
- `GATE_CODE`: private entry code
- `ADMIN_EMAILS`: comma-separated admin allowlist for guest admin endpoints
- `CF_ACCESS_API_TOKEN`: API token with Access Apps and Policies Read/Write
- `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile secret for verifying access request submissions
- `DISCORD_WEBHOOK_URL`: Discord webhook URL to notify when a new access request is submitted

`CF_ACCOUNT_ID` and `CF_ACCESS_POLICY_ID` are configured as environment vars in `wrangler.jsonc`.

Example `ADMIN_EMAILS` value:

```text
you@example.com,friend@example.com
```
