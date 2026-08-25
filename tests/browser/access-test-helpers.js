import process from 'node:process';

export const getAccessTestConfig = () => {
  const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL || '';
  const configuredBaseHost = configuredBaseUrl ? new URL(configuredBaseUrl).hostname : '';
  const usesExternalBaseUrl = Boolean(configuredBaseHost)
        && !['127.0.0.1', 'localhost', '::1'].includes(configuredBaseHost);
  const accessClientId = process.env.CLOUDFLARE_ACCESS_CLIENT_ID || '';
  const accessClientSecret = process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET || '';
  const testAuthSecret = process.env.TEST_AUTH_SECRET || '';

  return {
    configuredBaseUrl,
    configuredBaseHost,
    usesExternalBaseUrl,
    accessClientId,
    accessClientSecret,
    testAuthSecret,
  };
};

// Returns the full set of auth headers for a given email.
//
// On external (preview/production) hosts, service token headers are included so the
// request bypasses the Cloudflare Access edge challenge. The X-Test-Auth-* headers
// let the worker identify the user — Cloudflare Access strips CF-Access-Authenticated-User-Email
// so service tokens alone bypass the wall but leave the worker with no identity.
export const getAuthHeaders = (
  email = 'playwright-user@example.com',
  config = getAccessTestConfig(),
) => {
  const { usesExternalBaseUrl, accessClientId, accessClientSecret, testAuthSecret } = config;
  return {
    'CF-Access-Authenticated-User-Email': email,
    ...(usesExternalBaseUrl
      ? {
        'CF-Access-Client-Id': accessClientId,
        'CF-Access-Client-Secret': accessClientSecret,
      }
      : {}),
    ...(testAuthSecret
      ? {
        'X-Test-Auth-Email': email,
        'X-Test-Auth-Secret': testAuthSecret,
      }
      : {}),
  };
};

export const setAuthenticatedUser = async (
  page,
  email = 'playwright-user@example.com',
  config = getAccessTestConfig(),
) => {
  await page.context().setExtraHTTPHeaders(getAuthHeaders(email, config));
};
