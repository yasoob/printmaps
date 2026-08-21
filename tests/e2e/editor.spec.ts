import { expect, test } from '@playwright/test';

test('desktop editor switches between project and layer properties', async ({ page, browserName }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Layers sidebar' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Properties sidebar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Map tools' })).toBeVisible();
  if (browserName !== 'firefox') {
    await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  }

  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await expect(page.getByRole('heading', { name: 'Route 01' })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('editor-desktop.png'), fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test('mobile shell has no body-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const metrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport);
  await expect(page.getByRole('navigation', { name: 'Map tools' })).toBeVisible();
});
