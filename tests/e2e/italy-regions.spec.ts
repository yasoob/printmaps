import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('Italian region catalogue creates a durable area with print parity', async ({ page }, testInfo) => {
  const consoleProblems: string[] = [];
  page.on('pageerror', (error) => { consoleProblems.push(error.message); });
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && !isHeadlessWebGlDiagnostic(message.text())) {
      consoleProblems.push(message.text());
    }
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Area (S)' }).click();
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  await page.getByRole('combobox', { name: 'Region country' }).selectOption('ITA');
  const regions = page.getByRole('group', { name: 'Italy regions' });
  await expect(regions.getByRole('checkbox')).toHaveCount(20);
  await expect(regions.getByRole('checkbox', { name: 'Lazio' })).toBeVisible();
  await expect(regions.getByRole('checkbox', { name: 'Sardegna' })).toBeVisible();
  await regions.getByRole('checkbox', { name: 'Sicily' }).check();
  await page.getByRole('button', { name: 'Add selected area' }).click();
  await expect(page.getByRole('button', { name: 'Select Sicily' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-it-82:/);
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/italy-region-catalogue-20260826.png' });
  }

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Project' }).click(); await page.getByRole('menuitem', { name: 'Download project' }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('italy-region.printmap.json');
  await save.saveAs(savePath);
  const savedProject = JSON.parse(await readFile(savePath, 'utf8'));
  const region = savedProject.layers.find(({ id }: { id: string }) => id === 'admin-it-82');
  expect(savedProject.schemaVersion).toBe(21);
  expect(region).toMatchObject({ name: 'Sicily', geometry: { type: 'MultiPolygon' } });
  expect(region.geometry.coordinates).toHaveLength(13);

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svgDownload = await svgPromise;
  const svgPath = testInfo.outputPath('italy-region.layered.svg');
  await svgDownload.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  const sicilyGroup = svg.match(/<g[^>]*data-layer-name="Sicily"[^>]*>.*?<\/g>/)?.[0];
  expect(sicilyGroup).toContain('data-layer-name="Sicily"');
  expect((sicilyGroup?.match(/\bM /g) ?? []).length).toBeGreaterThanOrEqual(13);
  expect(consoleProblems).toEqual([]);
});
