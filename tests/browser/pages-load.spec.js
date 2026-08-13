import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const siteDir = path.resolve('site');

const pagePaths = fs
    .readdirSync(siteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => {
        if (entry.name === 'index.html') {
            return '/';
        }

        if (entry.name === '404.html') {
            return '/404.html';
        }

        const pageName = entry.name.replace(/\.html$/, '');
        return `/${pageName}/`;
    })
    .sort((left, right) => left.localeCompare(right));

for (const pagePath of pagePaths) {
    test(`loads ${pagePath}`, async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', (error) => {
            pageErrors.push(error);
        });

        const response = await page.goto(pagePath, { waitUntil: 'networkidle' });

        expect(response?.ok() || response?.status() === 404).toBe(true);
        await expect(page.locator('main')).toBeVisible();
        expect(pageErrors).toEqual([]);
    });
}
