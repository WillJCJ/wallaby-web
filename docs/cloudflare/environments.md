# Environments

Wrangler environments are selected by deploy command.
GitHub Actions controls which command runs for each git event.

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

This mapping is enforced in `.github/workflows/cicd.yml`:

- pull requests run preview deployment using `wrangler versions upload --env preview`
- `main` pushes run production deployment using `wrangler deploy --env production`

Cloudflare Workers Builds triggers are not used for branch mapping.

## Deploy commands

Production:

```bash
wrangler deploy --env production
```

Preview:

```bash
wrangler deploy --env preview
```

Preview CI uses version uploads with aliases:

```bash
wrangler versions upload --env preview --preview-alias <alias>
```

This keeps preview deployments isolated from production promotion.

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

Keep preview and production Access apps and reusable policies separate so
approval/revoke tests in preview never change production access.

`DEV_AUTH_ENABLED` stays `false` in preview and production.
Localhost development continues to use local-only `dev-auth`.

If you recreate any of those resources, update the corresponding ids in `wrangler.toml` before deploying.

## GitHub Actions deploy prerequisites

Configure the following repository secrets for deploy workflows:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `WORKER_NAME`
- `WORKERS_SUBDOMAIN`

The workflow derives a preview URL in this format:

```text
https://<preview-alias>-<worker-name>.<workers-subdomain>.workers.dev
```

## Migration checklist

After the first successful GitHub Actions production deployment:

1. Disable Cloudflare Workers Builds for this repository.
2. Keep GitHub Actions as the single deploy path for preview and production.
3. Verify only GitHub Actions creates deployment events.
