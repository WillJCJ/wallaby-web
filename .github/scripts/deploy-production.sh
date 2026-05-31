#!/usr/bin/env bash
set -euo pipefail

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN is required" >&2
  exit 1
fi

echo "Applying production D1 migrations"
npx wrangler d1 migrations apply GUESTS_DB --env production --remote

echo "Deploying production Worker"
npx wrangler deploy --env production