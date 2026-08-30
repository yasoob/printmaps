import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

function providerGeometry(requestUrl: string): [number, number][] {
  const url = new URL(requestUrl);
  const encodedCoordinates = url.pathname.split('/').at(-1);
  if (!encodedCoordinates) throw new Error('Directions request has no coordinates.');
  const waypoints = decodeURIComponent(encodedCoordinates).split(';').map((value) => (
    value.split(',').map(Number) as [number, number]
  ));
  return waypoints.flatMap((waypoint, index) => {
    if (index === 0) return [waypoint];
    const previous = waypoints[index - 1];
    return [
      [(previous[0] + waypoint[0]) / 2 + 0.003, (previous[1] + waypoint[1]) / 2] as [number, number],
      waypoint,
    ];
  });
}

test('road route edits semantic waypoints by rerouting and exports offline', async ({ page }) => {
  const consoleProblems: string[] = [];
  let directionRequests = 0;
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('GPU stall due to ReadPixels')) consoleProblems.push(message.text());
  });
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? '';
    const isWest = query.includes('West');
    const isNorth = query.includes('North');
    const name = isWest ? 'Vienna West' : (isNorth ? 'Vienna North' : 'Vienna East');
    const coordinates = isWest ? [16.31, 48.19] : (isNorth ? [16.38, 48.28] : [16.4, 48.24]);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          id: `place.${name.toLowerCase().replaceAll(' ', '-')}`,
          type: 'Feature',
          geometry: { type: 'Point', coordinates },
          properties: {
            name,
            place_formatted: 'Austria',
          },
        }],
      }),
    });
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
  await page.goto('./');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'The Chromium fixture has no WebGL 2 renderer.');

  await page.getByRole('button', { name: 'Route (R)' }).click();
  const roadPath = page.getByRole('radio', { name: 'Road', exact: true });
  await roadPath.click();
  await expect(roadPath).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('Click the map to add route points');
  const search = page.getByRole('combobox', { name: 'Search places and addresses' });
  await search.fill('Vienna West');
  await page.getByRole('button', { name: 'Search locations' }).click();
  await page.getByRole('option', { name: 'Vienna West, Austria' }).click();
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('1 point');
  await search.fill('Vienna East');
  await page.getByRole('button', { name: 'Search locations' }).click();
  await page.getByRole('option', { name: 'Vienna East, Austria' }).click();
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('2 points');
  await page.getByRole('button', { name: 'Finish route' }).click();

  await expect.poll(() => directionRequests).toBe(1);
  await expect(page.getByRole('button', { name: 'Select Route 02' })).toHaveAttribute('aria-current', 'true');
  expect(consoleProblems).toEqual([]);
  await expect(page.getByText('Mapbox Directions')).toBeVisible();
  await expect(page.getByText('9.2 km · 22 min · 2 waypoints')).toBeVisible();
  expect(directionRequests).toBe(1);

  await page.getByRole('button', { name: /Advanced/ }).click();
  const firstLongitude = page.getByRole('textbox', { name: 'Route waypoint longitude' });
  const originalLongitude = Number(await firstLongitude.inputValue());
  await firstLongitude.fill(String(originalLongitude + 0.001));
  await firstLongitude.press('Tab');
  await expect.poll(() => directionRequests).toBe(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Redo' }).click();

  const projectDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const projectDownload = await projectDownloadPromise;
  const projectPath = test.info().outputPath('road-route.printmap.json');
  await projectDownload.saveAs(projectPath);
  const project = JSON.parse(await readFile(projectPath, 'utf8'));
  const routeLayer = project.layers.find((layer: { id: string }) => layer.id === 'route-02');
  expect(project.schemaVersion).toBe(24);
  expect(routeLayer).toMatchObject({
    route: { kind: 'road', closed: false },
    appearance: {
      kind: 'route',
      marker: null,
      segmentStyles: [null],
    },
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
  expect(directionRequests).toBe(2);
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Close export' }).click();

  await page.getByRole('button', { name: 'Extend end' }).click();
  const mapCanvas = page.getByTestId('map-canvas');
  const layerOrder = async () => {
    const order = await mapCanvas.getAttribute('data-map-layer-order');
    return order?.split(',') ?? [];
  };
  await expect.poll(layerOrder).toContain('route-draft');
  expect(await layerOrder()).not.toContain('route-02');
  await search.fill('Vienna North');
  await page.getByRole('button', { name: 'Search locations' }).click();
  await page.getByRole('option', { name: 'Vienna North, Austria' }).click();
  await expect.poll(layerOrder).toContain('route-draft');
  expect(await layerOrder()).not.toContain('route-02');
  await expect(page.getByRole('button', { name: 'Road Preview' })).not.toBeVisible();
  expect(directionRequests).toBe(2);

  await page.getByRole('button', { name: 'Finish route' }).click();
  await expect(page.getByRole('button', { name: 'Select Route 02' })).toHaveAttribute('aria-current', 'true');
  await expect.poll(layerOrder).toContain('route-02');
  expect(await layerOrder()).not.toContain('route-draft');
  expect(directionRequests).toBe(3);

  await page.screenshot({ path: test.info().outputPath('road-routing-search.png') });
  expect(await page.evaluate(() => document.body.scrollWidth - document.body.clientWidth)).toBe(0);
  expect(consoleProblems).toEqual([]);
});
