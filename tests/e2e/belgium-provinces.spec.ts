import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const isHeadlessWebGlDiagnostic = (message: string) => (
  message.includes('GPU stall due to ReadPixels')
  || message.includes('AllowWebgl2:false restricts context creation on this system')
);

test('Belgian province catalogue creates a durable area with print parity', async ({ page }, testInfo) => {
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
  await page.getByRole('combobox', { name: 'Administrative level' }).selectOption('region');
  await page.getByRole('combobox', { name: 'Region country' }).selectOption('BEL');
  const provinces = page.getByRole('group', { name: 'Belgium regions' });
  await expect(provinces.getByRole('checkbox')).toHaveCount(11);
  await provinces.getByRole('checkbox', { name: 'Brussels Capital' }).check();
  await page.getByRole('button', { name: 'Add selected area' }).click();
  await expect(page.getByRole('button', { name: 'Select Brussels Capital' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-geometry', /admin-be-bru:/);
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/belgium-province-catalogue-20260826.png' });
  }

  const savePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const save = await savePromise;
  const savePath = testInfo.outputPath('belgium-province.printmap.json');
  await save.saveAs(savePath);
  const savedProject = JSON.parse(await readFile(savePath, 'utf8'));
  const province = savedProject.layers.find(({ id }: { id: string }) => id === 'admin-be-bru');
  expect(savedProject.schemaVersion).toBe(21);
  expect(province).toMatchObject({ name: 'Brussels Capital', geometry: { type: 'Polygon' } });

  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export map' });
  await exportDialog.getByRole('radio', { name: /Layered SVG/ }).click();
  const svgPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Download layered SVG' }).click();
  const svgDownload = await svgPromise;
  const svgPath = testInfo.outputPath('belgium-province.layered.svg');
  await svgDownload.saveAs(svgPath);
  const svg = await readFile(svgPath, 'utf8');
  expect(svg).toContain('data-layer-name="Brussels Capital"');
  expect(consoleProblems).toEqual([]);
});
