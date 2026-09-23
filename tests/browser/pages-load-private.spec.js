import { expect, test } from '@playwright/test';

import { setAuthenticatedUser, skipWithoutAccessCredentials } from './access-test-helpers.js';

const privatePagePaths = ['/admin/', '/profile/'];

for (const pagePath of privatePagePaths) {
  test(`loads ${pagePath} while authenticated`, async ({ page }) => {
    skipWithoutAccessCredentials();

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
