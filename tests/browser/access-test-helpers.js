import process from 'node:process';
import { test } from '@playwright/test';

const DEFAULT_TEST_EMAIL = 'playwright-user@example.com';

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

// Skips the current test when external smoke checks lack Access service token credentials.
export const skipWithoutAccessCredentials = (config = getAccessTestConfig()) => {
  test.skip(
    config.usesExternalBaseUrl && (!config.accessClientId || !config.accessClientSecret),
    'Authenticated external smoke checks require CLOUDFLARE_ACCESS_CLIENT_ID and CLOUDFLARE_ACCESS_CLIENT_SECRET.'
  );
};

// Service token headers authenticate the service, not a user; they bypass the Cloudflare
// Access edge challenge alone, without granting any user identity.
const getServiceTokenHeaders = ({ usesExternalBaseUrl, accessClientId, accessClientSecret }) => (
  usesExternalBaseUrl
    ? {
      'CF-Access-Client-Id': accessClientId,
      'CF-Access-Client-Secret': accessClientSecret,
    }
    : {}
);

// Lets requests past the Access edge challenge without asserting any user identity. Use for
// "signed out" checks against Access-protected paths (e.g. /profile/, /admin/), where the page
// shell itself is gated and would otherwise redirect to the Access login page before ever
// reaching the worker.
export const bypassAccessChallenge = async (page, config = getAccessTestConfig()) => {
  await page.context().setExtraHTTPHeaders(getServiceTokenHeaders(config));
};

// Sets headers and cookies so the worker identifies the given user. CF-Access-Authenticated-
// User-Email works locally (no Access in front) but is stripped by Access on external hosts,
// where the test auth cookie carries identity instead.
export const setAuthenticatedUser = async (
  page,
  email = DEFAULT_TEST_EMAIL,
  config = getAccessTestConfig(),
) => {
  const { usesExternalBaseUrl, configuredBaseHost, testAuthSecret } = config;

  await page.context().setExtraHTTPHeaders({
    'CF-Access-Authenticated-User-Email': email,
    ...getServiceTokenHeaders(config),
  });

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
