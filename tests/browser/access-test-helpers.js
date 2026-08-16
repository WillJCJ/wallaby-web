import process from 'node:process';

export const getAccessTestConfig = () => {
  const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL || '';
  const configuredBaseHost = configuredBaseUrl ? new URL(configuredBaseUrl).hostname : '';
  const usesExternalBaseUrl = Boolean(configuredBaseHost)
        && !['127.0.0.1', 'localhost', '::1'].includes(configuredBaseHost);
  const accessClientId = process.env.CLOUDFLARE_ACCESS_CLIENT_ID || '';
  const accessClientSecret = process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET || '';

  return {
    configuredBaseUrl,
    configuredBaseHost,
    usesExternalBaseUrl,
    accessClientId,
    accessClientSecret,
  };
};

export const setAuthenticatedUser = async (
  page,
  email = 'playwright-user@example.com',
  config = getAccessTestConfig(),
) => {
  const { usesExternalBaseUrl, accessClientId, accessClientSecret } = config;
  const headers = {
    'CF-Access-Authenticated-User-Email': email,
    ...(usesExternalBaseUrl
      ? {
        'CF-Access-Client-Id': accessClientId,
        'CF-Access-Client-Secret': accessClientSecret,
      }
      : {}),
  };

  await page.context().setExtraHTTPHeaders(headers);
};
