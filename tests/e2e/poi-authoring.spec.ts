import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('POI placement can be cancelled, undone, redone, and exported as vector content', async ({ page }, testInfo) => {
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

  await page.getByRole('button', { name: 'Pin (P)' }).click();
  await expect(page.getByRole('status', { name: 'POI placement status' })).toContainText('Click the map to place a POI');
  await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel POI' }).click();
  await expect(page.getByRole('button', { name: 'Select (V)' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Select POI 01' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Pin (P)' }).click();
  const canvas = page.locator('.maplibregl-canvas');
  const canvasBox = await canvas.boundingBox();
  const frameBox = await page.locator('.print-frame').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  await canvas.click({
    position: {
      x: frameBox!.x - canvasBox!.x + frameBox!.width * 0.55,
      y: frameBox!.y - canvasBox!.y + frameBox!.height * 0.45,
    },
  });

  const createdPoi = page.getByRole('button', { name: 'Select POI 01' });
  await expect(createdPoi).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /poi-01/);
  await expect(page.getByRole('button', { name: 'Select (V)' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(createdPoi).not.toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(createdPoi).toBeVisible();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /poi-01/);

  await page.getByRole('button', { name: 'Export' }).click();
  const downloadButton = page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Download layered SVG' });
  await expect(downloadButton).toBeEnabled({ timeout: 20_000 });
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath('poi-authoring.layered.svg');
  await download.saveAs(outputPath);
  const svg = await readFile(outputPath, 'utf8');
  expect(svg).toContain('data-layer-name="POI 01"');
  expect(svg).toMatch(/data-layer-id="poi-01"[^>]*>[\s\S]*?<circle /);
  expect(consoleProblems).toEqual([]);
});
