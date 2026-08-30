import { expect, test } from '@playwright/test';
import {
  basicRouteProject,
  convertRoute,
  downloadLayeredSvg,
  downloadPdf,
  downloadProject,
  expectNear,
  installDirectionsMock,
  markerParityProject,
  openAdvanced,
  openProject,
  routeLayer,
  svgMetrics,
  waitForMap,
} from './advanced-route-test-support';

async function setFirstTwoLegStyles(page: Parameters<typeof openAdvanced>[0]) {
  const leg = page.getByRole('combobox', { name: 'Route semantic leg' });
  await leg.selectOption('0');
  await page.getByRole('checkbox', { name: 'Inherit route segment color' }).uncheck();
  await page.getByRole('checkbox', { name: 'Inherit route segment width' }).uncheck();
  await page.getByRole('checkbox', { name: 'Inherit route segment line style' }).uncheck();
  await page.locator('input[aria-label="Route segment color"]').fill('#112233');
  await page.getByRole('spinbutton', { name: 'Route segment width' }).fill('7');
  await page.getByRole('combobox', { name: 'Route segment line style' })
    .selectOption('dashed');
  await leg.selectOption('1');
  await page.getByRole('checkbox', { name: 'Inherit route segment color' }).uncheck();
  await page.locator('input[aria-label="Route segment color"]').fill('#abcdef');
}

function reversedCopy<T>(values: readonly T[]): T[] {
  return values.map((_, index) => values[values.length - index - 1]!);
}

test('converts every route-kind pair and atomically remaps local structure', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const directions = await installDirectionsMock(page);
  await page.goto('/');
  await waitForMap(page);
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await openAdvanced(page);
  await setFirstTwoLegStyles(page);
  const beforeDownload = await downloadProject(page, testInfo, 'conversion-before');
  const before = routeLayer(beforeDownload.project);
  const originalStyles = structuredClone(before.appearance?.kind === 'route'
    ? before.appearance.segmentStyles
    : []);

  await convertRoute(page, 'arc');
  await expect(page.getByText('Curvature', { exact: true })).toBeVisible();
  await convertRoute(page, 'straight');
  await expect(page.getByText('Road matching', { exact: true })).toBeVisible();
  await convertRoute(page, 'road', 'bike');
  expect(directions.requests.at(-1)).toContain('/cycling/');
  await convertRoute(page, 'straight');
  await expect(page.getByText('Mapbox Directions')).not.toBeVisible();
  await convertRoute(page, 'arc');
  await convertRoute(page, 'road', 'walk');
  expect(directions.requests.at(-1)).toContain('/walking/');
  await convertRoute(page, 'arc');

  const preReverseDownload = await downloadProject(page, testInfo, 'conversion-pre-reverse');
  const preReverse = routeLayer(preReverseDownload.project);
  expect(preReverse.route).toEqual({ kind: 'arc', closed: false });
  expect(preReverse.appearance?.kind === 'route'
    ? preReverse.appearance.segmentStyles
    : []).toEqual(originalStyles);
  const preReversePoints = preReverse.geometry?.type === 'Arc'
    ? preReverse.geometry.anchors
    : [];

  await page.getByRole('button', { name: 'Reverse', exact: true }).click();
  await page.getByRole('button', { name: 'Close loop' }).click();
  await expect(page.getByRole('button', { name: 'Open loop' })).toBeVisible();
  await page.getByRole('button', { name: 'Open loop' }).click();
  await expect(page.getByRole('button', { name: 'Close loop' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Open loop' })).toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('button', { name: 'Close loop' })).toBeVisible();

  const saved = await downloadProject(page, testInfo, 'conversion-saved');
  const transformed = routeLayer(saved.project);
  expect(transformed.route).toEqual({ kind: 'arc', closed: false });
  expect(transformed.geometry?.type === 'Arc'
    ? transformed.geometry.anchors
    : []).toEqual(reversedCopy(preReversePoints));
  expect(transformed.appearance?.kind === 'route'
    ? transformed.appearance.segmentStyles
    : []).toEqual(reversedCopy(originalStyles));

  await page.getByRole('combobox', { name: 'Route line style' }).selectOption('dashed');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Project' }).click();
  await page.getByRole('menuitem', { name: 'Open project' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(saved.path);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await openAdvanced(page);
  await expect(page.getByRole('combobox', { name: 'Route line style' }))
    .toHaveValue('solid');
  await expect(page.getByText('Curvature', { exact: true })).toBeVisible();
});

test('retains failed choices, rejects stale responses, and reroutes Road structure', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const directions = await installDirectionsMock(page);
  directions.setMode('fail');
  await page.goto('/');
  await waitForMap(page);
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await openAdvanced(page);
  const map = page.getByTestId('map-canvas');
  const originalGeometry = await map.getAttribute('data-map-layer-geometry');
  await page.getByRole('combobox', { name: 'Convert route to' }).selectOption('road');
  await page.getByRole('combobox', { name: 'Road conversion travel mode' })
    .selectOption('walk');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await page.getByRole('button', { name: 'Route and apply' }).click();
  await expect(page.getByRole('alert')).toContainText('Mapbox is temporarily unavailable');
  await expect(page.getByRole('combobox', { name: 'Convert route to' })).toHaveValue('road');
  await expect(page.getByRole('combobox', { name: 'Road conversion travel mode' }))
    .toHaveValue('walk');
  await expect(map).toHaveAttribute('data-map-layer-geometry', originalGeometry!);

  directions.setMode('success');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Mapbox Directions')).toBeVisible();
  const beforeDownload = await downloadProject(page, testInfo, 'road-before-reverse');
  const roadBefore = routeLayer(beforeDownload.project);
  const waypoints = roadBefore.provenance?.service === 'directions-v5'
    ? roadBefore.provenance.waypoints
    : [];

  await page.getByRole('button', { name: 'Reverse', exact: true }).click();
  await page.getByRole('button', { name: 'Route and apply' }).click();
  await expect.poll(() => directions.requests.length).toBe(3);
  let roadDownload = await downloadProject(page, testInfo, 'road-reversed');
  let road = routeLayer(roadDownload.project);
  expect(road.provenance?.service === 'directions-v5'
    ? road.provenance.waypoints
    : []).toEqual(reversedCopy(waypoints));

  await page.getByRole('button', { name: 'Close loop' }).click();
  await page.getByRole('button', { name: 'Route and apply' }).click();
  await expect(page.getByRole('button', { name: 'Open loop' })).toBeVisible();
  roadDownload = await downloadProject(page, testInfo, 'road-closed');
  road = routeLayer(roadDownload.project);
  const closedWaypoints = road.provenance?.service === 'directions-v5'
    ? road.provenance.waypoints
    : [];
  expect(closedWaypoints.at(-1)).toEqual(closedWaypoints[0]);

  await page.getByRole('button', { name: 'Open loop' }).click();
  await page.getByRole('button', { name: 'Route and apply' }).click();
  await expect(page.getByRole('button', { name: 'Close loop' })).toBeVisible();
  roadDownload = await downloadProject(page, testInfo, 'road-opened');
  road = routeLayer(roadDownload.project);
  expect(road.route?.closed).toBe(false);

  await convertRoute(page, 'straight');
  const straightGeometry = await map.getAttribute('data-map-layer-geometry');
  directions.setMode('hold');
  await page.getByRole('combobox', { name: 'Convert route to' }).selectOption('road');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await page.getByRole('button', { name: 'Route and apply' }).click();
  await expect.poll(() => directions.requests.length).toBe(6);
  await page.getByRole('spinbutton', { name: 'Route width' }).fill('5');
  await page.getByRole('spinbutton', { name: 'Route width' }).press('Tab');
  directions.release();
  await page.waitForTimeout(100);
  await expect(map).toHaveAttribute('data-map-layer-geometry', straightGeometry!);
  const staleDownload = await downloadProject(page, testInfo, 'road-stale');
  const staleResult = routeLayer(staleDownload.project);
  expect(staleResult.route).toEqual({ kind: 'straight', closed: false });
  expect(staleResult.provenance).toBeUndefined();
});

test('edits draft points and reuses an explicit Road Preview on Finish', async ({ page }) => {
  test.setTimeout(90_000);
  const directions = await installDirectionsMock(page);
  const locations = new Map([
    ['Draft West', [16.34, 48.2]],
    ['Draft Center', [16.37, 48.21]],
    ['Draft East', [16.4, 48.22]],
  ]);
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? '';
    const coordinate = locations.get(query) ?? [16.35, 48.2];
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          id: `place.${query}`,
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coordinate },
          properties: { name: query, place_formatted: 'Austria' },
        }],
      }),
    });
  });
  await page.goto('/');
  await waitForMap(page);
  await page.getByRole('button', { name: 'Route (R)' }).click();
  await page.getByRole('radio', { name: 'Road', exact: true }).click();
  const search = page.getByRole('combobox', { name: 'Search places and addresses' });
  for (const name of locations.keys()) {
    await search.fill(name);
    await page.getByRole('button', { name: 'Search locations' }).click();
    await page.getByRole('option', { name: `${name}, Austria` }).click();
  }

  await page.getByText('Draft points (3)').click();
  const list = page.getByRole('list', { name: 'Draft route points' });
  const firstRow = list.getByRole('listitem').first();
  const initialFirst = await firstRow.textContent();
  const firstHandle = page.getByRole('button', { name: 'Move draft route point 1' });
  const handleBox = await firstHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  expect(handleBox!.width).toBeGreaterThanOrEqual(44);
  expect(handleBox!.height).toBeGreaterThanOrEqual(44);
  await firstHandle.focus();
  await firstHandle.press('ArrowRight');
  await expect(firstHandle).toBeFocused();
  await expect.poll(() => firstRow.textContent()).not.toBe(initialFirst);

  const secondHandle = page.getByRole('button', { name: 'Move draft route point 2' });
  const secondRow = list.getByRole('listitem').nth(1);
  const secondBefore = await secondRow.textContent();
  const secondBox = await secondHandle.boundingBox();
  expect(secondBox).not.toBeNull();
  const pointer = {
    button: 0,
    buttons: 1,
    clientX: secondBox!.x + secondBox!.width / 2,
    clientY: secondBox!.y + secondBox!.height / 2,
  };
  await secondHandle.dispatchEvent('mousedown', pointer);
  await page.locator('.maplibregl-canvas-container').dispatchEvent('mousemove', {
    ...pointer,
    clientX: pointer.clientX + 80,
    clientY: pointer.clientY + 40,
  });
  await page.locator('.maplibregl-canvas-container').dispatchEvent('mouseup', {
    ...pointer,
    buttons: 0,
    clientX: pointer.clientX + 80,
    clientY: pointer.clientY + 40,
  });
  await expect.poll(() => secondRow.textContent()).not.toBe(secondBefore);

  await page.getByRole('button', { name: 'Move draft point 3 up' }).click();
  await page.getByRole('button', { name: 'Remove draft point 2' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo last route point' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: 'Undo last route point' }).click();

  await page.getByRole('button', { name: 'Road Preview' }).click();
  await expect(page.getByText('Road preview updated.')).toBeVisible();
  expect(directions.requests).toHaveLength(1);
  await page.getByRole('button', { name: 'Finish route' }).click();
  await expect(page.getByRole('button', { name: 'Select Route 02' })).toBeVisible();
  expect(directions.requests).toHaveLength(1);
});

test('aligns markers and segment styles across live, SVG, PDF, and reverse', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await waitForMap(page);
  await openProject(page, markerParityProject());
  const live = page.getByTestId('map-canvas');
  await expect(live).toHaveAttribute('data-map-layer-appearance', /air-straight:[^|]*:air/);
  await expect(live).toHaveAttribute('data-map-layer-appearance', /none-straight:[^|]*:none/);

  const svg = await downloadLayeredSvg(page, testInfo, 'route-marker-parity');
  for (const pictogram of ['air', 'rail', 'car', 'walk', 'bike', 'ship']) {
    expect(svg).toContain(`data-route-pictogram="${pictogram}"`);
  }
  expect(svg).not.toContain('>AIR</text>');
  const noneGroup = svg.match(/data-layer-id="none-straight"[\s\S]*?<\/g>/)?.[0] ?? '';
  expect(noneGroup).not.toContain('data-route-pictogram');

  const straight = await svgMetrics(page, svg, 'air-straight');
  expectNear(straight.markers[0], straight.points.center);
  const arc = await svgMetrics(page, svg, 'train-arc');
  expectNear(arc.markers[0], arc.points.quarter);
  const road = await svgMetrics(page, svg, 'car-road');
  expect(road.markers).toHaveLength(4);
  for (const [index, expected] of road.repeats.entries()) {
    expectNear(road.markers[index], expected);
  }
  const styled = await svgMetrics(page, svg, 'ship-road');
  expect(styled.strokes).toEqual([
    { color: '#112233', width: '2.4', dash: '4.8 3.6' },
    { color: '#d9363e', width: '1.2', dash: null },
  ]);

  const pdf = await downloadPdf(page, testInfo, 'route-marker-parity');
  for (const pictogram of ['air', 'rail', 'car', 'walk', 'bike', 'ship']) {
    expect(pdf).toContain(`% Route pictogram: ${pictogram}`);
  }
  expect(pdf).toContain('% Route leg: 0');
  expect(pdf).toContain('% Route leg: 1');

  await page.getByRole('button', { name: 'Select Train Arc' }).click();
  await openAdvanced(page);
  await page.getByRole('button', { name: 'Reverse', exact: true }).click();
  const reversedSvg = await downloadLayeredSvg(page, testInfo, 'route-marker-reversed');
  const reversed = await svgMetrics(page, reversedSvg, 'train-arc');
  expectNear(reversed.markers[0], reversed.points.quarter);
  expectNear(reversed.markers[0], arc.points.threeQuarter);
});

test('keeps advanced routes accessible at 320 and 390px', async ({ page }) => {
  const directions = await installDirectionsMock(page);
  directions.setMode('fail');
  const project = basicRouteProject();
  project.id = 'two-point-route';
  project.title = 'Two point route';
  const route = routeLayer(project);
  route.geometry = {
    type: 'LineString',
    coordinates: [[16.34, 48.2], [16.4, 48.22]],
  };
  if (route.appearance?.kind === 'route') route.appearance.segmentStyles = [null];

  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await waitForMap(page);
  await openProject(page, project);
  await page.getByRole('button', { name: 'Open layers' }).click();
  await page.getByRole('button', { name: 'Select Route 01' }).click();
  await page.getByRole('button', { name: 'Open properties' }).click();
  await openAdvanced(page);
  const close = page.getByRole('button', { name: 'Close loop' });
  await expect(close).toBeDisabled();
  await expect(close).toHaveAccessibleDescription(
    'Add at least three distinct points to close this route.',
  );
  const reverse = page.getByRole('button', { name: 'Reverse', exact: true });
  await reverse.focus();
  await expect(reverse).toBeFocused();

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBe(0);
    const controls = page.locator(
      '.route-structure-controls button:visible, .route-structure-controls select:visible',
    );
    const controlList = await controls.all();
    for (const control of controlList) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }

  await page.getByRole('combobox', { name: 'Convert route to' }).selectOption('road');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await page.getByRole('button', { name: 'Route and apply' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Mapbox is temporarily unavailable');
  const alertBox = await alert.boundingBox();
  expect(alertBox).not.toBeNull();
  expect(alertBox!.x).toBeGreaterThanOrEqual(0);
  expect(alertBox!.x + alertBox!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBe(0);
});
