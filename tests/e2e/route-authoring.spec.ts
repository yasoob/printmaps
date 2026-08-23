import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('expert arc route authoring is undoable and exports a travel-mode marker', async ({ page }, testInfo) => {
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

  await page.getByRole('button', { name: 'Route (R)' }).click();
  await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Route line shape' }).selectOption('arc');
  await page.getByRole('combobox', { name: 'Route travel profile' }).selectOption('air');
  await page.getByRole('checkbox', { name: 'Show travel-mode marker' }).check();
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('0 points');
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
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('Arc route · Air · 2 points');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /route-draft/);
  await page.screenshot({ path: testInfo.outputPath('expert-route-desktop.png'), fullPage: true });

  await page.getByRole('button', { name: 'Finish route' }).click();
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();
  const createdRoute = page.getByRole('button', { name: 'Select Route 02' });
  await expect(createdRoute).toHaveAttribute('aria-current', 'true');
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
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Download layered SVG' }).click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath('route-authoring.layered.svg');
  await download.saveAs(outputPath);
  const svg = await readFile(outputPath, 'utf8');
  expect(svg).toContain('data-layer-name="Route 02"');
  expect(svg).toMatch(/data-layer-id="route-02"[^>]*>[\s\S]*?<path /);
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
