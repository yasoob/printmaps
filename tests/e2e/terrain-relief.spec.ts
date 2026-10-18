import { buffer } from 'node:stream/consumers';
import { expect, test, type Page } from '@playwright/test';
import { openInstrumentedMap } from './map-recovery-support';
import { chooseOption } from './select-support';

async function installTerrainFixtures(page: Page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext('2d')!;
    const pixels = context.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const elevation = 1000 + Math.round(500 * Math.sin(x / 255 * Math.PI) * Math.sin(y / 255 * Math.PI));
        const encoded = elevation + 32_768;
        pixels.data.set([Math.floor(encoded / 256), encoded % 256, 0, 255], (y * 256 + x) * 4);
      }
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png').split(',', 2)[1];
  });
  await page.context().route('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**', (route) => route.fulfill({
    body: Buffer.from(png, 'base64'), contentType: 'image/png', headers: { 'access-control-allow-origin': '*' },
  }));
  await page.route('**/styles/*.json', (route) => route.fulfill({ json: {
    version: 8, sources: {}, glyphs: 'https://terrain.test/fonts/{fontstack}/{range}.pbf',
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f3eee3' } }],
  } }));
  await page.route('https://terrain.test/fonts/**', (route) => route.fulfill({ body: Buffer.alloc(0), contentType: 'application/x-protobuf' }));
}

async function openTerrain(page: Page) {
  await installTerrainFixtures(page);
  await openInstrumentedMap(page);
  if ((page.viewportSize()?.width ?? 1440) < 900) await page.getByRole('button', { name: 'Open properties' }).click();
  await page.getByRole('button', { name: /^Terrain(?: & 3D relief)?$/ }).click();
}

async function openRelief(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) < 900) await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('tab', { name: '3D model', exact: true }).click();
}

test('terrain and real contour worker render, persist through style change, and export a closed STL', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => { errors.push(error.message); });
  await openTerrain(page);
  await page.getByRole('switch', { name: 'Show 3D terrain', exact: true }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await page.getByRole('switch', { name: 'Show elevation contours' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => window.recoveryAudit.map!.querySourceFeatures('pms-terrain-contours', { sourceLayer: 'contours' }).length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.recoveryAudit.map!.getTerrain()?.source)).toBe('pms-terrain-dem');
  await page.getByRole('radio', { name: /^Night Ink:/ }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => window.recoveryAudit.map!.querySourceFeatures('pms-terrain-contours', { sourceLayer: 'contours' }).length)).toBeGreaterThan(0);
  await openRelief(page);
  await expect(page.getByRole('dialog', { name: 'Export map' })).toBeVisible();
  await page.getByRole('button', { name: 'Fit dimensions to print frame' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Dimensions match' })).toBeVisible();
  await chooseOption(page, 'Relief detail', 'Low · 64 samples');
  await page.getByRole('switch', { name: 'Raise a route ridge' }).click();
  await page.getByLabel('Route ridge width', { exact: true }).fill('8');
  await page.getByLabel('Route ridge width', { exact: true }).press('Enter');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download STL' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('terrain-relief-mm.stl');
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const stl = await buffer(stream!);
  const triangleCount = stl.readUInt32LE(80);
  expect(triangleCount).toBeGreaterThan(1000);
  expect(stl.byteLength).toBe(84 + triangleCount * 50);
  let maximumHeight = 0;
  const edges = new Map<string, number>();
  for (let face = 0; face < triangleCount; face++) {
    const points = Array.from({ length: 3 }, (_, vertex) => {
      const offset = 84 + face * 50 + 12 + vertex * 12;
      const xyz = [stl.readFloatLE(offset), stl.readFloatLE(offset + 4), stl.readFloatLE(offset + 8)];
      maximumHeight = Math.max(maximumHeight, xyz[2]);
      return xyz.join(',');
    });
    for (let side = 0; side < 3; side++) {
      const a = points[side], b = points[(side + 1) % 3];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  expect(maximumHeight).toBeGreaterThan(2);
  for (const count of edges.values()) expect(count).toBe(2);
  await page.screenshot({ path: testInfo.outputPath('terrain-stl-dialog.png') });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const pngDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  expect(errors).toEqual([]);
});

test('STL explicitly rejects perspective footprint, then accepts a bearing-rotated print frame', async ({ page }) => {
  await openTerrain(page);
  const pitch = page.getByLabel('Pitch', { exact: true });
  await pitch.fill('30');
  await pitch.press('Enter');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
  await openRelief(page);
  await page.getByRole('button', { name: 'Fit dimensions to print frame' }).click();
  await expect(page.getByRole('alert')).toContainText('Pitch');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await pitch.fill('0');
  await pitch.press('Enter');
  const bearing = page.getByLabel('Bearing', { exact: true });
  await bearing.fill('45');
  await bearing.press('Enter');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
  await openRelief(page);
  await page.getByRole('button', { name: 'Fit dimensions to print frame' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Dimensions match' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('relief controls remain accessible and scrollable on a narrow mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openTerrain(page);
  await openRelief(page);
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Relief width', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download STL' })).toBeInViewport();
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: testInfo.outputPath('terrain-relief-mobile.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
