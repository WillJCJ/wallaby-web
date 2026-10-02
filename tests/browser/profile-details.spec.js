import { expect, test } from '@playwright/test';

import { setAuthenticatedUser, skipWithoutTestAuthSecret } from './access-test-helpers.js';

// Unique per test run so repeated or parallel runs never collide on previously saved values.
const generateTestValue = (field) => `test-${field}-${Math.random().toString(36).slice(2, 8)}`;

test.describe('profile self-service editing', () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutTestAuthSecret();

    await setAuthenticatedUser(page);
    await page.goto('/profile/', { waitUntil: 'networkidle' });
    await expect(page.locator('#guest-profile-list')).toBeVisible();
  });

  test('updates RSVP', async ({ page }) => {
    const currentValue = await page.locator('#guest-rsvp').innerText();
    const value = currentValue === 'Yes' ? 'no' : 'yes';
    const savePromise = page.waitForResponse((response) => (
      response.url().includes('/api/private/guests/me') && response.request().method() === 'PUT'
    ));

    await page.locator('[data-action="rsvp"]').click();
    await page.locator('#guest-rsvp-editor').selectOption(value);

    const response = await savePromise;
    expect(response.status()).toBe(200);
    expect((await response.json()).guest.rsvp).toBe(value);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#guest-rsvp')).toHaveText(value === 'yes' ? 'Yes' : 'No');
  });

  test('updates additional guests', async ({ page }) => {
    const currentValue = Number.parseInt(await page.locator('#guest-additional-guests').innerText(), 10) || 0;
    const value = currentValue + 1;
    const savePromise = page.waitForResponse((response) => (
      response.url().includes('/api/private/guests/me') && response.request().method() === 'PUT'
    ));

    await page.locator('[data-action="additionalGuests"]').click();
    await page.locator('#guest-additional-guests-editor').fill(String(value));
    await page.locator('#guest-additional-guests-editor').blur();

    const response = await savePromise;
    expect(response.status()).toBe(200);
    expect((await response.json()).guest.additionalGuests).toBe(value);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#guest-additional-guests')).toHaveText(String(value));
  });

  test('updates dietary requirements', async ({ page }) => {
    const value = generateTestValue('dietaryRequirements');
    const savePromise = page.waitForResponse((response) => (
      response.url().includes('/api/private/guests/me') && response.request().method() === 'PUT'
    ));

    await page.locator('[data-action="dietaryRequirements"]').click();
    await page.locator('#guest-dietary-requirements-editor').fill(value);
    await page.locator('#guest-dietary-requirements-editor').blur();

    const response = await savePromise;
    expect(response.status()).toBe(200);
    expect((await response.json()).guest.dietaryRequirements).toBe(value);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#guest-dietary-requirements')).toHaveText(value);
  });

  test('updates RSVP message', async ({ page }) => {
    const value = generateTestValue('rsvpMessage');
    const savePromise = page.waitForResponse((response) => (
      response.url().includes('/api/private/guests/me') && response.request().method() === 'PUT'
    ));

    await page.locator('[data-action="rsvpMessage"]').click();
    await page.locator('#guest-rsvp-message-editor').fill(value);
    await page.locator('#guest-rsvp-message-editor').blur();

    const response = await savePromise;
    expect(response.status()).toBe(200);
    expect((await response.json()).guest.rsvpMessage).toBe(value);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#guest-rsvp-message')).toHaveText(value);
  });
});
