import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isExpectedWebGlDiagnostic = (message: string, browserName: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
  || (browserName === 'firefox' && message.includes('WEBGL_debug_renderer_info is deprecated in Firefox'))
);

const mercatorY = (latitude: number) => (
  (180 - 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360))) / 360
);

function projectInitialMapCoordinate(
  coordinate: readonly [number, number],
  width: number,
  height: number,
) {
  const worldSize = 512 * 2 ** 11.2;
  const [centerLongitude, centerLatitude] = [16.3725, 48.2084];
  return {
    x: width / 2 + (coordinate[0] - centerLongitude) / 360 * worldSize,
    y: height / 2 + (mercatorY(coordinate[1]) - mercatorY(centerLatitude)) * worldSize,
  };
}

test('expert arc route authoring is undoable and exports a travel-mode marker', async ({ page, browserName }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text(), browserName)) {
      consoleProblems.push(message.text());
    }
  });
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so map authoring cannot be exercised.');

  await page.getByRole('button', { name: 'Route (R)' }).click();
  await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Arc', exact: true }).click();
  await page.getByRole('combobox', { name: 'Travel marker' }).selectOption('air');
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('Click the map to add route points');
  const canvas = page.locator('.maplibregl-canvas');
  const canvasBox = await canvas.boundingBox();
  const frameBox = await page.locator('.print-frame').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  const point = (fraction: number) => ({
    x: frameBox!.x - canvasBox!.x + frameBox!.width * fraction,
    y: frameBox!.y - canvasBox!.y + frameBox!.height * fraction,
  });
  await canvas.click({ position: point(0.3) });
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('1 point');
  await canvas.click({ position: point(0.7) });
  const createdRoute = page.getByRole('button', { name: 'Select Route 02' });
  await expect(createdRoute).toHaveAttribute('aria-current', 'true');
  await page.screenshot({ path: testInfo.outputPath('expert-route-desktop.png'), fullPage: true });

  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /route-02/);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-appearance', /route-02:[^|]*:air:true/);
  await expect(page.getByRole('combobox', { name: 'Route travel profile' })).toHaveValue('air');
  await expect(page.getByRole('checkbox', { name: 'Show travel-mode marker' })).toBeChecked();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(createdRoute).not.toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(createdRoute).toBeVisible();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /route-02/);

  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('radio', { name: /Layered SVG/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Download layered SVG' }).click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath('route-authoring.layered.svg');
  await download.saveAs(outputPath);
  const svg = await readFile(outputPath, 'utf8');
  expect(svg).toContain('data-layer-name="Route 02"');
  expect(svg).toMatch(/data-layer-id="route-02"[^>]*>[\s\S]*?<path /);
  const routePath = svg.match(/data-layer-id="route-02"[^>]*>[\s\S]*?<path[^>]*d="([^"]+)"/)?.[1];
  expect(routePath).toContain(' Q ');
  expect(routePath).not.toContain(' L ');
  expect(svg).toContain('data-route-travel-profile="air"');
  expect(svg).toContain('>AIR</text>');
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Close export' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Route (R)' }).click();
  const authoringPanel = page.locator('.map-authoring-panel');
  await expect(authoringPanel).toBeVisible();
  const panelBox = await authoringPanel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.body.scrollWidth - document.body.clientWidth)).toBe(0);
  await page.getByRole('button', { name: 'Cancel route' }).click();
  expect(consoleProblems).toEqual([]);
});

test('a selected straight route drags a Terra Draw midpoint as one undoable edit', async ({ page }) => {
  await page.goto('/');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so route point editing cannot be exercised.');

  const route = page.getByRole('button', { name: 'Select Route 01' });
  await route.click();
  await page.getByRole('button', { name: /Advanced/ }).click();
  const vertexSelect = page.getByRole('combobox', { name: 'Route vertex' });
  await expect(vertexSelect.locator('option')).toHaveCount(4);
  const canvasBox = await page.locator('.maplibregl-canvas').boundingBox();
  expect(canvasBox).not.toBeNull();
  const midpoint = projectInitialMapCoordinate(
    [(16.326 + 16.353) / 2, (48.194 + 48.205) / 2],
    canvasBox!.width,
    canvasBox!.height,
  );
  await page.mouse.move(canvasBox!.x + midpoint.x, canvasBox!.y + midpoint.y);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + midpoint.x, canvasBox!.y + midpoint.y + 30, { steps: 5 });
  await page.mouse.up();

  await expect(route).toHaveAttribute('aria-current', 'true');
  await expect(vertexSelect.locator('option')).toHaveCount(5);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(vertexSelect.locator('option')).toHaveCount(4);
});
