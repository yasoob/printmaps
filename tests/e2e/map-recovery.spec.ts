import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  addCoordinate, downloadProject, loseRenderer, mapSnapshot, openInstrumentedMap, revealRouteCoordinates, tilePattern,
} from './map-recovery-support';

test.afterEach(async ({ page }, testInfo) => {
  await writeFile(testInfo.outputPath('ux-fix-024-runtime.json'), JSON.stringify(await page.evaluate(() => ({
    errors: window.recoveryRuntimeErrors,
  })), null, 2));
  expect(await page.evaluate(() => window.recoveryRuntimeErrors ?? [])).toEqual([]);
});

test('one failed real tile recovers without replacing the renderer or publishing an incomplete export', async ({ page }, testInfo) => {
  await openInstrumentedMap(page);
  let failures = 0;
  let failedUrl: string | undefined;
  let releaseTile!: () => void;
  await page.route(tilePattern, async (route) => {
    if (failures === 0) {
      failures += 1; failedUrl = route.request().url(); await route.abort('failed');
      return;
    }
    if (route.request().url() === failedUrl) await new Promise<void>((resolve) => { releaseTile = resolve; });
    await route.continue();
  });
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const map = page.getByTestId('map-canvas');
  await expect(page.getByText('Map preview incomplete')).toBeVisible();
  await expect(map).not.toHaveAttribute('data-map-ready');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeDisabled();
  await expect.poll(() => Boolean(releaseTile)).toBe(true);
  releaseTile();
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled();
  await page.getByRole('radio', { name: /Layered SVG/ }).click();
  const exporting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download layered SVG' }).click();
  const exported = await exporting;
  const output = testInfo.outputPath('ux-fix-024-recovered.layered.svg');
  await exported.saveAs(output);
  const svg = await readFile(output, 'utf8');
  expect(svg).toContain('data-layer-id="route-01"');
  expect(svg).toContain('data:image/png;base64,');
  await page.getByRole('button', { name: 'Close export' }).click();
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(page.getByRole('button', { name: 'Retry map' })).toHaveCount(0);
  const snapshot = await mapSnapshot(page);
  expect(snapshot.rendererCount).toBe(1);
  expect(snapshot.errors).toHaveLength(1);
  expect(snapshot.nativeLoaded).toBe(true);
  await writeFile(testInfo.outputPath('ux-fix-024-one-tile.json'), JSON.stringify(snapshot, null, 2));
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-one-tile-recovered.png') });
});

test('persistent tile failures stop after two retries and manual recovery rebinds selected shape handles', async ({ page }, testInfo) => {
  await openInstrumentedMap(page);
  await page.getByRole('button', { name: 'Select City center', exact: true }).click();
  await page.getByRole('button', { name: 'Edit area points' }).click();
  let failedUrl: string | undefined;
  let attempts = 0;
  await page.route(tilePattern, async (route) => {
    failedUrl ??= route.request().url();
    if (route.request().url() === failedUrl) { attempts += 1; await route.abort('failed'); }
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const retry = page.getByRole('button', { name: 'Retry map' });
  await expect(retry).toBeEnabled({ timeout: 15_000 });
  expect(attempts).toBe(3);
  await page.waitForTimeout(2000);
  expect(attempts).toBe(3);
  await page.locator('.shape-vertex-marker').first().press('ArrowRight');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
  const before = await mapSnapshot(page);
  const document = await downloadProject(page);
  const frame = await page.locator('.print-frame').boundingBox();
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-persistent-failure.png') });
  await page.unroute(tilePattern);
  let releaseStyle!: () => void;
  await page.route('**/styles/paper.json', async (route) => {
    await new Promise<void>((resolve) => { releaseStyle = resolve; });
    await route.continue();
  });
  await retry.click();
  await expect.poll(() => Boolean(releaseStyle)).toBe(true);
  await expect(page.getByTestId('map-canvas')).not.toHaveAttribute('data-map-ready');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Close export' }).click();
  releaseStyle();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const after = await mapSnapshot(page);
  expect(after).toMatchObject({ center: before.center, zoom: before.zoom, geometry: before.geometry, selected: before.selected, rendererCount: 2 });
  expect(await downloadProject(page)).toEqual(document);
  expect(await page.locator('.print-frame').boundingBox()).toEqual(frame);
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByTestId('map-canvas')).not.toHaveAttribute('data-map-layer-geometry', before.geometry!);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', before.geometry!);
  await expect(page.locator('.shape-vertex-marker')).toHaveCount(4);
  await page.locator('.shape-vertex-marker').first().press('ArrowRight');
  await expect(page.getByTestId('map-canvas')).not.toHaveAttribute('data-map-layer-geometry', before.geometry!);
  await writeFile(testInfo.outputPath('ux-fix-024-persistent-recovery.json'), JSON.stringify({ attempts, before, after }, null, 2));
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-shape-handles-recovered.png') });
});

test('a real lost WebGL context preserves active and suspended drawing state during keyboard retry', async ({ page }, testInfo) => {
  await openInstrumentedMap(page);
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  await addCoordinate(page, 'area', '16.35', '48.2');
  await addCoordinate(page, 'area', '16.38', '48.2');
  await addCoordinate(page, 'area', '16.38', '48.22');
  await page.getByRole('textbox', { name: 'New area point longitude' }).fill('181');
  await page.getByRole('button', { name: 'Route (R)' }).click();
  await page.locator('.route-point-sources > summary').click();
  await addCoordinate(page, 'route', '16.35', '48.2');
  await addCoordinate(page, 'route', '16.38', '48.22');
  await revealRouteCoordinates(page);
  await page.getByRole('textbox', { name: 'New route point longitude' }).fill('16.39000');
  const before = await mapSnapshot(page);
  const document = await downloadProject(page);
  const frame = await page.locator('.print-frame').boundingBox();
  await loseRenderer(page);
  await page.getByRole('button', { name: 'Retry map' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const after = await mapSnapshot(page);
  expect(after).toMatchObject({ center: before.center, zoom: before.zoom, geometry: before.geometry, rendererCount: 2 });
  expect(await downloadProject(page)).toEqual(document);
  expect(await page.locator('.print-frame').boundingBox()).toEqual(frame);
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('2 points');
  await expect(page.getByRole('textbox', { name: 'New route point longitude' })).toHaveValue('16.39000');
  await expect(page.locator('.route-authoring-panel')).toHaveAttribute('data-settings-expanded', 'true');
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-drafts-recovered.png') });
  await page.getByRole('button', { name: 'Move draft route point 1', exact: true }).press('ArrowRight');
  await expect(page.getByTestId('map-canvas')).not.toHaveAttribute('data-map-layer-geometry', before.geometry!);
  await page.getByRole('button', { name: 'Cancel route' }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await expect(page.getByRole('status', { name: 'Area drawing status' })).toHaveText('3 vertices');
  await expect(page.getByRole('textbox', { name: 'New area point longitude' })).toHaveValue('181');
  await writeFile(testInfo.outputPath('ux-fix-024-drafts.json'), JSON.stringify({ before, after, frame }, null, 2));
});

test('renderer restart does not replay an applied search and retains native style settings', async ({ page }, testInfo) => {
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', (route) => route.fulfill({
    json: { type: 'FeatureCollection', features: [{ id: 'recovery-location', type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.37, 48.21] }, properties: { full_address: 'Recovery test location' } }] },
  }));
  await openInstrumentedMap(page);
  await page.getByRole('combobox', { name: 'Map language' }).selectOption('de');
  await page.getByRole('spinbutton', { name: 'Text scale' }).fill('125');
  await page.getByRole('spinbutton', { name: 'Text scale' }).press('Tab');
  await page.getByRole('checkbox', { name: 'Show roads' }).uncheck();
  const search = page.getByRole('combobox', { name: 'Search places and addresses' });
  await search.fill('Recovery test');
  await search.press('Enter');
  await page.getByRole('option', { name: 'Recovery test location' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-location-applied', '1');
  await page.locator('.maplibregl-canvas').press('ArrowRight');
  await expect.poll(async () => {
    const snapshot = await mapSnapshot(page);
    return snapshot.center;
  }).not.toEqual([16.37, 48.21]);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
  const before = await mapSnapshot(page);
  const styleBefore = await page.evaluate(() => window.recoveryAudit.map!.getStyle());
  await loseRenderer(page);
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const after = await mapSnapshot(page);
  expect(after).toMatchObject({ center: before.center, zoom: before.zoom, rendererCount: 2 });
  expect(await page.evaluate(() => window.recoveryAudit.map!.getStyle())).toEqual(styleBefore);
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  await writeFile(testInfo.outputPath('ux-fix-024-search-style.json'), JSON.stringify({ before, after, searchProvider: 'deterministic mock' }, null, 2));
});

test('mobile keyboard retry preserves active area inputs and compact-first disclosure', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openInstrumentedMap(page);
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  await page.getByRole('button', { name: 'Show area settings' }).click();
  await addCoordinate(page, 'area', '16.35', '48.2');
  await addCoordinate(page, 'area', '16.38', '48.2');
  await addCoordinate(page, 'area', '16.38', '48.22');
  await page.getByRole('textbox', { name: 'New area point longitude' }).fill('181');
  const before = await mapSnapshot(page);
  const frame = await page.locator('.print-frame').boundingBox();
  await loseRenderer(page);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-mobile-retry.png') });
  await page.getByRole('button', { name: 'Retry map' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  expect(await mapSnapshot(page)).toMatchObject({ center: before.center, zoom: before.zoom, geometry: before.geometry });
  expect(await page.locator('.print-frame').boundingBox()).toEqual(frame);
  await expect(page.getByRole('status', { name: 'Area drawing status' })).toHaveText('3 vertices');
  await expect(page.getByRole('textbox', { name: 'New area point longitude' })).toHaveValue('181');
  await expect(page.locator('.shape-authoring-panel')).toHaveAttribute('data-settings-expanded', 'true');
  await page.getByRole('button', { name: 'Hide area settings' }).click();
  await page.locator('.maplibregl-canvas').click({ position: { x: 60, y: 150 } });
  await expect(page.getByRole('status', { name: 'Area drawing status' })).toHaveText('4 vertices');
  await expect(page.locator('.shape-authoring-panel')).toHaveAttribute('data-settings-expanded', 'false');
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-mobile-area-recovered.png') });
});

test('renderer restart reinstalls custom images and selected POI and route editors', async ({ page }, testInfo) => {
  await openInstrumentedMap(page);
  await page.getByRole('button', { name: 'Select Coffee stop', exact: true }).click();
  await page.getByLabel('Custom marker file').setInputFiles({
    name: 'recovery-marker.svg', mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><circle cx="64" cy="64" r="60" fill="#0d78b5"/></svg>'),
  });
  await expect(page.getByRole('status', { name: 'Custom marker status' })).toContainText('128 × 128');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
  const images = await page.evaluate(() => window.recoveryAudit.map!.listImages());
  expect(images.some((image) => image.startsWith('studio-marker-'))).toBe(true);
  const before = await mapSnapshot(page);
  await loseRenderer(page);
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  expect(await page.evaluate(() => window.recoveryAudit.map!.listImages())).toEqual(images);
  await page.getByRole('button', { name: 'Move Coffee stop', exact: true }).press('ArrowRight');
  await expect(page.getByTestId('map-canvas')).not.toHaveAttribute('data-map-layer-geometry', before.geometry!);
  await page.getByRole('button', { name: 'Select Route 01', exact: true }).click();
  await expect(page.locator('.route-vertex-marker')).toHaveCount(4);
  await loseRenderer(page);
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const routeBefore = await mapSnapshot(page);
  await page.locator('.route-vertex-marker').first().press('ArrowRight');
  await expect(page.getByTestId('map-canvas')).not.toHaveAttribute('data-map-layer-geometry', routeBefore.geometry!);
  await writeFile(testInfo.outputPath('ux-fix-024-native-images-editors.json'), JSON.stringify({ images, before, after: await mapSnapshot(page) }, null, 2));
});

test('invalid native GeoJSON content stays actionable without automatic retries', async ({ page }, testInfo) => {
  await openInstrumentedMap(page);
  await page.evaluate(() => {
    window.recoveryAudit.map!.addSource('recovery-invalid-source', {
      type: 'geojson', data: 'data:application/json,invalid',
    });
  });
  const retry = page.getByRole('button', { name: 'Retry map' });
  await expect(retry).toBeEnabled();
  await expect(page.getByText('The map content could not be rendered. Review the layer data, then retry the map.')).toBeVisible();
  await page.waitForTimeout(3000);
  const failed = await mapSnapshot(page);
  expect(failed.rendererCount).toBe(1);
  expect(failed.errors).toHaveLength(1);
  expect(failed.ready).toBeUndefined();
  await retry.click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await writeFile(testInfo.outputPath('ux-fix-024-invalid-content.json'), JSON.stringify({
    failed, after: await mapSnapshot(page), fault: 'invalid GeoJSON injected into the native map, not the document',
  }, null, 2));
});
