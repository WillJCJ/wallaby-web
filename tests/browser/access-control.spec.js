import { expect, test } from '@playwright/test';

import { bypassAccessChallenge, setAuthenticatedUser, skipWithoutAccessCredentials } from './access-test-helpers.js';

const privatePhotoAltText = 'Sleepy kids';
const privatePhotoPath = '/api/photos/2026/sleepy_kids.jpg';

test.describe('authentication and private content', () => {
  test('profile API access requires authentication', async ({ page }) => {
    skipWithoutAccessCredentials();

    // The service token only bypasses the Access edge challenge for the protected page shell;
    // the worker still sees no user identity, so it returns 401 as expected when signed out.
    await bypassAccessChallenge(page);

    const signedOutResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/api/private/guests/me') && response.request().method() === 'GET'
    ));

    await page.goto('/profile/', { waitUntil: 'networkidle' });

    const signedOutResponse = await signedOutResponsePromise;
    expect(signedOutResponse.status()).toBe(401);
    await expect(page.locator('#guest-profile-status')).toContainText('Authentication required');

    await setAuthenticatedUser(page);

    const signedInResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/api/private/guests/me') && response.request().method() === 'GET'
    ));

    await page.goto('/profile/', { waitUntil: 'networkidle' });

    const signedInResponse = await signedInResponsePromise;
    expect(signedInResponse.status()).not.toBe(401);
  });

  test('admin API access requires authentication', async ({ page }) => {
    skipWithoutAccessCredentials();

    // The service token only bypasses the Access edge challenge for the protected page shell;
    // the worker still sees no user identity, so it returns 401 as expected when signed out.
    await bypassAccessChallenge(page);

    const signedOutResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/api/private/guests') && response.request().method() === 'GET'
    ));

    await page.goto('/admin/', { waitUntil: 'networkidle' });

    const signedOutResponse = await signedOutResponsePromise;
    expect(signedOutResponse.status()).toBe(401);
    await expect(page.locator('#guest-admin-status')).toContainText('Authentication required');

    await setAuthenticatedUser(page);

    const signedInResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/api/private/guests') && response.request().method() === 'GET'
    ));

    await page.goto('/admin/', { waitUntil: 'networkidle' });

    const signedInResponse = await signedInResponsePromise;
    expect(signedInResponse.status()).not.toBe(401);
  });

  test('private photos are not displayed when signed out', async ({ page }) => {
    await page.goto('/photos/', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    await expect(page.getByLabel(privatePhotoAltText).first()).toBeHidden();
  });

  test('map private details stay hidden when signed out', async ({ page }) => {
    const privateDetailsRequests = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/private/details')) {
        privateDetailsRequests.push(request.url());
      }
    });

    await page.goto('/festival-map/', { waitUntil: 'networkidle' });

    expect(privateDetailsRequests).toEqual([]);
    await expect(page.locator('#private-details')).toBeHidden();
  });

  test('map private details are shown when signed in', async ({ page }) => {
    skipWithoutAccessCredentials();

    await setAuthenticatedUser(page);

    const privateDetailsResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/api/private/details') && response.request().method() === 'GET'
    ));

    await page.goto('/festival-map/', { waitUntil: 'networkidle' });

    const privateDetailsResponse = await privateDetailsResponsePromise;
    expect(privateDetailsResponse.status()).toBe(200);
    await expect(page.locator('#private-details')).toBeVisible();
    await expect(page.locator('#private-list')).toBeVisible();
  });

  test('private photo API is not served when signed out', async ({ page }) => {
    const response = await page.request.get(privatePhotoPath);

    expect(response.status()).toBe(404);
  });

  test('private photos are shown when signed in', async ({ page }) => {
    skipWithoutAccessCredentials();

    await setAuthenticatedUser(page);

    await page.goto('/photos/', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    await expect(page.getByLabel(privatePhotoAltText).first()).toBeVisible();
  });
});
