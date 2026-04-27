import { isLocalHost, isProductionHost } from './host.js';

export const sendAccessRequestDiscordNotification = async (env, requestEntry, origin) => {
  if (!env.DISCORD_WEBHOOK_URL) return;

  const { name } = requestEntry;

  const url = new URL(origin);
  const hostname = url.hostname;

  // Determine environment and colors.
  let environment = 'production';
  let embedColor = 3447003; // Blue
  let environmentBadge = '';

  if (isLocalHost(hostname)) {
    environment = 'local';
    embedColor = 0x3498db; // Bright blue
    environmentBadge = ' 🔷 Local';
  } else if (!isProductionHost(hostname)) {
    environment = 'preview';
    embedColor = 0xf39c12; // Orange
    environmentBadge = ' ⚠️ Preview';
  }

  const fields = [];
  if (environmentBadge) {
    fields.push({
      name: 'Environment',
      value: environmentBadge.trim(),
      inline: true,
    });
  }

  fields.push({
      name: 'Admin page',
    value: `[Open admin page](${origin}/admin.html)`,
    inline: true,
  });

  const response = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `New access request from **${name}**${environmentBadge}`,
      embeds: [
        {
          title: 'Review Request',
          description: 'Open the admin page to review this request.',
          url: `${origin}/admin.html`,
          color: embedColor,
          fields,
          footer: {
            text: `Wallaby Fest • ${environment}`,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const detail = body ? ` ${body.slice(0, 200)}` : '';
    throw new Error(`Discord webhook rejected notification (${response.status}).${detail}`);
  }
};