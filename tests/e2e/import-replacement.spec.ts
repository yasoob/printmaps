import { expect, test } from '@playwright/test';

function routeFeature(name: string, offset: number) {
  return {
    name,
    mimeType: 'application/geo+json',
    buffer: Buffer.from(JSON.stringify({
      type: 'Feature',
      properties: { name },
      geometry: { type: 'LineString', coordinates: [[15.9 + offset, 48.1], [16.1 + offset, 48.3]] },
    })),
  };
}

test('replaces selected route geometry in place while retaining identity, styling, and one-step history', async ({ page }, testInfo) => {
  await page.goto('/');
  const mapRoot = page.getByTestId('map-canvas');
  await expect(mapRoot).toHaveAttribute('data-map-layer-geometry', /route-01:/);
  const originalGeometry = await mapRoot.getAttribute('data-map-layer-geometry');
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByLabel('Route color').fill('#112233');
  await page.getByRole('spinbutton', { name: 'Route width' }).fill('8');
  await page.getByRole('spinbutton', { name: 'Route width' }).press('Tab');

  await page.getByRole('button', { name: 'Layer menu' }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Replace layer data' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(routeFeature('replacement.geojson', 0));

  const dialog = page.getByRole('dialog', { name: 'Replace Route 01 data' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Keep Route 01 identity and appearance', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Fit replacement content' })).toBeChecked();
  if (testInfo.project.name === 'chromium') await page.screenshot({ path: 'docs/screenshots/latest-desktop.png' });
  await dialog.getByRole('button', { name: 'Replace Route 01' }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Route 01' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select replacement.geojson' })).toHaveCount(0);
  await expect(page.getByLabel('Route color')).toHaveValue('#112233');
  await expect(page.getByRole('spinbutton', { name: 'Route width' })).toHaveValue('8');
  await expect(mapRoot).toHaveAttribute('data-map-layer-geometry', /route-01:\[\[15\.9,48\.1\],\[16\.1,48\.3\]\]/);
  await expect(mapRoot).toHaveAttribute('data-camera-fit-import', '1');
  await expect(page.getByRole('status', { name: 'Map data import status' }))
    .toHaveText('Replaced Route 01 data. Undo restores the previous geometry.');
  await expect(page.getByRole('button', { name: 'Layer menu' })).toBeFocused();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(mapRoot).toHaveAttribute('data-map-layer-geometry', originalGeometry ?? '');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(mapRoot).toHaveAttribute('data-map-layer-geometry', /route-01:\[\[15\.9,48\.1\],\[16\.1,48\.3\]\]/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open properties' }).click();
  await page.getByRole('button', { name: 'Layer menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Replace layer data' })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test('rejects a multi-file layer replacement without partially changing the project', async ({ page }) => {
  await page.goto('/');
  const mapRoot = page.getByTestId('map-canvas');
  await expect(mapRoot).toHaveAttribute('data-map-layer-geometry', /route-01:/);
  const originalGeometry = await mapRoot.getAttribute('data-map-layer-geometry');
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByRole('button', { name: 'Layer menu' }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Replace layer data' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles([
    routeFeature('first.geojson', 0),
    routeFeature('second.geojson', 0.1),
  ]);

  const dialog = page.getByRole('dialog', { name: 'Replace Route 01 data' });
  await expect(dialog.getByRole('alert')).toHaveText('Replace Route 01 with one file containing exactly one route feature. Nothing was changed.');
  await expect(dialog.getByRole('button', { name: 'Replace Route 01' })).toHaveCount(0);
  await expect(mapRoot).toHaveAttribute('data-map-layer-geometry', originalGeometry ?? '');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});
