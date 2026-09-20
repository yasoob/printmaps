import { defineConfig, devices } from '@playwright/test';

const port = process.env.PLAYWRIGHT_EDITOR_PORT ?? '4193';

export default defineConfig({
  testDir: './tests/sharing-production',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}/editor/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run build && npx astro preview --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
