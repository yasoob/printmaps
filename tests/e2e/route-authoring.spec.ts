import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('straight route authoring is undoable and exports as a named vector layer', async ({ page }, testInfo) => {
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
  await expect(page.getByRole('status', { name: 'Route drawing status' })).toContainText('2 points');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /route-draft/);

  await page.getByRole('button', { name: 'Finish route' }).click();
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();
  const createdRoute = page.getByRole('button', { name: 'Select Route 02' });
  await expect(createdRoute).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /route-02/);
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
  expect(consoleProblems).toEqual([]);
});
