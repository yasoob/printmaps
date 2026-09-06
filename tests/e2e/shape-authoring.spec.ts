import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { expandToolSettings } from './authoring-panel-support';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`custom-area drafts survive source and tool navigation at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    const map = page.getByTestId('map-canvas');
    await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Area (S)' }).click();
    await page.getByRole('tab', { name: 'Draw custom area' }).click();
    const canvas = page.locator('.maplibregl-canvas');
    const bounds = await canvas.boundingBox();
    const point = (x: number, y: number) => ({
      x: bounds!.width * x,
      y: bounds!.height * y,
    });
    await canvas.click({ position: point(0.2, 0.18) });
    await canvas.click({ position: point(0.75, 0.18) });
    await canvas.click({ position: point(0.2, 0.35) });
    const status = page.getByRole('status', { name: 'Area drawing status' });
    await expect(status).toContainText('3 vertices');
    const geometry = await map.getAttribute('data-map-layer-geometry');

    for (const source of ['Find administrative area', 'Travel time']) {
      await expandToolSettings(page, 'area');
      await page.getByRole('tab', { name: source }).click();
      await expect(map).not.toHaveAttribute('data-map-layer-order', /shape-draft/);
      await page.getByRole('tab', { name: 'Draw custom area' }).click();
      await expect(status).toContainText('3 vertices');
      await expect(map).toHaveAttribute('data-map-layer-geometry', geometry!);
    }

    for (const tool of ['Select (V)', 'Place (P)', 'Route (R)', 'Close Area menu']) {
      if (tool === 'Close Area menu') await expandToolSettings(page, 'area');
      await page.getByRole('button', { name: tool }).click();
      await expect(map).not.toHaveAttribute('data-map-layer-order', /shape-draft/);
      await page.getByRole('button', { name: 'Area (S)' }).click();
      await expect(page.getByRole('tab', { name: 'Draw custom area', includeHidden: true })).toHaveAttribute('aria-selected', 'true');
      await expect(status).toContainText('3 vertices');
      await expect(map).toHaveAttribute('data-map-layer-geometry', geometry!);
    }
    await page.screenshot({ path: testInfo.outputPath('resumed-area-draft.png') });

    await expandToolSettings(page, 'area');
    await page.getByRole('tab', { name: 'Find administrative area' }).click();
    await page.getByRole('button', { name: 'Cancel area' }).click();
    await page.getByRole('button', { name: 'Area (S)' }).click();
    await page.getByRole('tab', { name: 'Draw custom area' }).click();
    await expect(status).toContainText('3 vertices');
    await page.getByRole('button', { name: 'Finish area' }).click();
    await expect(map).toHaveAttribute('data-selected-layer', 'shape-01');
    await expect(map).not.toHaveAttribute('data-map-layer-order', /shape-draft/);
    await page.getByRole('button', { name: 'Area (S)' }).click();
    await expect(status).toContainText('0 vertices');
    await canvas.click({ position: point(0.2, 0.18) });
    await expandToolSettings(page, 'area');
    await page.getByRole('button', { name: 'Cancel area' }).click();
    await page.getByRole('button', { name: 'Area (S)' }).click();
    await expect(status).toContainText('0 vertices');
  });
}

test('polygon authoring can be cancelled, undone, redone, and exported as vector content', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.goto('./');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so map authoring cannot be exercised.');

  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  await expect(page.getByRole('status', { name: 'Area drawing status' })).toContainText('0 vertices');
  await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel area' }).click();
  await expect(page.getByRole('button', { name: 'Select (V)' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Select Area 01' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  const canvas = page.locator('.maplibregl-canvas');
  const canvasBox = await canvas.boundingBox();
  const frameBox = await page.locator('.print-frame').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  const point = (xFraction: number, yFraction: number) => ({
    x: frameBox!.x - canvasBox!.x + frameBox!.width * xFraction,
    y: frameBox!.y - canvasBox!.y + frameBox!.height * yFraction,
  });
  await canvas.click({ position: point(0.2, 0.2) });
  await canvas.click({ position: point(0.8, 0.2) });
  await expect(page.getByRole('button', { name: 'Finish area' })).toBeDisabled();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /shape-draft-outline/);
  await page.getByRole('button', { name: 'Hide area settings' }).click();
  await canvas.click({ position: point(0.2, 0.5) });
  await expect(page.getByRole('status', { name: 'Area drawing status' })).toContainText('3 vertices');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /shape-draft/);

  await page.getByRole('button', { name: 'Finish area' }).click();
  const createdShape = page.getByRole('button', { name: 'Select Area 01' });
  await expect(createdShape).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /shape-01/);
  await expect(page.getByRole('button', { name: 'Select (V)' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(createdShape).not.toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(createdShape).toBeVisible();

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const downloadButton = exportDialog.getByRole('button', { name: 'Download layered SVG' });
  await expect(downloadButton).toBeEnabled({ timeout: 20_000 });
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath('shape-authoring.layered.svg');
  await download.saveAs(outputPath);
  const svg = await readFile(outputPath, 'utf8');
  expect(svg).toContain('data-layer-name="Area 01"');
  expect(svg).toMatch(/data-layer-id="shape-01"[^>]*>[\s\S]*?<path /);
  expect(consoleProblems).toEqual([]);
});

test('a finished custom area supports point editing, insertion, undo, and explicit transform mode', async ({ page }) => {
  await page.goto('./');
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText('Map preview unavailable');
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), 'This browser fixture has no WebGL 2 renderer, so map point editing cannot be exercised.');

  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('tab', { name: 'Draw custom area' }).click();
  const canvas = page.locator('.maplibregl-canvas');
  const canvasBox = await canvas.boundingBox();
  const frameBox = await page.locator('.print-frame').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  const point = (xFraction: number, yFraction: number) => ({
    x: frameBox!.x - canvasBox!.x + frameBox!.width * xFraction,
    y: frameBox!.y - canvasBox!.y + frameBox!.height * yFraction,
  });
  await canvas.click({ position: point(0.2, 0.2) });
  await canvas.click({ position: point(0.8, 0.2) });
  await page.getByRole('button', { name: 'Hide area settings' }).click();
  await canvas.click({ position: point(0.2, 0.5) });
  await page.getByRole('button', { name: 'Finish area' }).click();

  const editPoints = page.getByRole('button', { name: 'Edit area points' });
  const transform = page.getByRole('button', { name: 'Transform area' });
  await expect(editPoints).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.shape-vertex-marker')).toHaveCount(3);
  await expect(page.locator('.shape-midpoint-marker')).toHaveCount(3);
  await expect(page.locator('.shape-transform-marker')).toHaveCount(0);

  const mapCanvas = page.getByTestId('map-canvas');
  const geometryBeforeNudge = await mapCanvas.evaluate((element) => (element as HTMLElement).dataset.mapLayerGeometry);
  const firstPoint = page.locator('.shape-vertex-marker').first();
  await firstPoint.focus();
  await firstPoint.press('ArrowRight');
  await expect.poll(() => mapCanvas.evaluate((element) => (element as HTMLElement).dataset.mapLayerGeometry)).not.toBe(geometryBeforeNudge);

  await page.locator('.shape-midpoint-marker').first().click();
  await expect(page.locator('.shape-vertex-marker')).toHaveCount(4);
  await expect(page.locator('.shape-midpoint-marker')).toHaveCount(4);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.shape-vertex-marker')).toHaveCount(3);

  await transform.click();
  await expect(transform).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.shape-vertex-marker')).toHaveCount(0);
  await expect(page.locator('.shape-midpoint-marker')).toHaveCount(0);
  await expect(page.locator('.shape-transform-marker')).toHaveCount(5);
});
