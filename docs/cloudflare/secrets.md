# Secrets

Do not commit private values to the repository.

Set Worker secrets per environment:

```bash
wrangler secret put EVENT_ADDRESS --env production
wrangler secret put GATE_CODE --env production
wrangler secret put ADMIN_EMAILS --env production

wrangler secret put EVENT_ADDRESS --env preview
wrangler secret put GATE_CODE --env preview
wrangler secret put ADMIN_EMAILS --env preview
```

## Secret meanings

- `EVENT_ADDRESS`: private destination address
- `GATE_CODE`: private entry code
- `ADMIN_EMAILS`: comma-separated admin allowlist for guest admin endpoints

Example `ADMIN_EMAILS` value:

```text
you@example.com,friend@example.com
```
