import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test('searched address becomes one durable editable and exportable POI', async ({ page }) => {
  const consoleProblems: string[] = [];
  let searchRequests = 0;
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('GPU stall due to ReadPixels')) consoleProblems.push(message.text());
  });
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    searchRequests += 1;
    expect(new URL(route.request().url()).searchParams.get('access_token')).toMatch(/^pk\./);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          id: 'address.cafe-central',
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [16.365, 48.2105] },
          properties: { name: 'Café Central', place_formatted: 'Herrengasse 14, Vienna' },
        }],
      }),
    });
  });

  await page.goto('./');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'The Chromium fixture has no WebGL 2 renderer.');
  await expect(page.getByRole('button', { name: 'Provider services' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Check.*connection/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Place (P)' }).click();
  const search = page.getByRole('combobox', { name: 'Search places and addresses' });
  await search.fill('Café Central');
  await page.getByRole('button', { name: 'Search locations' }).click();
  await page.getByRole('option', { name: 'Café Central, Herrengasse 14, Vienna' }).click();

  const layer = page.getByRole('button', { name: 'Select Café Central, Herrengasse 14, Vienna' });
  await expect(layer).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('textbox', { name: 'POI label' })).toHaveValue('Café Central, Herrengasse 14, Vienna');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible();
  expect(searchRequests).toBe(1);

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const save = await savePromise;
  const projectPath = test.info().outputPath('searched-poi.printmap.json');
  await save.saveAs(projectPath);
  const project = JSON.parse(await readFile(projectPath, 'utf8'));
  const savedPoi = project.layers.find(({ id }: { id: string }) => id === 'poi-01');
  expect(project.schemaVersion).toBe(24);
  expect(savedPoi).toMatchObject({
    name: 'Café Central, Herrengasse 14, Vienna',
    type: 'poi',
    geometry: { type: 'Point', coordinates: [16.365, 48.2105] },
    provenance: {
      provider: 'mapbox', service: 'geocoding-v6', providerFeatureId: 'address.cafe-central',
    },
  });

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(layer).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(layer).toBeVisible();

  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svg = await svgPromise;
  const svgPath = test.info().outputPath('searched-poi.layered.svg');
  await svg.saveAs(svgPath);
  const svgText = await readFile(svgPath, 'utf8');
  expect(svgText).toContain('data-layer-id="poi-01"');
  expect(svgText).toContain('© Mapbox');
  expect(searchRequests).toBe(1);
  await dialog.getByRole('button', { name: 'Close export' }).click();
  await layer.click();
  await expect(page.getByRole('textbox', { name: 'POI label' })).toHaveValue('Café Central, Herrengasse 14, Vienna');

  await page.screenshot({ path: path.resolve('docs/screenshots/search-poi-20260826.png') });
  expect(await page.evaluate(() => document.body.scrollWidth - document.body.clientWidth)).toBe(0);
  expect(consoleProblems).toEqual([]);
});
