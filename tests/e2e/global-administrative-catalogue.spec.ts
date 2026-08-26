import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isExpectedWebGlDiagnostic = (message: string) => message.includes('GPU stall due to ReadPixels');

test('generated worldwide catalogue lazily creates a durable Japanese region', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  const country = page.getByRole('combobox', { name: 'Region country' });
  await expect(country.locator('option')).toHaveCount(251);
  await expect(page.getByText('251 countries have regional boundaries. 7 countries are available at Country level only.')).toBeVisible();
  await country.selectOption('JPN');

  const regions = page.getByRole('group', { name: 'Japan regions' });
  await expect(page.getByRole('status', { name: 'Administrative catalogue status' })).toHaveText('47 Japan regions loaded.');
  await expect(regions.getByRole('checkbox')).toHaveCount(47);
  await regions.getByRole('checkbox', { name: 'Kyōto Prefecture' }).check();
  await expect(page.getByText('1 region selected')).toBeVisible();
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/global-region-coverage-20260826.png' });
  }
  await page.getByRole('button', { name: 'Add selected area' }).click();

  const layer = page.getByRole('button', { name: 'Select Kyōto Prefecture' });
  await expect(layer).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-jp-26:/);

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('japan-region.printmap.json');
  await save.saveAs(savePath);
  const project = JSON.parse(await readFile(savePath, 'utf8'));
  const savedRegion = project.layers.find(({ id }: { id: string }) => id === 'admin-jp-26');
  expect(savedRegion).toMatchObject({ name: 'Kyōto Prefecture', geometry: { type: 'Polygon' } });

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svg = await svgPromise;
  const svgPath = testInfo.outputPath('japan-region.layered.svg');
  await svg.saveAs(svgPath);
  expect(await readFile(svgPath, 'utf8')).toContain('data-layer-name="Kyōto Prefecture"');
  expect(consoleProblems).toEqual([]);
});

test('generated worldwide catalogue lazily creates a durable country', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Area (S)' }).click();
  const country = page.getByRole('combobox', { name: 'Administrative area' });
  await expect(country.locator('option')).toHaveCount(258);
  await country.selectOption('IND');
  await expect(page.getByRole('status', { name: 'Administrative country status' })).toHaveText('India boundary loaded.');
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/global-india-country-catalogue-20260826.png' });
  }
  await page.getByRole('button', { name: 'Add administrative area' }).click();

  const layer = page.getByRole('button', { name: 'Select India' });
  await expect(layer).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-ind:/);

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('india-country.printmap.json');
  await save.saveAs(savePath);
  const project = JSON.parse(await readFile(savePath, 'utf8'));
  const savedCountry = project.layers.find(({ id }: { id: string }) => id === 'admin-ind');
  expect(savedCountry).toMatchObject({ name: 'India' });
  expect(['Polygon', 'MultiPolygon']).toContain(savedCountry.geometry.type);

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svg = await svgPromise;
  const svgPath = testInfo.outputPath('india-country.layered.svg');
  await svg.saveAs(svgPath);
  expect(await readFile(svgPath, 'utf8')).toContain('data-layer-name="India"');
  expect(consoleProblems).toEqual([]);
});

test('generated region picker stays fail-closed when the selected shard is unavailable', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.route('**/data/administrative/index.json', async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      schemaVersion: 1,
      sourceVersion: 'Natural Earth 5.1.1',
      countries: [
        { id: 'AUT', name: 'Austria', bounds: [9, 46, 17, 50], levels: ['country', 'region'], shard: 'countries/AUT.json' },
      ],
    }),
  }));
  await page.route('**/data/administrative/countries/AUT.json', async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ schemaVersion: 999, country: {}, regions: [] }),
  }));

  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');

  await expect(page.getByRole('status', { name: 'Administrative catalogue status' }))
    .toHaveText('Austria boundaries unavailable. Austria boundary data version is unsupported.');
  await expect(page.getByRole('group', { name: 'Austria regions' }).getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add selected area' })).toBeDisabled();
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/global-region-shard-unavailable-20260826.png' });
  }
  expect(consoleProblems).toEqual([]);
});
