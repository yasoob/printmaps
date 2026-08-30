import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isExpectedWebGlDiagnostic = (message: string) => message.includes('GPU stall due to ReadPixels');

async function selectCountry(page: import('@playwright/test').Page, name: string) {
  const country = page.getByRole('combobox', { name: 'Country' });
  await country.fill(name);
  await page.getByRole('option', { name: `${name} Country`, exact: true }).click();
}

test('boundary menu stays above map controls and keeps the country selector scrollable', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Area (S)' }).click();

  const stacking = await page.evaluate(() => ({
    fit: Number(getComputedStyle(document.querySelector('.map-fit-control')!).zIndex),
    panel: Number(getComputedStyle(document.querySelector('.map-authoring-panel')!).zIndex),
    scale: Number(getComputedStyle(document.querySelector('.map-scale')!).zIndex),
  }));
  expect(stacking.panel).toBeGreaterThan(stacking.fit);
  expect(stacking.panel).toBeGreaterThan(stacking.scale);

  await page.getByRole('combobox', { name: 'Country' }).click();
  const content = page.locator('.shadcn-combobox-popup');
  const viewport = page.locator('.shadcn-combobox-list');
  const box = await content.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  const before = await viewport.evaluate((element) => ({ height: element.clientHeight, scrollHeight: element.scrollHeight, top: element.scrollTop }));
  expect(before.scrollHeight).toBeGreaterThan(before.height);
  await content.hover();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(before.top);
});

test('generated worldwide catalogue lazily creates a durable Japanese region', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await selectCountry(page, 'Japan');
  await page.getByRole('combobox', { name: 'Boundary' }).fill('Kyōto Prefecture');
  await page.getByRole('option', { name: /Kyōto Prefecture/ }).click();
  await expect(page.getByRole('button', { name: 'Add area' })).toBeEnabled();
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/global-region-coverage-20260826.png' });
  }
  await page.getByRole('button', { name: 'Add area' }).click();

  const layer = page.getByRole('button', { name: 'Select Kyōto Prefecture' });
  await expect(layer).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-jp-26:/);

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('japan-region.printmap.json');
  await save.saveAs(savePath);
  const project = JSON.parse(await readFile(savePath, 'utf8'));
  const savedRegion = project.layers.find(({ id }: { id: string }) => id === 'admin-jp-26');
  expect(savedRegion).toMatchObject({ name: 'Kyōto Prefecture', geometry: { type: 'Polygon' } });

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svg = await svgPromise;
  const svgPath = testInfo.outputPath('japan-region.layered.svg');
  await svg.saveAs(svgPath);
  expect(await readFile(svgPath, 'utf8')).toContain('data-layer-name="Kyōto Prefecture"');
  expect(consoleProblems).toEqual([]);
});

test('generated worldwide catalogue lazily creates a durable country', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Area (S)' }).click();
  await selectCountry(page, 'India');
  await expect(page.getByRole('button', { name: 'Add area' })).toBeEnabled();
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/global-india-country-catalogue-20260826.png' });
  }
  await page.getByRole('button', { name: 'Add area' }).click();

  const layer = page.getByRole('button', { name: 'Select India' });
  await expect(layer).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-ind:/);

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('india-country.printmap.json');
  await save.saveAs(savePath);
  const project = JSON.parse(await readFile(savePath, 'utf8'));
  const savedCountry = project.layers.find(({ id }: { id: string }) => id === 'admin-ind');
  expect(savedCountry).toMatchObject({ name: 'India' });
  expect(['Polygon', 'MultiPolygon']).toContain(savedCountry.geometry.type);

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svg = await svgPromise;
  const svgPath = testInfo.outputPath('india-country.layered.svg');
  await svg.saveAs(svgPath);
  expect(await readFile(svgPath, 'utf8')).toContain('data-layer-name="India"');
  expect(consoleProblems).toEqual([]);
});

test('generated boundary pickers stay fail-closed when the worldwide catalogue is unavailable', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isExpectedWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.route('**/data/administrative/index.json', async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ schemaVersion: 999 }),
  }));

  await page.goto('./');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Area (S)' }).click();

  await expect(page.getByRole('status', { name: 'Administrative catalogue status' }))
    .toHaveText('Worldwide catalogue unavailable. Boundaries cannot be added until it is available. Administrative catalogue version is unsupported.');
  const catalogueStatus = page.getByRole('status', { name: 'Administrative catalogue status' });
  await expect(page.getByRole('combobox', { name: 'Country' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Boundary' })).toBeDisabled();
  const [statusBox, panelBox] = await Promise.all([
    catalogueStatus.boundingBox(),
    page.locator('.shape-authoring-panel').boundingBox(),
  ]);
  expect(statusBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(statusBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
  expect(statusBox!.x + statusBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({
      animations: 'disabled',
      path: 'docs/screenshots/generated-catalogue-unavailable-20260827.png',
    });
  }
  expect(consoleProblems).toEqual([]);
});
