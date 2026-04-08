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
   - Application name: `WallabyFest Private`
   - Session duration: your preference
   - Application domain: `wallabyfest.co.uk`
5. Add an allow policy with your approved users/emails.
6. Save and assign protected paths.

## Auth flow

- User visits `/login/`.
- User signs in via Cloudflare Access and is redirected to `/profile/`.
- Access injects `CF-Access-Authenticated-User-Email`.
- Worker endpoints verify the header before returning private data.
