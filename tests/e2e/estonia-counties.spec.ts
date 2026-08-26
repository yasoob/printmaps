import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('Estonian county catalogue creates a durable area with print parity', async ({ page }, testInfo) => {
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
  await page.getByRole('combobox', { name: 'Region country' }).selectOption('EST');
  const regions = page.getByRole('group', { name: 'Estonia regions' });
  await expect(regions.getByRole('checkbox')).toHaveCount(15);
  await regions.getByRole('checkbox', { name: 'Harju' }).check();
  await page.getByRole('button', { name: 'Add selected area' }).click();
  await expect(page.getByRole('button', { name: 'Select Harju' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-ee-37:/);
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/estonia-county-catalogue-20260826.png' });
  }

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('estonia-county.printmap.json');
  await save.saveAs(savePath);
  const savedProject = JSON.parse(await readFile(savePath, 'utf8'));
  const county = savedProject.layers.find(({ id }: { id: string }) => id === 'admin-ee-37');
  expect(savedProject.schemaVersion).toBe(21);
  expect(county).toMatchObject({ name: 'Harju', geometry: { type: 'MultiPolygon' } });
  expect(county.geometry.coordinates).toHaveLength(2);

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svgDownload = await svgPromise;
  const svgPath = testInfo.outputPath('estonia-county.layered.svg');
  await svgDownload.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  expect(svg).toContain('data-layer-name="Harju"');
  expect(consoleProblems).toEqual([]);
});
