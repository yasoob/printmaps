import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('content appearance edits update the live map, history, and layered SVG', async ({ page }, testInfo) => {
  await page.goto('/');
  const mapRoot = page.getByTestId('map-canvas');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so export cannot be exercised.');

  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByLabel('Route color').fill('#112233');
  await page.getByRole('textbox', { name: 'Route width' }).fill('8');
  await page.getByRole('textbox', { name: 'Route width' }).press('Tab');

  await page.getByRole('button', { name: 'Select Coffee stop' }).click();
  await page.getByLabel('POI color').fill('#445566');
  await page.getByRole('textbox', { name: 'POI marker size' }).fill('21');
  await page.getByRole('textbox', { name: 'POI marker size' }).press('Tab');

  await page.getByRole('button', { name: 'Select City center' }).click();
  await page.getByLabel('Shape fill color').fill('#abcdef');
  await page.getByLabel('Shape outline color').fill('#654321');
  await page.getByRole('textbox', { name: 'Shape outline width' }).fill('3');
  await page.getByRole('textbox', { name: 'Shape outline width' }).press('Tab');
  await expect(mapRoot).toHaveAttribute(
    'data-map-layer-appearance',
    'route-01:#112233:8|poi-cafe:#445566:21|area-center:#abcdef:#654321:3',
  );

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('textbox', { name: 'Shape outline width' })).toHaveValue('2');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('textbox', { name: 'Shape outline width' })).toHaveValue('3');

  await page.getByRole('button', { name: 'Export' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export map' })
    .getByRole('button', { name: 'Download layered SVG' })
    .click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath('custom-appearance.layered.svg');
  await download.saveAs(outputPath);
  const svgText = await readFile(outputPath, 'utf8');
  const appearance = await page.evaluate((text) => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
    const route = svg.documentElement.querySelector(':scope [data-layer-id="route-01"] path');
    const poi = svg.documentElement.querySelector(':scope [data-layer-id="poi-cafe"] circle');
    const shape = svg.documentElement.querySelector(':scope [data-layer-id="area-center"] path');
    return {
      route: [route?.getAttribute('stroke'), route?.getAttribute('stroke-width')],
      poi: [poi?.getAttribute('fill'), poi?.getAttribute('r')],
      shape: [
        shape?.getAttribute('fill'),
        shape?.getAttribute('stroke'),
        shape?.getAttribute('stroke-width'),
      ],
    };
  }, svgText);
  expect(appearance).toEqual({
    route: ['#112233', '2.4'],
    poi: ['#445566', '3'],
    shape: ['#abcdef', '#654321', '0.75'],
  });
});
