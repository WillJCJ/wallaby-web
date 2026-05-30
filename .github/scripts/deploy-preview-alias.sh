#!/usr/bin/env bash
set -euo pipefail

output_file="$(mktemp)"

npx wrangler versions upload --env preview \
  --preview-alias "$PREVIEW_ALIAS" \
  --message "PR #$PR_NUMBER @ $SHORT_SHA" \
  2>&1 | tee "$output_file"

preview_url="$(grep -Eo 'https://[[:alnum:]._-]+\.workers\.dev' "$output_file" | head -n1)"
if [ -z "$preview_url" ] && [ -n "${WORKERS_SUBDOMAIN:-}" ]; then
  preview_url="https://${PREVIEW_ALIAS}-${WORKER_NAME}.${WORKERS_SUBDOMAIN}.workers.dev"
fi

if [ -z "$preview_url" ]; then
  echo "Unable to determine preview URL from Wrangler output." >&2
  echo "Set repository variable CLOUDFLARE_WORKERS_SUBDOMAIN for deterministic URL fallback." >&2
  exit 1
fi

echo "preview_url=$preview_url" >> "$GITHUB_OUTPUT"
