import { expect, test } from '@playwright/test';

const PUBLIC_TEST_TOKEN = 'pk.fake-public-segment.fake-signature';
const isExpectedBrowserDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('server responded with a status of 403')
);

test('Mapbox public-token origin check fails actionably and succeeds on retry', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  let attempts = 0;
  page.on('pageerror', (error) => {
    consoleProblems.push(error.message);
  });
  page.on('console', (message) => {
    if (
      (message.type() === 'error' || message.type() === 'warning')
      && !isExpectedBrowserDiagnostic(message.text())
    ) consoleProblems.push(message.text());
  });
  await page.route('https://api.mapbox.com/styles/v1/mapbox/streets-v12**', async (route) => {
    attempts += 1;
    expect(route.request().url()).toContain(`access_token=${PUBLIC_TEST_TOKEN}`);
    expect(route.request().headers().referer).toContain('http://127.0.0.1:4175/');
    if (attempts === 1) {
      await route.fulfill({ body: '{}', contentType: 'application/json', status: 403 });
      return;
    }
    await route.fulfill({ body: JSON.stringify({ version: 8 }), contentType: 'application/json', status: 200 });
  });

  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser runtime has no WebGL 2 renderer, so the live-map configuration flow cannot be verified.');
  await expect(mapReady).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mapbox services' })).toBeVisible();
  await expect(page.getByText(PUBLIC_TEST_TOKEN)).toHaveCount(0);

  await page.getByRole('button', { name: 'Check Mapbox connection' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Check token scopes and URL restrictions');
  await expect(alert).toContainText('http://127.0.0.1:4175');

  await page.getByRole('button', { name: 'Retry Mapbox connection' }).click();
  await expect(page.locator('.mapbox-service-status[role="status"]')).toContainText(
    'Mapbox accepted this public token from http://127.0.0.1:4175',
  );
  await expect(page.getByText(PUBLIC_TEST_TOKEN)).toHaveCount(0);
  await expect(mapReady).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mapbox-configuration.png'), fullPage: true });
  expect(attempts).toBe(2);
  expect(consoleProblems).toEqual([]);
});
