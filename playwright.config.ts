import { defineConfig, devices } from '@playwright/test';

const isFirefoxDisplayEnabled = process.env.PRINTMAP_FIREFOX_HEADED === '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4175',
    storageState: {
      cookies: [],
      origins: [{
        origin: 'http://127.0.0.1:4175',
        localStorage: [
          'page',
          'map-style',
          'camera-location',
          'map-details',
          'provider-services',
          'technical-export',
        ].map((section) => ({
          name: `print-map-studio:inspector:project:${section}`,
          value: 'open',
        })),
      }],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4175',
    env: {
      VITE_MAPBOX_PUBLIC_ACCESS: 'pk.fake-public-segment.fake-signature',
    },
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        headless: !isFirefoxDisplayEnabled,
        ...(isFirefoxDisplayEnabled && {
          launchOptions: {
            firefoxUserPrefs: {
              'gfx.webrender.all': true,
              'layers.acceleration.force-enabled': true,
              'webgl.disabled': false,
              'webgl.force-enabled': true,
            },
          },
        }),
        viewport: { width: 1440, height: 900 },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
});
