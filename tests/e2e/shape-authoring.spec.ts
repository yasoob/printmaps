import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('polygon authoring can be cancelled, undone, redone, and exported as vector content', async ({ page }, testInfo) => {
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

  await page.getByRole('button', { name: 'Shape (S)' }).click();
  await expect(page.getByRole('status', { name: 'Shape drawing status' })).toContainText('0 vertices');
  await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel shape' }).click();
  await expect(page.getByRole('button', { name: 'Select (V)' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Select Shape 01' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Shape (S)' }).click();
  const canvas = page.locator('.maplibregl-canvas');
  const canvasBox = await canvas.boundingBox();
  const frameBox = await page.locator('.print-frame').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  const point = (xFraction: number, yFraction: number) => ({
    x: frameBox!.x - canvasBox!.x + frameBox!.width * xFraction,
    y: frameBox!.y - canvasBox!.y + frameBox!.height * yFraction,
  });
  await canvas.click({ position: point(0.3, 0.7) });
  await canvas.click({ position: point(0.5, 0.25) });
  await expect(page.getByRole('button', { name: 'Finish shape' })).toBeDisabled();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /shape-draft-outline/);
  await canvas.click({ position: point(0.72, 0.7) });
  await expect(page.getByRole('status', { name: 'Shape drawing status' })).toContainText('3 vertices');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /shape-draft/);

  await page.getByRole('button', { name: 'Finish shape' }).click();
  const createdShape = page.getByRole('button', { name: 'Select Shape 01' });
  await expect(createdShape).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /shape-01/);
  await expect(page.getByRole('button', { name: 'Select (V)' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(createdShape).not.toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(createdShape).toBeVisible();

  await page.getByRole('button', { name: 'Export' }).click();
  const downloadButton = page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Download layered SVG' });
  await expect(downloadButton).toBeEnabled({ timeout: 20_000 });
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath('shape-authoring.layered.svg');
  await download.saveAs(outputPath);
  const svg = await readFile(outputPath, 'utf8');
  expect(svg).toContain('data-layer-name="Shape 01"');
  expect(svg).toMatch(/data-layer-id="shape-01"[^>]*>[\s\S]*?<path /);
  expect(consoleProblems).toEqual([]);
});

test('bundled administrative areas support direct selection, invert, save, and layered SVG', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleProblems.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Shape (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative area' }).selectOption('AUT');
  await page.getByRole('button', { name: 'Add administrative area' }).click();
  await expect(page.getByRole('button', { name: 'Select Austria' })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('checkbox', { name: 'Invert shape fill' }).check();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-appearance', /admin-aut:[^|]*:true/);

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('administrative-area.printmap.json');
  await save.saveAs(savePath);
  const savedProject = JSON.parse(await readFile(savePath, 'utf8'));
  expect(savedProject.schemaVersion).toBe(13);
  expect(savedProject.layers.find(({ id }: { id: string }) => id === 'admin-aut').appearance.invert).toBe(true);

  await page.getByRole('button', { name: 'Export' }).click();
  const svgPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Download layered SVG' }).click();
  const svgDownload = await svgPromise;
  const svgPath = testInfo.outputPath('administrative-area.layered.svg');
  await svgDownload.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  expect(svg).toContain('data-layer-name="Austria"');
  expect(svg).toContain('data-shape-fill="inverted"');
  expect(svg).toContain('data-shape-outline="true"');
  expect(consoleProblems).toEqual([]);
});
