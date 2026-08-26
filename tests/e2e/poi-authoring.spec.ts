import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('POI placement can be cancelled, undone, redone, and exported as vector content', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so map authoring cannot be exercised.');

  await page.getByRole('button', { name: 'Pin (P)' }).click();
  await expect(page.getByRole('status', { name: 'POI placement status' })).toContainText('Click the map to place a POI');
  await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel POI' }).click();
  await expect(page.getByRole('button', { name: 'Select (V)' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Select POI 01' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Pin (P)' }).click();
  const canvas = page.locator('.maplibregl-canvas');
  const canvasBox = await canvas.boundingBox();
  const frameBox = await page.locator('.print-frame').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  await canvas.click({
    position: {
      x: frameBox!.x - canvasBox!.x + frameBox!.width * 0.55,
      y: frameBox!.y - canvasBox!.y + frameBox!.height * 0.45,
    },
  });

  const createdPoi = page.getByRole('button', { name: 'Select POI 01' });
  await expect(createdPoi).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /poi-01/);
  await expect(page.getByRole('button', { name: 'Select (V)' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(createdPoi).not.toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(createdPoi).toBeVisible();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /poi-01/);

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const downloadButton = exportDialog.getByRole('button', { name: 'Download layered SVG' });
  await expect(downloadButton).toBeEnabled({ timeout: 20_000 });
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath('poi-authoring.layered.svg');
  await download.saveAs(outputPath);
  const svg = await readFile(outputPath, 'utf8');
  expect(svg).toContain('data-layer-name="POI 01"');
  expect(svg).toMatch(/data-layer-id="poi-01"[^>]*>[\s\S]*?<circle /);
  expect(consoleProblems).toEqual([]);
});

test('pasted address rows become one durable geocoded POI batch', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const consoleProblems: string[] = [];
  const queries: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? '';
    queries.push(query);
    const isCafe = query.startsWith('Herrengasse');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          id: isCafe ? 'address.cafe' : 'address.museum',
          geometry: { type: 'Point', coordinates: isCafe ? [16.365, 48.2105] : [16.3599, 48.2034] },
          properties: { full_address: isCafe ? 'Café Central, Vienna' : 'MuseumsQuartier, Vienna' },
        }],
      }),
    });
  });

  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Pin (P)' }).click();
  await page.getByRole('button', { name: 'Paste POI list' }).click();
  await page.getByRole('radio', { name: 'Addresses' }).click();
  await page.getByRole('textbox', { name: 'POI spreadsheet rows' }).fill(
    'Name\tAddress\nCafé Central\tHerrengasse 14, Vienna\nMuseum Quarter\tMuseumsplatz 1, Vienna',
  );
  await page.getByRole('button', { name: 'Find and add POIs' }).click();

  const firstPoi = page.getByRole('button', { name: 'Select Café Central' });
  const secondPoi = page.getByRole('button', { name: 'Select Museum Quarter' });
  await expect(firstPoi).toHaveAttribute('aria-current', 'true');
  await expect(secondPoi).toBeVisible();
  expect(queries).toEqual(['Herrengasse 14, Vienna', 'Museumsplatz 1, Vienna']);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const download = await downloadPromise;
  const projectPath = testInfo.outputPath('geocoded-pois.printmap.json');
  await download.saveAs(projectPath);
  const project = JSON.parse(await readFile(projectPath, 'utf8'));
  const pois = project.layers.filter(({ id }: { id: string }) => ['poi-01', 'poi-02'].includes(id));
  expect(pois).toMatchObject([
    { name: 'Café Central', geometry: { coordinates: [16.365, 48.2105] }, provenance: { provider: 'mapbox', service: 'geocoding-v6', providerFeatureId: 'address.cafe' } },
    { name: 'Museum Quarter', geometry: { coordinates: [16.3599, 48.2034] }, provenance: { provider: 'mapbox', service: 'geocoding-v6', providerFeatureId: 'address.museum' } },
  ]);

  await page.screenshot({ path: 'docs/screenshots/batch-address-geocoding-20260826.png' });
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(firstPoi).toHaveCount(0);
  await expect(secondPoi).toHaveCount(0);
  expect(consoleProblems).toEqual([]);
});

test('pasted POI rows create one responsive undoable batch', async ({ page }) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so batch POIs cannot be verified on the map.');

  await page.getByRole('button', { name: 'Pin (P)' }).click();
  await page.getByRole('button', { name: 'Paste POI list' }).click();
  const spreadsheet = page.getByRole('textbox', { name: 'POI spreadsheet rows' });
  await expect(spreadsheet).toBeFocused();
  await spreadsheet.fill('Broken row');
  await page.getByRole('button', { name: 'Add POIs' }).click();
  await expect(page.getByText(/Spreadsheet row 1/iu)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

  await spreadsheet.fill('Name\tLongitude\tLatitude\nCafé Central\t16.3725\t48.2084\nMuseum Quarter\t16.3599\t48.2034');
  await page.getByRole('button', { name: 'Add POIs' }).click();
  const firstPoi = page.getByRole('button', { name: 'Select Café Central' });
  const secondPoi = page.getByRole('button', { name: 'Select Museum Quarter' });
  await expect(firstPoi).toHaveAttribute('aria-current', 'true');
  await expect(secondPoi).toBeVisible();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /poi-01,poi-02/);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(firstPoi).toHaveCount(0);
  await expect(secondPoi).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(firstPoi).toBeVisible();
  await expect(secondPoi).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Pin (P)' }).click();
  await page.getByRole('button', { name: 'Paste POI list' }).click();
  const panel = page.locator('.poi-spreadsheet-panel');
  await expect(panel).toBeVisible();
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBe(0);
  await page.getByRole('button', { name: 'Cancel list' }).click();
  await expect(page.getByRole('button', { name: 'Paste POI list' })).toBeFocused();
  expect(consoleProblems).toEqual([]);
});
