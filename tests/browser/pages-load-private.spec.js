import { expect, test } from '@playwright/test';

import { getAccessTestConfig, setAuthenticatedUser } from './access-test-helpers.js';

const {
  usesExternalBaseUrl,
  accessClientId,
  accessClientSecret,
} = getAccessTestConfig();

const privatePagePaths = ['/admin/', '/profile/'];

for (const pagePath of privatePagePaths) {
  test(`loads ${pagePath} while authenticated`, async ({ page }) => {
    test.skip(
      usesExternalBaseUrl && (!accessClientId || !accessClientSecret),
      'Authenticated external smoke checks require CLOUDFLARE_ACCESS_CLIENT_ID and CLOUDFLARE_ACCESS_CLIENT_SECRET.'
    );

    await setAuthenticatedUser(page);

    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    const response = await page.goto(pagePath, { waitUntil: 'networkidle' });

    expect(response?.ok()).toBe(true);
    await expect(page.locator('main')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}
