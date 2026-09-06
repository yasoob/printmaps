import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { GeoJSONSource } from 'maplibre-gl';
import { basicRouteProject, convertRoute, installDirectionsMock, openAdvanced, openProject, routeLayer } from './advanced-route-test-support';
import { downloadProject, openInstrumentedMap } from './map-recovery-support';

declare global {
  interface Window { roadEditAborts: number }
}

function roadProject(longitude = 16.35) {
  const project = basicRouteProject();
  const layer = routeLayer(project);
  layer.name = 'Committed Road';
  layer.route = { kind: 'road', closed: false };
  layer.geometry = { type: 'LineString', coordinates: [[longitude, 48.2], [16.365, 48.215], [16.38, 48.22], [16.39, 48.215], [16.4, 48.2]] };
  layer.provenance = { provider: 'mapbox', service: 'directions-v5', profile: 'walking', waypoints: [[longitude, 48.2], [16.38, 48.22], [16.4, 48.2]], distanceMeters: 10_000, durationSeconds: 1000 };
  if (layer.appearance?.kind !== 'route') throw new Error('Expected route appearance');
  layer.appearance.segmentStyles = layer.appearance.segmentStyles.slice(0, 2);
  return project;
}

async function selectRoad(page: Page, name = 'Committed Road') {
  await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
  await openAdvanced(page);
}

async function openRoad(page: Page) {
  await page.addInitScript(() => {
    Object.assign(window, { roadEditAborts: 0 });
    const originalFetch = window.fetch;
    const fetchWithAbortTrace: typeof window.fetch = (input, init) => {
      if (String(input).includes('/directions/v5/')) {
        init?.signal?.addEventListener('abort', () => { Object.assign(window, { roadEditAborts: window.roadEditAborts + 1 }); }, { once: true });
      }
      return originalFetch(input, init);
    };
    Object.assign(window, { fetch: fetchWithAbortTrace });
  });
  await openInstrumentedMap(page);
  await openProject(page, roadProject());
  await selectRoad(page);
}

async function setCoordinate(page: Page, field: string, value: string) {
  await page.getByRole('textbox', { name: field, exact: true }).fill(value);
  await page.getByRole('button', { name: 'Project', exact: true }).focus();
}

async function nativeSegments(page: Page) {
  return page.evaluate(async () => {
    const data = await window.recoveryAudit.map!.getSource<GeoJSONSource>('studio-source-8:route-01')!.getData();
    if (data.type !== 'FeatureCollection') throw new Error('Expected route features');
    return data.features.flatMap((feature) => feature.properties?.featureKind === 'segment' && feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : []);
  });
}

const roadFailure = (page: Page) => page.getByRole('alert').filter({ hasText: 'Mapbox is temporarily unavailable' }).first();

async function nativeStart(page: Page) {
  const segments = await nativeSegments(page);
  return segments[0][0];
}

async function expectNoPending(page: Page) {
  await expect(page.getByText('Finding an updated road route…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel edit', exact: true })).toHaveCount(0);
}

async function evidence(page: Page, testInfo: TestInfo, label: string) {
  const project = await downloadProject(page);
  const path = testInfo.outputPath(`ux-fix-037-${label}.json`);
  await writeFile(path, JSON.stringify({
    project,
    nativeSegments: await nativeSegments(page),
    inspector: {
      longitude: await page.getByRole('textbox', { name: /Route (anchor|waypoint) longitude/ }).inputValue(),
      latitude: await page.getByRole('textbox', { name: /Route (anchor|waypoint) latitude/ }).inputValue(),
    },
    aborts: await page.evaluate(() => window.roadEditAborts),
    runtimeErrors: await page.evaluate(() => window.recoveryRuntimeErrors),
  }, null, 2));
  await testInfo.attach(`ux-fix-037-${label}`, {
    contentType: 'application/json',
    path,
  });
  await page.screenshot({ path: testInfo.outputPath(`ux-fix-037-${label}.png`), animations: 'disabled' });
  expect(await page.evaluate(() => window.recoveryRuntimeErrors)).toEqual([]);
}

test('a failed Road edit cannot contaminate a converted Arc latitude-only edit or its native handles', async ({ page }, testInfo) => {
  const directions = await installDirectionsMock(page);
  directions.setMode('fail');
  await openRoad(page);
  await setCoordinate(page, 'Route waypoint longitude', '16.345');
  await expect(roadFailure(page)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Route waypoint longitude' })).toHaveValue('16.345');
  await convertRoute(page, 'arc');
  await expectNoPending(page);
  await expect(page.getByRole('textbox', { name: 'Route anchor longitude' })).toHaveValue('16.35');
  await setCoordinate(page, 'Route anchor latitude', '48.205');
  const converted = routeLayer(await downloadProject(page));
  expect(converted.geometry).toMatchObject({ type: 'Arc', anchors: [[16.35, 48.205], [16.38, 48.22], [16.4, 48.2]] });
  await expect.poll(() => nativeStart(page)).toEqual([16.35, 48.205]);
  await evidence(page, testInfo, 'original-repro-corrected');
  await page.getByRole('button', { name: 'Drag route anchor 1', exact: true }).press('ArrowUp');
  await expect.poll(async () => routeLayer(await downloadProject(page)).geometry).not.toEqual(converted.geometry);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => nativeStart(page)).toEqual([16.35, 48.205]);
  expect(routeLayer(await downloadProject(page)).geometry).toEqual(converted.geometry);
  expect(directions.requests).toHaveLength(1);
});

test('conversion aborts held waypoint routing and ignores its late completion', async ({ page }, testInfo) => {
  const directions = await installDirectionsMock(page);
  directions.setMode('hold');
  await openRoad(page);
  await setCoordinate(page, 'Route waypoint longitude', '16.345');
  await expect.poll(() => directions.requests.length).toBe(1);
  await expect(page.getByText('Finding an updated road route…', { exact: true })).toBeVisible();
  const failed = page.waitForEvent('requestfailed', { predicate: (request) => request.url().includes('/directions/v5/') });
  await convertRoute(page, 'arc');
  await expectNoPending(page);
  expect(await page.evaluate(() => window.roadEditAborts)).toBe(1);
  const converted = await downloadProject(page);
  directions.release();
  await failed;
  expect(await downloadProject(page)).toEqual(converted);
  await expect(page.getByRole('textbox', { name: 'Route anchor longitude' })).toHaveValue('16.35');
  await expect.poll(() => nativeStart(page)).toEqual([16.35, 48.2]);
  await evidence(page, testInfo, 'held-conversion');
});

test('compatible styling and selection retain failed corrections, retry commits once, and Undo restores canonical points', async ({ page }, testInfo) => {
  const directions = await installDirectionsMock(page);
  directions.setMode('fail');
  await openRoad(page);
  const originalSegments = await nativeSegments(page);
  await setCoordinate(page, 'Route waypoint longitude', '16.345');
  await expect(roadFailure(page)).toBeVisible();
  await setCoordinate(page, 'Layer name', 'Renamed Road');
  await page.locator('input[aria-label="Route color"]').fill('#224466');
  await page.getByRole('button', { name: 'Select Paper basemap', exact: true }).click();
  await selectRoad(page, 'Renamed Road');
  await expect(page.getByRole('textbox', { name: 'Route waypoint longitude' })).toHaveValue('16.345');
  await expect(roadFailure(page)).toBeVisible();
  await setCoordinate(page, 'Route waypoint latitude', '48.205');
  await expect.poll(() => directions.requests.length).toBe(2);
  await expect(roadFailure(page)).toBeVisible();
  expect(directions.requests[1]).toContain('16.345,48.205');
  await expect.poll(() => nativeSegments(page)).toEqual(originalSegments);
  directions.setMode('success');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expectNoPending(page);
  await expect.poll(() => nativeStart(page)).toEqual([16.345, 48.205]);
  const routed = routeLayer(await downloadProject(page));
  expect(routed).toMatchObject({ name: 'Renamed Road', appearance: { color: '#224466' }, provenance: { waypoints: [[16.345, 48.205], [16.38, 48.22], [16.4, 48.2]] } });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectNoPending(page);
  await expect(page.getByRole('textbox', { name: 'Route waypoint longitude' })).toHaveValue('16.35');
  await expect(page.getByRole('textbox', { name: 'Route waypoint latitude' })).toHaveValue('48.2');
  await expect.poll(() => nativeSegments(page)).toEqual(originalSegments);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(routeLayer(await downloadProject(page))).toEqual(routed);
  expect(directions.requests).toHaveLength(3);
  await evidence(page, testInfo, 'compatible-retry');
});

for (const operation of ['replacement', 'deletion'] as const) {
  test(`retires held Road state on ${operation} and never revives it in restored canonical inputs`, async ({ page }, testInfo) => {
    const directions = await installDirectionsMock(page);
    directions.setMode('hold');
    await openRoad(page);
    await setCoordinate(page, 'Route waypoint longitude', '16.345');
    await expect.poll(() => directions.requests.length).toBe(1);
    const failed = page.waitForEvent('requestfailed', { predicate: (request) => request.url().includes('/directions/v5/') });
    if (operation === 'replacement') {
      await openProject(page, roadProject(16.355));
    } else {
      await page.getByRole('button', { name: 'Layer menu', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Delete layer', exact: true }).click();
    }
    await expectNoPending(page);
    expect(await page.evaluate(() => window.roadEditAborts)).toBe(1);
    const canonical = await downloadProject(page);
    directions.release();
    await failed;
    expect(await downloadProject(page)).toEqual(canonical);
    if (operation === 'deletion') await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await selectRoad(page);
    await expect(page.getByRole('textbox', { name: 'Route waypoint longitude' })).toHaveValue(operation === 'replacement' ? '16.355' : '16.35');
    await expectNoPending(page);
    expect(directions.requests).toHaveLength(1);
    await evidence(page, testInfo, operation);
  });
}

test('UX043 unchanged coordinate inspection makes no requests and only Retry resubmits a failed edit', async ({ page }, testInfo) => {
  const directions = await installDirectionsMock(page);
  directions.setMode('fail');
  await openRoad(page);
  const before = await downloadProject(page);
  const longitude = page.getByRole('textbox', { name: 'Route waypoint longitude' });
  const latitude = page.getByRole('textbox', { name: 'Route waypoint latitude' });
  await longitude.focus();
  await longitude.press('Tab');
  await latitude.press('Enter');
  await latitude.press('Tab');
  await longitude.fill('16.3500');
  await longitude.press('Enter');
  await longitude.press('Tab');
  const unchangedRequests = directions.requests.length;
  expect(unchangedRequests).toBe(0);
  await expectNoPending(page);
  expect(await downloadProject(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await longitude.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-043-unchanged-navigation.png'), animations: 'disabled' });

  await longitude.fill('16.345');
  await longitude.press('Enter');
  await expect(roadFailure(page)).toBeVisible();
  await longitude.focus();
  await longitude.press('Tab');
  await latitude.press('Tab');
  const repeatedPendingRequests = directions.requests.length;
  expect(repeatedPendingRequests).toBe(1);
  await expect(longitude).toHaveValue('16.345');
  await expect(roadFailure(page)).toBeVisible();
  await roadFailure(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-043-retained-edit.png'), animations: 'disabled' });

  await setCoordinate(page, 'Route waypoint latitude', '48.205');
  await expect.poll(() => directions.requests.length).toBe(2);
  await expect(roadFailure(page)).toBeVisible();
  expect(directions.requests[1]).toContain('16.345,48.205');
  directions.setMode('success');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expectNoPending(page);
  expect(directions.requests).toHaveLength(3);
  const after = await downloadProject(page);
  expect(routeLayer(after)).toMatchObject({ provenance: { waypoints: [[16.345, 48.205], [16.38, 48.22], [16.4, 48.2]] } });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await downloadProject(page)).toEqual(before);
  await writeFile(testInfo.outputPath('ux-fix-043-results.json'), JSON.stringify({
    before, after, unchangedRequests, repeatedPendingRequests,
    requests: directions.requests, runtimeErrors: await page.evaluate(() => window.recoveryRuntimeErrors),
  }, null, 2));
  expect(await page.evaluate(() => window.recoveryRuntimeErrors)).toEqual([]);
});
