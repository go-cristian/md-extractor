import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    headless: true,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
