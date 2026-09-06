import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  downloadProject, expectCoherentCamera, failNextWebGlProbe, loseAnimatingRenderer, loseRenderer,
  mapSnapshot, normalizedViewport, openInstrumentedMap,
} from './map-recovery-support';

async function interactionSnapshot(page: Page) {
  return page.evaluate(() => {
    const map = window.recoveryAudit.map!;
    const handlers = ['boxZoom', 'doubleClickZoom', 'dragPan', 'dragRotate', 'keyboard', 'scrollZoom', 'touchPitch', 'touchZoomRotate'] as const;
    return {
      handlers: Object.fromEntries(handlers.map((name) => [name, map[name].isEnabled()])),
      buttons: [...map.getContainer().querySelectorAll<HTMLButtonElement>(':scope .canvas-navigation-control button')].map((button) => ({
        name: button.getAttribute('aria-label'), disabled: button.disabled,
      })),
    };
  });
}

async function expectLockedRenderer(page: Page) {
  const snapshot = await interactionSnapshot(page);
  expect(Object.values(snapshot.handlers)).toEqual(Array.from({ length: 8 }, () => false));
  expect(snapshot.buttons).toHaveLength(3);
  expect(snapshot.buttons.every((button) => button.disabled)).toBe(true);
  return snapshot;
}

test.afterEach(async ({ page }, testInfo) => {
  const errors = await page.evaluate(() => window.recoveryRuntimeErrors ?? []);
  await writeFile(testInfo.outputPath('ux-fix-024-runtime.json'), JSON.stringify({ errors }, null, 2));
  expect(errors).toEqual([]);
});

test('locked recovery blocks native keys, dragging and navigation while replacement style is pending', async ({ page }, testInfo) => {
  await openInstrumentedMap(page);
  const lock = page.getByRole('switch', { name: 'Lock map area' });
  await lock.click();
  await expectLockedRenderer(page);
  const before = await mapSnapshot(page);
  await loseRenderer(page);
  let releaseStyle!: () => void;
  await page.route('**/styles/paper.json', async (route) => {
    await new Promise<void>((resolve) => { releaseStyle = resolve; });
    await route.continue();
  });
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect.poll(() => Boolean(releaseStyle)).toBe(true);
  const map = page.getByTestId('map-canvas');
  await expect(map).toHaveAttribute('data-map-area-locked', 'true');
  await expect(map).not.toHaveAttribute('data-map-ready');
  const pendingLock = await expectLockedRenderer(page);
  const canvas = page.locator('.maplibregl-canvas');
  await canvas.press('ArrowRight');
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds!.x + 50, bounds!.y + 280);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 140, bounds!.y + 320, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const pending = await mapSnapshot(page);
  expect(pending).toMatchObject({ center: before.center, zoom: before.zoom, bearing: before.bearing, pitch: before.pitch });
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-locked-pending.png') });
  releaseStyle();
  await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const after = await mapSnapshot(page);
  expect(after).toMatchObject({ center: before.center, zoom: before.zoom, bearing: before.bearing, pitch: before.pitch });
  await expectLockedRenderer(page);
  await lock.click();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled();
  await canvas.press('ArrowRight');
  await expect.poll(async () => {
    const snapshot = await mapSnapshot(page);
    return snapshot.center;
  }).not.toEqual(before.center);
  await writeFile(testInfo.outputPath('ux-fix-024-locked-pending.json'), JSON.stringify({ before, pendingLock, pending, after }, null, 2));
});

test('failed WebGL creation retains the interrupted animation camera for a second retry without replaying search', async ({ page }, testInfo) => {
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', (route) => route.fulfill({
    json: { type: 'FeatureCollection', features: [{ id: 'camera-recovery-location', type: 'Feature',
      geometry: { type: 'Point', coordinates: [16.4, 48.25] }, properties: { full_address: 'Camera recovery location' } }] },
  }));
  await openInstrumentedMap(page);
  const search = page.getByRole('combobox', { name: 'Search places and addresses' });
  await search.fill('Camera recovery');
  await search.press('Enter');
  await page.getByRole('option', { name: 'Camera recovery location' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-location-applied', '1');
  await expect.poll(() => page.evaluate(() => window.recoveryAudit.map!.isMoving())).toBe(false);
  const original = await mapSnapshot(page);
  const loss = await loseAnimatingRenderer(page);
  expect(loss.center).not.toEqual(original.center);
  expect(loss.zoom).not.toBe(original.zoom);
  expect(loss.bearing).toBeGreaterThan(0);
  expect(loss.bearing).toBeLessThan(40);
  expect(loss.pitch).toBeGreaterThan(0);
  expect(loss.pitch).toBeLessThan(25);
  await expect(page.getByRole('button', { name: 'Retry map' })).toBeEnabled();
  await failNextWebGlProbe(page);
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByText('WebGL 2 is unavailable in this browser. Your project can still be edited.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry map' })).toBeEnabled();
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0);
  expect(await page.evaluate(() => window.recoveryAudit.maps.length)).toBe(1);
  await page.getByRole('switch', { name: 'Lock map area' }).click();
  const document = await downloadProject(page);
  expect(normalizedViewport(document.camera)).toEqual(normalizedViewport(loss));
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-first-retry-failed.png') });
  await page.getByRole('button', { name: 'Retry map' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  const after = await mapSnapshot(page);
  expect(normalizedViewport(after)).toEqual(normalizedViewport(loss));
  expect(after.rendererCount).toBe(2);
  await expectLockedRenderer(page);
  expect(await downloadProject(page)).toEqual(document);
  const coherent = await expectCoherentCamera(page);
  await page.screenshot({ path: testInfo.outputPath('ux-fix-024-second-retry-recovered.png') });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Lock map area' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => {
    const snapshot = await mapSnapshot(page);
    return normalizedViewport(snapshot);
  }).toEqual(normalizedViewport(original));
  await writeFile(testInfo.outputPath('ux-fix-024-failed-creation-camera.json'), JSON.stringify({
    original, loss, canonicalWhileFailed: document.camera, after, coherent,
    faults: ['actual WebGL context loss during native animation', 'one deterministic WebGL probe failure'],
    searchProvider: 'deterministic mock',
  }, null, 2));
});
