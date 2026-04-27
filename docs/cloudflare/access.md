# Cloudflare Access

Access policies are managed in the Cloudflare Zero Trust console.

## Auth model

- Authentication: Cloudflare Access with Google as the identity provider.
- Authorisation: the Access reusable allow policy contains approved guest emails only.
- Source of truth for allowlist membership: D1 `guests.access_enabled`, synced by Worker admin endpoints.
- Local development: keep `dev-auth` for localhost only; do not configure Google flow for local mode.

## Paths to protect

Protect this route family with authentication:

- `/api/private/*`

Private page shells (`/admin/`, `/profile/`) stay publicly reachable.
They immediately send signed-out users to `/login/` in-site, then private API calls remain protected by Access.

## Setup steps

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) and sign in.
2. Select your account and go to Access -> Applications.
3. Create or update one Access app for preview hostnames and one Access app for production.
4. In each app, add Google as an identity provider.
5. Keep policy shape consistent across environments:
   - one reusable allow policy managed by Worker sync,
   - include rules limited to approved emails,
   - no broad "all Google users" allow rule.
6. Save and assign protected paths.

## Environment setup

Configure preview first, then production.

### Preview

1. In Access, open the preview app and confirm Google IdP is enabled.
2. Confirm the preview reusable allow policy is distinct from production.
3. Confirm preview app protected paths include `/api/private/*`.
4. Confirm `CF_ACCESS_POLICY_ID` in `[env.preview.vars]` maps to the preview policy id.

### Production

1. In Access, open the production app and confirm Google IdP is enabled.
2. Confirm the production reusable allow policy is distinct from preview.
3. Confirm production app protected paths include `/api/private/*`.
4. Confirm `CF_ACCESS_POLICY_ID` in `[env.production.vars]` maps to the production policy id.

## Guest access sync

Guest records in D1 drive Access allowlist membership through admin endpoints.

- Enabling guest access sets `access_enabled = 1` and syncs the policy.
- Disabling guest access removes the email from the managed policy include rules.
- Dry-run and sync-status endpoints compare desired emails with Access policy emails to detect drift.

## Access request flow

The public `POST /api/access-requests` endpoint allows anyone to submit their name and
email for consideration. Submissions write to KV only — D1 and the Access allowlist are
not touched at this stage.

Admins review pending requests on the admin page. Choosing "Create guest" creates a D1
record and triggers an Access policy sync, which adds the guest's email to the allowlist.
Choosing "Dismiss" deletes the KV entry without creating a guest record.

This keeps D1 and Access policy changes exclusively under authenticated admin control.

- `POST /api/private/guests/:id/access/enable`: marks a guest as access-enabled and runs policy sync.
- `POST /api/private/guests/:id/access/disable`: removes access for a guest and runs policy sync.
- `POST /api/private/guests/sync`: runs a full sync (`{"mode":"full"}`) or dry run (`{"mode":"dry-run"}`).
- `GET /api/private/guests/sync-status`: returns aggregate sync state and drift details.

Dry-run and sync-status compare desired guest emails against managed email rules in the
configured Access reusable policy to detect drift.

## Auth flow

- User visits `/login/`.
- User signs in with Google via Cloudflare Access and is redirected to `/profile/`.
- Access injects `CF-Access-Authenticated-User-Email`.
- Worker endpoints verify the header before returning private data.

## Verification checklist

1. Signed-out request to `/api/private/*` receives Access challenge.
2. Signed-in but unapproved Google account is blocked on private routes.
3. Admin enables access for a guest and runs sync; approved email appears in managed include rules.
4. Admin disables access and runs sync; email is removed from managed include rules.
5. `DEV_AUTH_ENABLED` remains `false` in preview and production.
