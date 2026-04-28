import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['site/tests/**/*.test.js', 'worker/tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        '.wrangler/',
        'site/_includes/',
        'site/styles/',
        '**/*.config.js',
      ],
      all: true,
      lines: 50,
      functions: 50,
      branches: 50,
      statements: 50,
    },
  },
});