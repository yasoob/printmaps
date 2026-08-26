import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

function providerGeometry(requestUrl: string): [number, number][] {
  const url = new URL(requestUrl);
  const encodedCoordinates = url.pathname.split('/').at(-1);
  if (!encodedCoordinates) throw new Error('Directions request has no coordinates.');
  const [start, end] = decodeURIComponent(encodedCoordinates).split(';').map((value) => (
    value.split(',').map(Number) as [number, number]
  ));
  return [start, [(start[0] + end[0]) / 2 + 0.003, (start[1] + end[1]) / 2], end];
}

test('road route becomes editable canonical project geometry and exports offline', async ({ page }) => {
  const consoleProblems: string[] = [];
  let directionRequests = 0;
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('GPU stall due to ReadPixels')) consoleProblems.push(message.text());
  });
  await page.route('https://api.mapbox.com/directions/v5/mapbox/**', async (route) => {
    directionRequests += 1;
    const coordinates = providerGeometry(route.request().url());
    const body = {
      code: 'Ok',
      routes: [{ distance: 9200, duration: 1320, geometry: { type: 'LineString', coordinates } }],
    };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'The Chromium fixture has no WebGL 2 renderer.');

  await page.getByRole('button', { name: 'Route (R)' }).click();
  const roadPath = page.getByRole('radio', { name: 'Road', exact: true });
  await roadPath.click();
  await expect(roadPath).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('Road route');
  const canvas = page.locator('.maplibregl-canvas');
  const canvasBox = await canvas.boundingBox();
  const frameBox = await page.locator('.print-frame').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  const point = (xFraction: number, yFraction: number) => ({
    x: frameBox!.x - canvasBox!.x + frameBox!.width * xFraction,
    y: frameBox!.y - canvasBox!.y + frameBox!.height * yFraction,
  });
  await canvas.click({ position: point(0.3, 0.6) });
  await canvas.click({ position: point(0.7, 0.4) });
  await page.getByRole('button', { name: 'Finish route' }).click();

  await expect.poll(() => directionRequests).toBe(1);
  await expect(page.getByRole('button', { name: 'Select Route 02' })).toHaveAttribute('aria-current', 'true');
  expect(consoleProblems).toEqual([]);
  await expect(page.getByText('Mapbox Directions')).toBeVisible();
  await expect(page.getByText('9.2 km · 22 min · 2 waypoints')).toBeVisible();
  expect(directionRequests).toBe(1);

  const firstLongitude = page.getByRole('textbox', { name: 'Route vertex longitude' });
  const originalLongitude = Number(await firstLongitude.inputValue());
  await firstLongitude.fill(String(originalLongitude + 0.001));
  await firstLongitude.press('Tab');
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Redo' }).click();

  const projectDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const projectDownload = await projectDownloadPromise;
  const projectPath = test.info().outputPath('road-route.printmap.json');
  await projectDownload.saveAs(projectPath);
  const project = JSON.parse(await readFile(projectPath, 'utf8'));
  const routeLayer = project.layers.find((layer: { id: string }) => layer.id === 'route-02');
  expect(project.schemaVersion).toBe(19);
  expect(routeLayer).toMatchObject({
    geometry: { type: 'LineString' },
    provenance: {
      provider: 'mapbox', service: 'directions-v5', profile: 'driving',
      distanceMeters: 9200, durationSeconds: 1320,
    },
  });
  expect(routeLayer.provenance.waypoints).toHaveLength(2);

  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('radio', { name: /Layered SVG/ }).click();
  const svgDownloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Download layered SVG' }).click();
  const svgDownload = await svgDownloadPromise;
  const svgPath = test.info().outputPath('road-route.layered.svg');
  await svgDownload.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  expect(svg).toContain('data-layer-id="route-02"');
  expect(svg).toContain('© Mapbox');
  expect(directionRequests).toBe(1);
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Close export' }).click();

  await page.screenshot({ path: path.resolve('docs/screenshots/road-routing-20260826.png') });
  expect(await page.evaluate(() => document.body.scrollWidth - document.body.clientWidth)).toBe(0);
  expect(consoleProblems).toEqual([]);
});
