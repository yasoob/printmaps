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
  await page.getByRole('button', { name: 'Save' }).click();
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

test('Hungarian, Slovak and Austrian region catalogues create durable areas with print parity', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleProblems.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  await page.getByRole('combobox', { name: 'Region country' }).selectOption('HUN');
  const hungaryRegions = page.getByRole('group', { name: 'Hungary regions' });
  await expect(hungaryRegions.getByRole('checkbox')).toHaveCount(43);
  await expect(hungaryRegions.getByRole('checkbox', { name: 'Veszprém', exact: true })).toBeVisible();
  await expect(hungaryRegions.getByRole('checkbox', { name: 'Veszprém (city)', exact: true })).toBeVisible();
  await hungaryRegions.getByRole('checkbox', { name: 'Budapest' }).check();
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/hungary-region-catalogue-20260826.png' });
  }
  await page.getByRole('button', { name: 'Add selected area' }).click();
  await expect(page.getByRole('button', { name: 'Select Budapest' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-hu-bu:/);
  await page.getByRole('button', { name: 'Undo' }).click();

  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  await page.getByRole('combobox', { name: 'Region country' }).selectOption('SVK');
  const slovakiaRegions = page.getByRole('group', { name: 'Slovakia regions' });
  await expect(slovakiaRegions.getByRole('checkbox')).toHaveCount(8);
  await slovakiaRegions.getByRole('checkbox', { name: 'Bratislava' }).check();
  await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/slovakia-region-catalogue-20260826.png' });
  await page.getByRole('button', { name: 'Add selected area' }).click();
  await expect(page.getByRole('button', { name: 'Select Bratislava' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-sk-bl:/);
  await page.getByRole('button', { name: 'Undo' }).click();

  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  await expect(page.getByRole('group', { name: 'Austria regions' }).getByRole('checkbox')).toHaveCount(9);
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
  await page.getByRole('switch', { name: 'Invert shape fill' }).check();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-appearance', /admin-at-3-at-9:[^|]*:true/);

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('administrative-area.printmap.json');
  await save.saveAs(savePath);
  const savedProject = JSON.parse(await readFile(savePath, 'utf8'));
  expect(savedProject.schemaVersion).toBe(21);
  const savedArea = savedProject.layers.find(({ id }: { id: string }) => id === 'admin-at-3-at-9');
  expect(savedArea.appearance.invert).toBe(true);
  expect(savedArea.name).toBe('Lower Austria + Vienna');
  expect(savedArea.geometry.coordinates).toHaveLength(1);

  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('radio', { name: /Layered SVG/ }).click();
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
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  const regionOptionsBox = await page.getByRole('group', { name: 'Austria regions' }).boundingBox();
  const panelBox = await page.locator('.map-authoring-panel').boundingBox();
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
  await page.getByRole('button', { name: 'Cancel area' }).click();
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
  const mapReady = page.locator('[data-map-ready="true"]');
  await expect(mapReady).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  await expect(page.getByRole('group', { name: 'Austria regions' }).getByRole('checkbox')).toHaveCount(9);
  await page.getByRole('checkbox', { name: 'Tyrol' }).check();
  await page.getByRole('button', { name: 'Add selected area' }).click();
  await expect(page.getByRole('button', { name: 'Select Tyrol' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-at-7:\[\[\[\[/);
  await expect(page.getByRole('status', { name: 'Multi-part geometry status' })).toContainText('2 disconnected parts');
  await expect(page.getByRole('heading', { name: 'Vertices' })).toHaveCount(0);
  await page.getByRole('switch', { name: 'Invert shape fill' }).check();
  await expect(mapReady).toBeVisible({ timeout: 20_000 });
  if (testInfo.project.name === 'chromium') {
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/screenshots/latest-desktop.png' });
  }

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('tyrol.printmap.json');
  await save.saveAs(savePath);
  const savedProject = JSON.parse(await readFile(savePath, 'utf8'));
  const tyrol = savedProject.layers.find(({ id }: { id: string }) => id === 'admin-at-7');
  expect(savedProject.schemaVersion).toBe(21);
  expect(tyrol.geometry.type).toBe('MultiPolygon');
  expect(tyrol.geometry.coordinates).toHaveLength(2);

  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('dialog', { name: 'Export map' }).getByRole('radio', { name: /Layered SVG/ }).click();
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
