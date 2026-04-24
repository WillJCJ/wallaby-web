# Cloudflare Access

Access policies are managed in the Cloudflare Zero Trust console.

## Paths to protect

Protect these routes with authentication:

- `/admin/*`
- `/profile/*`
- `/details/*`
- `/api/private/*`

## Setup steps

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) and sign in.
2. Select your account and go to Access -> Applications.
3. Click Create an application and choose Self-hosted.
4. Configure:
   - Application name: `Wallaby Fest Private`
   - Session duration: your preference
   - Application domain: `wallabyfest.co.uk`
5. Create a reusable allow policy that will be managed by the Worker.
6. Copy the reusable policy id and set it as `CF_ACCESS_POLICY_ID` for the Worker.
7. Add an allow policy with your approved users/emails.
8. Save and assign protected paths.

## Guest access sync

Guest records in D1 drive Access allowlist membership through admin endpoints.

- `POST /api/private/guests/:id/access/enable`: marks a guest as access-enabled and runs policy sync.
- `POST /api/private/guests/:id/access/disable`: removes access for a guest and runs policy sync.
- `POST /api/private/guests/sync`: runs a full sync (`{"mode":"full"}`) or dry run (`{"mode":"dry-run"}`).
- `GET /api/private/guests/sync-status`: returns aggregate sync state and drift details.

Dry-run and sync-status compare desired guest emails against managed email rules in the configured Access reusable policy to detect drift.

## Auth flow

- User visits `/login/`.
- User signs in via Cloudflare Access and is redirected to `/profile/`.
- Access injects `CF-Access-Authenticated-User-Email`.
- Worker endpoints verify the header before returning private data.
