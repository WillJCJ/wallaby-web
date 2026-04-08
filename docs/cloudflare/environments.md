# Environments

Wrangler environments are selected by deploy command, not automatically by git branch.

## Environment model

- `production`: production Worker + production D1
- `preview`: preview Worker + preview D1

Configured in `wrangler.toml` under:

- `[env.production]`
- `[env.preview]`

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

## Required follow-up

Set your preview database id in `wrangler.toml`:

- `env.preview.d1_databases[0].database_id`

Replace placeholder `REPLACE_WITH_PREVIEW_DATABASE_ID` with the real value from `wrangler d1 create wallabyfest-guests-preview`.
