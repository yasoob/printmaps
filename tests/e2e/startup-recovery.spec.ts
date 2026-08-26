import { expect, test } from '@playwright/test';

test('stops after one bootstrap retry and exposes an actionable reload', async ({ page }) => {
  let failedRequests = 0;
  await page.route('**/src/mountApp.tsx', async (route) => {
    failedRequests += 1;
    await route.abort('failed');
  });

  await page.goto('/');

  const alert = page.getByRole('alert', { name: 'Application unavailable' });
  await expect(alert).toContainText('Print Map Studio could not start.');
  await expect(alert.getByRole('button', { name: 'Reload application' })).toBeVisible();
  expect(failedRequests).toBe(2);
});

test('recovers once when the application bootstrap module fails to load', async ({ page }) => {
  let failedRequests = 0;
  await page.route('**/src/mountApp.tsx', async (route) => {
    if (failedRequests === 0) {
      failedRequests += 1;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await page.goto('/');

  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('Autosave ready', { timeout: 15_000 });
  expect(failedRequests).toBe(1);
});
