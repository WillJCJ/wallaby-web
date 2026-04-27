# Environments

Wrangler environments are selected by deploy command, not automatically by git branch.

## Environment model

- `production`: production Worker + production D1
- `preview`: preview Worker + preview D1

Configured in `wrangler.toml` under:

- `[env.production]`
- `[env.preview]`

The shared top-level config is used for local development and mirrors the preview-style bindings.

## Recommended branch mapping

- `main` branch -> `--env production`
- non-main branches/PRs -> `--env preview`

## Deploy commands

Production:

```bash
wrangler deploy --env production
```

Preview:

```bash
wrangler deploy --env preview
```

## Current binding split

The checked-in `wrangler.toml` already defines separate D1, KV, and R2 bindings for both environments:

- `[[env.production.d1_databases]]`
- `[[env.preview.d1_databases]]`
- `[[env.production.kv_namespaces]]`
- `[[env.preview.kv_namespaces]]`
- `[[env.production.r2_buckets]]`
- `[[env.preview.r2_buckets]]`

It also defines distinct Access policy ids per environment:

- `[env.production.vars].CF_ACCESS_POLICY_ID`
- `[env.preview.vars].CF_ACCESS_POLICY_ID`

Keep preview and production Access apps and reusable policies separate so approval/revoke tests in preview never change production access.

`DEV_AUTH_ENABLED` stays `false` in preview and production. Localhost development continues to use local-only `dev-auth`.

If you recreate any of those resources, update the corresponding ids in `wrangler.toml` before deploying.
