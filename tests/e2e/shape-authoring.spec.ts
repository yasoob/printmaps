import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('Vienna municipality selection and merging preserve source credit through project and print downloads', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('municipality');
  const districts = page.getByRole('group', { name: 'Vienna districts' });
  await expect(districts.getByRole('checkbox')).toHaveCount(23);
  await expect(page.getByRole('link', { name: 'Vienna district boundaries source' })).toHaveAttribute('href', /BEZIRKSGRENZEOGD/);
  await expect(page.getByRole('link', { name: 'CC BY 3.0 AT license' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/3.0/at/');
  const districtFilter = page.getByRole('searchbox', { name: 'Filter Vienna districts' });
  await districtFilter.fill('Josef');
  await expect(districts.getByRole('checkbox')).toHaveCount(1);
  await expect(districts.getByRole('checkbox', { name: 'Josefstadt' })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/vienna-district-filter-20260826.png' });
  await districtFilter.fill('');
  await page.getByRole('checkbox', { name: 'Innere Stadt' }).check();
  await page.getByRole('checkbox', { name: 'Josefstadt' }).check();
  await page.getByRole('button', { name: 'Merge 2 selected districts' }).click();
  await expect(page.getByRole('button', { name: 'Select Innere Stadt + Josefstadt' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-at-9-01-at-9-08:/);
  await page.getByRole('switch', { name: 'Invert shape fill' }).check();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-appearance', /admin-at-9-01-at-9-08:[^|]*:true/);
  await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/vienna-district-merge-20260826.png' });

  const projectPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const projectDownload = await projectPromise;
  const projectPath = testInfo.outputPath('vienna-district.printmap.json');
  await projectDownload.saveAs(projectPath);
  const project = JSON.parse(await readFile(projectPath, 'utf8'));
  const districtLayer = project.layers.find(({ id }: { id: string }) => id === 'admin-at-9-01-at-9-08');
  expect(project.schemaVersion).toBe(21);
  expect(districtLayer).toMatchObject({ name: 'Innere Stadt + Josefstadt', geometry: { type: 'Polygon' }, appearance: { invert: true } });
  expect(districtLayer.geometry.coordinates).toHaveLength(1);
  expect(districtLayer.geometry.coordinates.flat().length).toBeLessThanOrEqual(1000);

  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map' });
  await dialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svgDownload = await svgPromise;
  const svgPath = testInfo.outputPath('vienna-district.layered.svg');
  await svgDownload.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  expect(svg).toContain('data-layer-name="Innere Stadt + Josefstadt"');
  expect(svg).toContain('City of Vienna OGD (CC BY 3.0 AT; boundaries simplified)');

  await page.getByRole('button', { name: 'Close export' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('municipality');
  await page.getByRole('searchbox', { name: 'Filter Vienna districts' }).fill('Josef');
  await expect(page.getByRole('group', { name: 'Vienna districts' }).getByRole('checkbox')).toHaveCount(1);
  await expect(page.getByRole('searchbox', { name: 'Filter Vienna districts' })).toHaveCSS('min-height', '44px');
  await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/latest-mobile.png' });
  const panel = page.locator('.map-authoring-panel');
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.body.scrollWidth - window.innerWidth)).toBe(0);
  await page.getByRole('button', { name: 'Cancel area' }).click();
  expect(consoleProblems).toEqual([]);
});

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
  await canvas.click({ position: point(0.3, 0.7) });
  await canvas.click({ position: point(0.5, 0.25) });
  await expect(page.getByRole('button', { name: 'Finish area' })).toBeDisabled();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', /shape-draft-outline/);
  await canvas.click({ position: point(0.72, 0.7) });
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
  await page.goto('/');
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
  await canvas.click({ position: point(0.3, 0.7) });
  await canvas.click({ position: point(0.5, 0.25) });
  await canvas.click({ position: point(0.72, 0.7) });
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
