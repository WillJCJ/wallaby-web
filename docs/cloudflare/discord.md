# Discord Notifications

The Worker sends a push notification to a Discord channel via webhook when a new access
request is submitted. The notification includes the requester's name, a direct link to the
admin page, and the environment it came from (if not production).

## How it works

After a valid access request is saved to KV, the Worker POSTs a formatted embed to your Discord webhook URL.

### Notification Format

**Production (wallabyfest.co.uk):**

- Blue embed, no environment badge

**Preview (.workers.dev):**

- Orange embed with ⚠️ Preview badge in title and embed field

**Local (localhost/127.0.0.1):**

- Bright blue embed with 🔷 Local badge

The embed includes:

- Requester's name in the title
- One-click "Create guest now" link (signed, expires after 7 days)
- Manual "Open admin page" link
- Footer showing environment (production/preview/local)
- Colour-coded for easy visual scanning

If `DISCORD_WEBHOOK_URL` is not set, the notification step is skipped silently.
Notification failures never affect the HTTP response returned to the requester.

## Create a Discord webhook

1. Create a Discord server (or use an existing one).
2. Create a channel for notifications (e.g., #access-requests).
3. Go to Server Settings → Integrations → Webhooks.
4. Click "New Webhook" and select the channel.
5. Copy the webhook URL.
6. (Optional) Customize the webhook name and avatar.

The webhook URL contains your bot token, so treat it as a secret.

## Set secrets

Set per environment:

```bash
wrangler secret put DISCORD_WEBHOOK_URL --env production
wrangler secret put DISCORD_WEBHOOK_URL --env preview
wrangler secret put ACCESS_REQUEST_APPROVAL_SECRET --env production
wrangler secret put ACCESS_REQUEST_APPROVAL_SECRET --env preview
```

Example webhook URL (do not share):

```text
https://discord.com/api/webhooks/1234567890/ABC_DEF_GHI
```
<!-- markdownlint-disable-next-line MD034 -->

## Local development

This works on localhost as well when you run the Worker with `npm run dev:wrangler`.

Add local values in `.dev.vars`:

```text
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
ACCESS_REQUEST_APPROVAL_SECRET=replace-with-a-long-random-string
```

Then submit an access request in local dev. The notification link uses the request origin,
so in local runs it points to the local admin page
(for example, `http://127.0.0.1:8787/admin.html` or `http://localhost:8787/admin.html`).

If `DISCORD_WEBHOOK_URL` is not set locally, notifications are skipped.

## Verify

1. Submit a test access request on the login page.
2. Check that a notification appears in your Discord channel within a few seconds.
3. Confirm the one-click link includes `rid`, `exp`, and `sig` query params.
   The link path should be `/api/private/access-requests/approve`.
4. Click "Create guest now" and confirm it redirects to admin with `?approval=created`.
