import { expect, test } from '@playwright/test';

import { setAuthenticatedUser, skipWithoutAccessCredentials } from './access-test-helpers.js';

// Unique per test run so repeated or parallel runs never collide on previously saved values.
const generateTestValue = (field) => `test-${field}-${Math.random().toString(36).slice(2, 8)}`;

test.describe('profile self-service editing', () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutAccessCredentials();

    await setAuthenticatedUser(page);
    await page.goto('/profile/', { waitUntil: 'networkidle' });
    await expect(page.locator('#guest-profile-list')).toBeVisible();
  });

  test('updates RSVP', async ({ page }) => {
    await page.locator('[data-action="rsvp"]').click();
    await page.locator('#guest-rsvp-editor').selectOption('yes');

    await expect(page.locator('#guest-rsvp')).toHaveText('Yes');
  });

  test('updates additional guests', async ({ page }) => {
    const value = Math.floor(Math.random() * 5) + 1;

    await page.locator('[data-action="additionalGuests"]').click();
    await page.locator('#guest-additional-guests-editor').fill(String(value));
    await page.locator('#guest-additional-guests-editor').blur();

    await expect(page.locator('#guest-additional-guests')).toHaveText(String(value));
  });

  test('updates dietary requirements', async ({ page }) => {
    const value = generateTestValue('dietaryRequirements');

    await page.locator('[data-action="dietaryRequirements"]').click();
    await page.locator('#guest-dietary-requirements-editor').fill(value);
    await page.locator('#guest-dietary-requirements-editor').blur();

    await expect(page.locator('#guest-dietary-requirements')).toHaveText(value);
  });

  test('updates RSVP message', async ({ page }) => {
    const value = generateTestValue('rsvpMessage');

    await page.locator('[data-action="rsvpMessage"]').click();
    await page.locator('#guest-rsvp-message-editor').fill(value);
    await page.locator('#guest-rsvp-message-editor').blur();

    await expect(page.locator('#guest-rsvp-message')).toHaveText(value);
  });
});
