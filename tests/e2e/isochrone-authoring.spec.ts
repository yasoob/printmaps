import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const polygon = [[
  [16.34, 48.19],
  [16.41, 48.19],
  [16.42, 48.23],
  [16.36, 48.25],
  [16.34, 48.19],
]];

const isExpectedWebGlDiagnostic = (message: string) => message.includes('GPU stall due to ReadPixels');

test('travel-time area becomes one durable editable and exportable project layer', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const consoleProblems: string[] = [];
  let isochroneRequests = 0;
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          id: 'place.vienna',
          geometry: { type: 'Point', coordinates: [16.3725, 48.2084] },
          properties: { name: 'Vienna', place_formatted: 'Austria' },
        }],
      }),
    });
  });
  await page.route('https://api.mapbox.com/isochrone/v1/mapbox/cycling/16.3725,48.2084**', async (route) => {
    isochroneRequests += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { contour: 20 },
          geometry: { type: 'Polygon', coordinates: polygon },
        }],
      }),
    });
  });

  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Travel time' }).click();

  const search = page.getByRole('combobox', { name: 'Search places and addresses' });
  await search.fill('Vienna');
  await search.press('Enter');
  await page.getByRole('option', { name: 'Vienna, Austria' }).click();
  await expect(page.locator('.isochrone-center')).toContainText('Vienna, Austria');
  await page.getByRole('radio', { name: 'Cycling' }).click();
  await page.getByRole('slider', { name: 'Travel time in minutes' }).fill('20');
  await expect(page.getByText('5 min')).toBeVisible();
  await expect(page.getByText('60 min', { exact: true })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/travel-time-provider-limit-20260826.png' });
  await page.getByRole('button', { name: 'Generate area' }).click();

  const layer = page.getByRole('button', { name: 'Select 20 min cycling area' });
  await expect(layer).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /isochrone-01/);
  expect(isochroneRequests).toBe(1);

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const save = await savePromise;
  const projectPath = testInfo.outputPath('cycling-isochrone.printmap.json');
  await save.saveAs(projectPath);
  const project = JSON.parse(await readFile(projectPath, 'utf8'));
  const savedArea = project.layers.find(({ id }: { id: string }) => id === 'isochrone-01');
  expect(savedArea).toMatchObject({
    name: '20 min cycling area',
    type: 'shape',
    appearance: { kind: 'shape', invert: false, label: '20 min cycling area' },
    geometry: { type: 'Polygon', coordinates: polygon },
    provenance: {
      provider: 'mapbox', service: 'isochrone-v1', center: [16.3725, 48.2084], profile: 'cycling', minutes: 20,
    },
  });

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(layer).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(layer).toBeVisible();
  await expect(page.getByRole('status', { name: 'Autosave status' })).toHaveText('All changes saved locally');
  await page.reload();
  await expect(layer).toBeVisible();
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svg = await svgPromise;
  const svgPath = testInfo.outputPath('cycling-isochrone.layered.svg');
  await svg.saveAs(svgPath);
  const svgText = await readFile(svgPath, 'utf8');
  expect(svgText).toContain('data-layer-id="isochrone-01"');
  expect(svgText).toContain('data-layer-name="20 min cycling area"');
  expect(svgText).toContain('© Mapbox');
  expect(isochroneRequests).toBe(1);
  expect(consoleProblems).toEqual([]);
});
