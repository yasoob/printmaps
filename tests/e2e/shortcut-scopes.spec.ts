import { expect, test } from '@playwright/test';

test('menus and modal surfaces own keyboard input until they are dismissed', async ({ page }) => {
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const closeExport = page.getByRole('button', { name: 'Close export' });
  for (const key of ['p', 'r', 's', 'v']) {
    await closeExport.press(key);
    await expect(map).toHaveAttribute('data-interaction-mode', 'select');
  }
  await closeExport.click();
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Open project' }).press('p');
  await expect(map).toHaveAttribute('data-interaction-mode', 'select');
  await page.keyboard.press('Escape');
  await page.keyboard.press('p');
  await expect(map).toHaveAttribute('data-interaction-mode', 'pin');
  await page.getByRole('button', { name: 'Cancel POI' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open properties' }).click();
  const closeProperties = page.getByRole('button', { name: 'Close properties' });
  await closeProperties.press('r');
  await expect(map).toHaveAttribute('data-interaction-mode', 'select');
  await closeProperties.click();
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rename project' }).click();
  const cancelRename = page.getByRole('dialog', { name: 'Rename project' }).getByRole('button', { name: 'Cancel' });
  await cancelRename.press('s');
  await expect(map).toHaveAttribute('data-interaction-mode', 'select');
  await cancelRename.press('Escape');

  await page.getByRole('button', { name: 'Route (R)' }).click();
  await page.locator('.maplibregl-canvas').click({ position: { x: 90, y: 200 } });
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('1 point');
  await page.getByRole('button', { name: 'Show route settings' }).click();
  await page.getByRole('button', { name: 'Cancel route' }).click();
  await page.getByRole('button', { name: 'Keep editing' }).press('s');
  await expect(map).toHaveAttribute('data-interaction-mode', 'route');
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('1 point');
});
