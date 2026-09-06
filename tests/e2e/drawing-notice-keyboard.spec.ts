import { expect, test } from '@playwright/test';

test('Enter expands the unsaved-drawing notice instead of committing a route', async ({ page }) => {
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Route (R)' }).click();
  const canvas = page.locator('.maplibregl-canvas');
  await canvas.click({ position: { x: 250, y: 250 } });
  await canvas.click({ position: { x: 400, y: 250 } });
  const notice = page.locator('.unfinished-drawing-notice');
  await notice.locator('summary').press('Enter');
  await expect(notice).toHaveAttribute('open', '');
  await expect(map).toHaveAttribute('data-interaction-mode', 'route');
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('2 points');
  await expect(page.getByRole('button', { name: 'Select Route 02' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await notice.locator('summary').press('Enter');
  await canvas.press('Enter');
  await expect(page.getByRole('button', { name: 'Select Route 02' })).toBeVisible();
});
