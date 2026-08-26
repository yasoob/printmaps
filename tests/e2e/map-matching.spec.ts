import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const matched = [
  [16.3261, 48.1941], [16.34, 48.201], [16.36, 48.21], [16.4, 48.219], [16.4291, 48.2261],
];

const isExpectedWebGlDiagnostic = (message: string) => message.includes('GPU stall due to ReadPixels');

test('selected route matches to roads and remains durable editable and exportable', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const consoleProblems: string[] = [];
  let matchingRequests = 0;
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.route('https://api.mapbox.com/matching/v5/mapbox/driving/**', async (route) => {
    matchingRequests += 1;
    const url = new URL(route.request().url());
    expect(url.searchParams.get('geometries')).toBe('geojson');
    expect(url.searchParams.get('overview')).toBe('full');
    expect(url.searchParams.get('tidy')).toBe('true');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'Ok',
        matchings: [{ confidence: 0.93, geometry: { type: 'LineString', coordinates: matched } }],
      }),
    });
  });

  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByRole('button', { name: /Advanced/ }).click();
  const snapButton = page.getByRole('button', { name: 'Snap route to roads' });
  const matchingGuidance = page.getByText('Mapbox Map Matching uses 2–100 route points. The committed result remains editable and exportable offline.');
  const [buttonBox, guidanceBox] = await Promise.all([snapButton.boundingBox(), matchingGuidance.boundingBox()]);
  expect(buttonBox).not.toBeNull();
  expect(guidanceBox).not.toBeNull();
  expect(guidanceBox!.y - (buttonBox!.y + buttonBox!.height)).toBeGreaterThanOrEqual(6);
  await snapButton.click();

  await expect(page.getByText('Matched to roads · 93% confidence · 4 source points')).toBeVisible();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /route-01:.*16\.3261/);
  expect(matchingRequests).toBe(1);
  await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/map-matching-20260826.png' });

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const save = await savePromise;
  const projectPath = testInfo.outputPath('map-matched.printmap.json');
  await save.saveAs(projectPath);
  const project = JSON.parse(await readFile(projectPath, 'utf8'));
  const savedRoute = project.layers.find(({ id }: { id: string }) => id === 'route-01');
  expect(project.schemaVersion).toBe(21);
  expect(savedRoute).toMatchObject({
    geometry: { type: 'LineString', coordinates: matched },
    provenance: {
      provider: 'mapbox', service: 'map-matching-v5', profile: 'driving', confidence: 0.93, sourcePointCount: 4,
    },
  });

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Matched to roads · 93% confidence · 4 source points')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByText('Matched to roads · 93% confidence · 4 source points')).toBeVisible();

  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svg = await svgPromise;
  const svgPath = testInfo.outputPath('map-matched.layered.svg');
  await svg.saveAs(svgPath);
  const svgText = await readFile(svgPath, 'utf8');
  expect(svgText).toContain('data-layer-id="route-01"');
  expect(svgText).toContain('© Mapbox');
  expect(matchingRequests).toBe(1);
  expect(await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  expect(consoleProblems).toEqual([]);
});
