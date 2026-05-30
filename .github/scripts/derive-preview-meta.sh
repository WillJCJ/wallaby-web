#!/usr/bin/env bash
set -euo pipefail

branch="${HEAD_REF:-}"
branch_slug="$(echo "$branch" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"
if [ -z "$branch_slug" ]; then
  branch_slug="preview"
fi

branch_slug="${branch_slug:0:32}"
branch_hash="$(printf '%s' "$branch" | shasum -a 256 | cut -c1-6)"
alias="pr-${branch_slug}-${branch_hash}"
alias="${alias:0:48}"
short_sha="${GITHUB_SHA::7}"
commit_time="$(git show -s --format=%cI "$GITHUB_SHA")"

echo "alias=$alias" >> "$GITHUB_OUTPUT"
echo "short_sha=$short_sha" >> "$GITHUB_OUTPUT"
echo "commit_time=$commit_time" >> "$GITHUB_OUTPUT"
