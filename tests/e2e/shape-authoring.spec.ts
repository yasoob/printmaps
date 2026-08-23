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

test('bundled administrative regions merge without an internal border and retain print parity', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleProblems.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Shape (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  await expect(page.getByRole('group', { name: 'Regions' }).getByRole('checkbox')).toHaveCount(9);
  await page.getByRole('checkbox', { name: 'Burgenland' }).check();
  await page.getByRole('checkbox', { name: 'Vorarlberg' }).check();
  await page.getByRole('button', { name: 'Merge 2 selected areas' }).click();
  await expect(page.getByRole('alert', { name: 'Administrative area status' })).toContainText('connected single-part regions');
  await page.getByRole('checkbox', { name: 'Burgenland' }).uncheck();
  await page.getByRole('checkbox', { name: 'Vorarlberg' }).uncheck();
  await page.getByRole('checkbox', { name: 'Lower Austria' }).check();
  await page.getByRole('checkbox', { name: 'Vienna' }).check();
  await page.getByRole('button', { name: 'Merge 2 selected areas' }).click();
  await expect(page.getByRole('button', { name: 'Select Lower Austria + Vienna' })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('checkbox', { name: 'Invert shape fill' }).check();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-appearance', /admin-at-3-at-9:[^|]*:true/);

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('administrative-area.printmap.json');
  await save.saveAs(savePath);
  const savedProject = JSON.parse(await readFile(savePath, 'utf8'));
  expect(savedProject.schemaVersion).toBe(16);
  const savedArea = savedProject.layers.find(({ id }: { id: string }) => id === 'admin-at-3-at-9');
  expect(savedArea.appearance.invert).toBe(true);
  expect(savedArea.name).toBe('Lower Austria + Vienna');
  expect(savedArea.geometry.coordinates).toHaveLength(1);

  await page.getByRole('button', { name: 'Export' }).click();
  const svgPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Download layered SVG' }).click();
  const svgDownload = await svgPromise;
  const svgPath = testInfo.outputPath('administrative-area.layered.svg');
  await svgDownload.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  expect(svg).toContain('data-layer-name="Lower Austria + Vienna"');
  expect(svg).toContain('data-shape-fill="inverted"');
  expect(svg).toContain('data-shape-outline="true"');

  await page.getByRole('button', { name: 'Close export' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Shape (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  const regionOptionsBox = await page.getByRole('group', { name: 'Regions' }).boundingBox();
  const panelBox = await page.getByRole('status', { name: 'Shape drawing status' }).locator('..').boundingBox();
  expect(regionOptionsBox).not.toBeNull();
  expect(regionOptionsBox!.width).toBeGreaterThanOrEqual(300);
  expect(regionOptionsBox!.x).toBeGreaterThanOrEqual(0);
  expect(regionOptionsBox!.x + regionOptionsBox!.width).toBeLessThanOrEqual(390);
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(390);
  const zoomControlsBox = await page.locator('.maplibregl-ctrl-bottom-right').boundingBox();
  expect(zoomControlsBox).not.toBeNull();
  const overlapPoint = {
    x: Math.max(panelBox!.x, zoomControlsBox!.x) + 4,
    y: Math.max(panelBox!.y, zoomControlsBox!.y) + 4,
  };
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.map-authoring-panel') !== null, overlapPoint)).toBe(true);
  expect(await page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBe(0);
  await page.getByRole('button', { name: 'Cancel shape' }).click();
  expect(consoleProblems).toEqual([]);
});

test('Tyrol keeps both disconnected parts through live map, save, and layered SVG', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Shape (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  await expect(page.getByRole('group', { name: 'Regions' }).getByRole('checkbox')).toHaveCount(9);
  await page.getByRole('checkbox', { name: 'Tyrol' }).check();
  await page.getByRole('button', { name: 'Add selected area' }).click();
  await expect(page.getByRole('button', { name: 'Select Tyrol' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-at-7:\[\[\[\[/);
  await expect(page.getByRole('status', { name: 'Multi-part geometry status' })).toContainText('2 disconnected parts');
  await expect(page.getByRole('heading', { name: 'Vertices' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Invert shape fill' }).check();
  if (testInfo.project.name === 'chromium') {
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/latest-desktop.png' });
  }

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('tyrol.printmap.json');
  await save.saveAs(savePath);
  const savedProject = JSON.parse(await readFile(savePath, 'utf8'));
  const tyrol = savedProject.layers.find(({ id }: { id: string }) => id === 'admin-at-7');
  expect(savedProject.schemaVersion).toBe(16);
  expect(tyrol.geometry.type).toBe('MultiPolygon');
  expect(tyrol.geometry.coordinates).toHaveLength(2);

  await page.getByRole('button', { name: 'Export' }).click();
  const svgPromise = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('button', { name: 'Download layered SVG' }).click();
  const svgDownload = await svgPromise;
  const svgPath = testInfo.outputPath('tyrol.layered.svg');
  await svgDownload.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  const tyrolGroup = svg.match(/data-layer-id="admin-at-7"[^>]*>[\s\S]*?<\/g>/)?.[0] ?? '';
  expect(tyrolGroup).toContain('data-shape-fill="inverted"');
  expect(tyrolGroup.match(/M /g)?.length).toBeGreaterThanOrEqual(4);
  expect(consoleProblems).toEqual([]);
});
