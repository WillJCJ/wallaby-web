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

// Returns auth headers for a given email.
//
// On external hosts, service token headers bypass the Cloudflare Access edge challenge.
// The CF-Access-Authenticated-User-Email header works locally (no Access) but is
// stripped by Access on external hosts, so the test auth cookies handle identity there.
export const getAuthHeaders = (
  email = 'playwright-user@example.com',
  config = getAccessTestConfig(),
) => {
  const { usesExternalBaseUrl, accessClientId, accessClientSecret } = config;
  return {
    'CF-Access-Authenticated-User-Email': email,
    ...(usesExternalBaseUrl
      ? {
        'CF-Access-Client-Id': accessClientId,
        'CF-Access-Client-Secret': accessClientSecret,
      }
      : {}),
  };
};

// Sets test auth cookies so the worker can identify the user. Cloudflare Access
// strips custom headers like X-Test-Auth-Email, but cookies pass through unchanged.
export const setAuthenticatedUser = async (
  page,
  email = 'playwright-user@example.com',
  config = getAccessTestConfig(),
) => {
  const { usesExternalBaseUrl, configuredBaseHost, testAuthSecret } = config;

  await page.context().setExtraHTTPHeaders(getAuthHeaders(email, config));

  if (usesExternalBaseUrl && testAuthSecret) {
    await page.context().addCookies([
      {
        name: 'test_auth_email',
        value: email,
        domain: configuredBaseHost,
        path: '/',
      },
      {
        name: 'test_auth_secret',
        value: testAuthSecret,
        domain: configuredBaseHost,
        path: '/',
      },
    ]);
  }
};
