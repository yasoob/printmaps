import { defineConfig, devices } from '@playwright/test';

const port = process.env.MARKETING_TEST_PORT ?? '4176';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'marketing.spec.ts',
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}/editor/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    env: {
      VITE_MAPBOX_PUBLIC_ACCESS: 'pk.fake-public-segment.fake-signature',
      VITE_TEST_INITIAL_PROJECT: 'true',
    },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
