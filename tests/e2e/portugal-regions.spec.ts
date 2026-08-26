import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('Portuguese district and autonomous-region catalogue creates a durable area with print parity', async ({ page }, testInfo) => {
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
  await page.getByRole('combobox', { name: 'Region country' }).selectOption('PRT');
  const regions = page.getByRole('group', { name: 'Portugal regions' });
  await expect(regions.getByRole('checkbox')).toHaveCount(20);
  await expect(regions.getByRole('checkbox', { name: 'Lisbon' })).toBeVisible();
  await expect(regions.getByRole('checkbox', { name: 'Azores' })).toBeVisible();
  await regions.getByRole('checkbox', { name: 'Madeira' }).check();
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/portugal-region-catalogue-20260826.png' });
  }
  await page.getByRole('button', { name: 'Add selected area' }).click();
  await expect(page.getByRole('button', { name: 'Select Madeira' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-pt-30:/);

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('portugal-region.printmap.json');
  await save.saveAs(savePath);
  const savedProject = JSON.parse(await readFile(savePath, 'utf8'));
  const region = savedProject.layers.find(({ id }: { id: string }) => id === 'admin-pt-30');
  expect(savedProject.schemaVersion).toBe(21);
  expect(region).toMatchObject({ name: 'Madeira', geometry: { type: 'MultiPolygon' } });
  expect(region.geometry.coordinates).toHaveLength(5);

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svgDownload = await svgPromise;
  const svgPath = testInfo.outputPath('portugal-region.layered.svg');
  await svgDownload.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  const madeiraGroup = svg.match(/<g[^>]*data-layer-name="Madeira"[^>]*>.*?<\/g>/)?.[0];
  expect(madeiraGroup).toContain('data-layer-name="Madeira"');
  expect((madeiraGroup?.match(/\bM /g) ?? []).length).toBeGreaterThanOrEqual(5);
  expect(consoleProblems).toEqual([]);
});
