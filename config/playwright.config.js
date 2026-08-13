import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
    testDir: '../tests/browser',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: 'line',
    timeout: 30_000,
    globalSetup: './playwright.global-setup.js',
    use: {
        baseURL,
        trace: 'on-first-retry',
        viewport: {
            width: 1440,
            height: 960,
        },
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],
});
