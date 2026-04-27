# Secrets

Do not commit private values to the repository.

Set Worker secrets per environment:

```bash
wrangler secret put EVENT_ADDRESS --env production
wrangler secret put GATE_CODE --env production
wrangler secret put ADMIN_EMAILS --env production
wrangler secret put CF_ACCESS_API_TOKEN --env production
wrangler secret put TURNSTILE_SECRET_KEY --env production
wrangler secret put DISCORD_WEBHOOK_URL --env production
wrangler secret put ACCESS_REQUEST_APPROVAL_SECRET --env production

wrangler secret put EVENT_ADDRESS --env preview
wrangler secret put GATE_CODE --env preview
wrangler secret put ADMIN_EMAILS --env preview
wrangler secret put CF_ACCESS_API_TOKEN --env preview
wrangler secret put TURNSTILE_SECRET_KEY --env preview
wrangler secret put DISCORD_WEBHOOK_URL --env preview
wrangler secret put ACCESS_REQUEST_APPROVAL_SECRET --env preview
```

## Secret meanings

- `EVENT_ADDRESS`: private destination address
- `GATE_CODE`: private entry code
- `ADMIN_EMAILS`: comma-separated admin allowlist for guest admin endpoints
- `CF_ACCESS_API_TOKEN`: API token with Access Apps and Policies Read/Write
- `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile secret for verifying access request submissions
- `DISCORD_WEBHOOK_URL`: Discord webhook URL to notify when a new access request is submitted
- `ACCESS_REQUEST_APPROVAL_SECRET`: secret used to sign one-click Discord approval links

`CF_ACCOUNT_ID` and `CF_ACCESS_POLICY_ID` are configured as environment vars in `wrangler.toml`.

Example `ADMIN_EMAILS` value:

```text
you@example.com,friend@example.com
```
