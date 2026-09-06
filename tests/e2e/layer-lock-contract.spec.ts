import { expect, test } from '@playwright/test';

test('a locked place protects location and deletion but permits name and appearance edits', async ({ page }) => {
  await page.goto('./');
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  await page.getByRole('button', { name: 'Lock Coffee stop' }).click();
  await expect(page.getByRole('textbox', { name: 'POI longitude' })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'POI latitude' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Move Coffee stop' })).toHaveCount(0);
  await expect(page.getByText('Geometry and deletion are locked. Name and appearance remain editable.')).toBeVisible();
  const geometry = await map.getAttribute('data-map-layer-geometry');

  await page.getByRole('textbox', { name: 'Layer name' }).fill('Blue cafe');
  await page.getByLabel('POI color', { exact: true }).fill('#123456');
  await expect(page.getByRole('button', { name: 'Select Blue cafe' })).toBeVisible();
  await expect(map).toHaveAttribute('data-map-layer-appearance', /#123456/);
  await expect(map).toHaveAttribute('data-map-layer-geometry', geometry!);
  await page.getByRole('button', { name: 'Layer menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Replace layer data' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Delete layer' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Duplicate layer' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Select Blue cafe' }).press('Backspace');
  await expect(page.getByRole('button', { name: 'Select Blue cafe' })).toBeVisible();

  await page.getByRole('button', { name: 'Unlock Blue cafe' }).click();
  const longitude = page.getByRole('textbox', { name: 'POI longitude' });
  await expect(longitude).toBeEnabled();
  await longitude.fill('17');
  await longitude.press('Enter');
  await expect(map).not.toHaveAttribute('data-map-layer-geometry', geometry!);
  await page.getByRole('button', { name: 'Layer menu' }).click();
  await page.getByRole('menuitem', { name: 'Delete layer' }).click();
  await expect(page.getByRole('button', { name: 'Select Blue cafe' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByRole('button', { name: 'Lock Route 01' }).click();
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  const routeGeometry = await map.getAttribute('data-map-layer-geometry');
  const marker = page.getByRole('combobox', { name: 'Route marker pictogram' });
  await expect(marker).toBeEnabled();
  await expect(page.getByRole('combobox', { name: 'Route semantic leg' })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Route anchor longitude' })).toBeDisabled();
  await marker.selectOption('air');
  await expect(marker).toHaveValue('air');
  await expect(map).toHaveAttribute('data-map-layer-geometry', routeGeometry!);
});
